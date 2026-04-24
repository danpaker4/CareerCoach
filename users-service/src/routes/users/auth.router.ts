import { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { Collection } from "mongodb";
import bcrypt from "bcryptjs";
import { User } from "./user.model";
import { registerUser } from "./register-user.service";

type RegisterFields = Record<string, string>;
type RegisterMultipartData = {
    fields: RegisterFields;
    cvFile: MultipartFile | null;
};

const appendPart = (
    current: RegisterMultipartData,
    part: Awaited<ReturnType<AsyncIterator<any>["next"]>>["value"],
): RegisterMultipartData => {
    if (part?.type === "file" && part.fieldname === "cv") {
        return { ...current, cvFile: part as MultipartFile };
    }
    if (part?.type === "field") {
        return {
            ...current,
            fields: {
                ...current.fields,
                [part.fieldname]: String(part.value ?? ""),
            },
        };
    }
    return current;
};

const readMultipartData = async (
    iterator: AsyncIterator<any>,
    acc: RegisterMultipartData = { fields: {}, cvFile: null },
): Promise<RegisterMultipartData> => {
    const next = await iterator.next();
    if (next.done) {
        return acc;
    }
    return readMultipartData(iterator, appendPart(acc, next.value));
};

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
         const { email, password } = req.body as any;
         const user = await usersCollection.findOne({ email });
         if (!user) return reply.status(401).send({ error: "Invalid email or password" });
         
         const isMatch = await bcrypt.compare(password, user.password);
         if (!isMatch) return reply.status(401).send({ error: "Invalid email or password" });

         const { password: _password, ...safeUser } = user;
         return reply.send({
            success: true,
            user: safeUser,
        });
    });
};