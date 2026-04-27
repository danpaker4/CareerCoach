import { FastifyInstance } from "fastify";
import { Collection } from "mongodb";
import bcrypt from "bcryptjs";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import { User } from "../users/user.model";
import { registerUser } from "../users/register/register-user.service";
import { clearAuthCookies, generateAccessToken, generateRefreshToken, setAccessTokenCookie, setAuthCookies, verifyToken } from "./auth-tokens.service";
import { ACCESS_TOKEN_COOKIE, isLoginBody, readMultipartData, REFRESH_TOKEN_COOKIE, toSafeUser } from "./auth.utils";

export const authRouter = (usersCollection: Collection<User>) => async (app: FastifyInstance) => {

    app.post("/api/auth/register", async (req, reply) => {
        try {
            if (!req.isMultipart()) {
                return reply.status(400).send({ error: "Registration must use multipart/form-data" });
            }

            const parts = req.parts();
            const { fields, cvFile } = await readMultipartData(parts[Symbol.asyncIterator]());

            const user = await registerUser(usersCollection, {
                firstName: fields.firstName,
                lastName: fields.lastName,
                email: fields.email,
                password: fields.password,
                birthDate: fields.birthDate,
                currentJob: fields.currentJob,
                linkedInUrl: fields.linkedInUrl,
                githubUrl: fields.githubUrl,
                cvFile,
            });

            const payload = { userId: user.id, email: user.email };
            setAuthCookies(reply, {
                accessToken: generateAccessToken(payload),
                refreshToken: generateRefreshToken(payload),
            });

            return reply.send({ 
                success: true, 
                userId: user.id,
                user,
            });
        } catch (err) {
            console.error("🔥 Error in register:", err);
            const message = err instanceof Error ? err.message : "Internal Server Error";
            const statusCode = message.includes("exists") || message.includes("Missing") || message.includes("must") || message.includes("required")
                ? 400
                : 500;
            return reply.status(statusCode).send({ error: message });
        }
    });

    app.post("/api/auth/login", async (req, reply) => {
         if (!isLoginBody(req.body)) {
            return reply.status(400).send({ error: "Email and password are required" });
         }

         const { email, password } = req.body;
         const user = await usersCollection.findOne({ email });
         if (!user) return reply.status(401).send({ error: "Invalid email or password" });
         
         const isMatch = await bcrypt.compare(password, user.password);
         if (!isMatch) return reply.status(401).send({ error: "Invalid email or password" });

         const safeUser = toSafeUser(user);
         const payload = { userId: user.id, email: user.email };
         setAuthCookies(reply, {
            accessToken: generateAccessToken(payload),
            refreshToken: generateRefreshToken(payload),
         });
         return reply.send({
            success: true,
            user: safeUser,
        });
    });

    app.get("/api/auth/me", async (req, reply) => {
        const accessToken = req.cookies[ACCESS_TOKEN_COOKIE];
        if (!accessToken) {
            return reply.status(401).send({ error: "Access token missing", errorCode: "ACCESS_TOKEN_MISSING" });
        }

        try {
            const payload = verifyToken(accessToken);
            const user = await usersCollection.findOne({ id: payload.userId });
            if (!user) {
                clearAuthCookies(reply);
                return reply.status(401).send({ error: "User not found", errorCode: "ACCESS_TOKEN_INVALID" });
            }

            return reply.send({ success: true, user: toSafeUser(user) });
        } catch (error) {
            if (error instanceof TokenExpiredError) {
                return reply.status(401).send({ error: "Access token expired", errorCode: "ACCESS_TOKEN_EXPIRED" });
            }
            if (error instanceof jwt.JsonWebTokenError) {
                clearAuthCookies(reply);
                return reply.status(401).send({ error: "Invalid access token", errorCode: "ACCESS_TOKEN_INVALID" });
            }
            return reply.status(401).send({ error: "Unauthorized", errorCode: "UNAUTHORIZED" });
        }
    });

    app.post("/api/auth/refresh", async (req, reply) => {
        try {
            const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE];
            if (!refreshToken) {
                clearAuthCookies(reply);
                return reply.status(401).send({ error: "Refresh token missing", errorCode: "REFRESH_TOKEN_MISSING" });
            }

            const payload = verifyToken(refreshToken);
            const user = await usersCollection.findOne({ id: payload.userId });
            if (!user) {
                clearAuthCookies(reply);
                return reply.status(401).send({ error: "Invalid refresh token", errorCode: "REFRESH_TOKEN_INVALID" });
            }

            const accessToken = generateAccessToken({ userId: user.id, email: user.email });
            setAccessTokenCookie(reply, accessToken);
            return reply.send({ success: true });
        } catch (error) {
            clearAuthCookies(reply);
            return reply.status(401).send({ error: "Refresh token invalid or expired", errorCode: "REFRESH_TOKEN_INVALID" });
        }
    });

    app.post("/api/auth/logout", async (_req, reply) => {
        clearAuthCookies(reply);
        return reply.send({ success: true });
    });

    app.get("/api/auth/github/callback", async (req, reply) => {
        const { code } = req.query as { code?: string };
        if (!code) {
            return reply.status(400).send({ error: "Missing code parameter" });
        }

        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;

        if (!clientId || clientId === "your_github_client_id" || !clientSecret || clientSecret === "your_github_client_secret") {
            return reply.status(503).send({ error: "GitHub OAuth is not configured on this server" });
        }

        try {
            const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
            });
            const tokenData = await tokenRes.json() as { access_token?: string; error?: string };

            if (!tokenData.access_token) {
                return reply.status(401).send({ error: "GitHub OAuth failed", detail: tokenData.error });
            }

            const ghUserRes = await fetch("https://api.github.com/user", {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            const ghUser = await ghUserRes.json() as { id: number; login: string; name?: string; email?: string };

            let email = ghUser.email ?? null;
            if (!email) {
                const emailsRes = await fetch("https://api.github.com/user/emails", {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                });
                const emails = await emailsRes.json() as Array<{ email: string; primary: boolean }>;
                email = emails.find((e) => e.primary)?.email ?? null;
            }

            if (!email) {
                return reply.status(400).send({ error: "Could not retrieve email from GitHub" });
            }

            let existingUser = await usersCollection.findOne({ email });

            if (!existingUser) {
                const { v4: uuidv4 } = await import("uuid");
                const bcryptLib = await import("bcryptjs");
                const [firstName, ...rest] = (ghUser.name ?? ghUser.login).split(" ");
                const newUser = {
                    id: uuidv4(),
                    firstName: firstName ?? ghUser.login,
                    lastName: rest.join(" ") || ghUser.login,
                    email,
                    password: await bcryptLib.default.hash(uuidv4(), 10),
                    birthDate: new Date(),
                    achievements: [] as { id: string; name: string; grade: number }[],
                    githubUrl: `https://github.com/${ghUser.login}`,
                };
                await usersCollection.insertOne(newUser);
                existingUser = await usersCollection.findOne({ email });
            }

            if (!existingUser) {
                return reply.status(500).send({ error: "Failed to create user" });
            }

            const payload = { userId: existingUser.id, email: existingUser.email };
            setAuthCookies(reply, {
                accessToken: generateAccessToken(payload),
                refreshToken: generateRefreshToken(payload),
            });

            return reply.send({ success: true, user: toSafeUser(existingUser) });
        } catch (err) {
            console.error("GitHub OAuth error:", err);
            return reply.status(500).send({ error: "GitHub OAuth failed" });
        }
    });
};