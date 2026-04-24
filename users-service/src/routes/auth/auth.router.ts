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
};