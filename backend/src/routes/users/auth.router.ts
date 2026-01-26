import { FastifyInstance } from "fastify";
import { Collection } from "mongodb";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from 'uuid'; 
import { User } from "./user.model";

export const authRouter = (usersCollection: Collection<User>) => async (app: FastifyInstance) => {

    app.post("/api/auth/register", async (req, reply) => {
        const { firstName, lastName, email, password, birthDate, currentJob } = req.body as any;

        if (!email || !password || !firstName || !lastName || !birthDate) {
            return reply.status(400).send({ error: "Missing required fields" });
        }

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
            return reply.status(400).send({ error: "Email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser: User = {
            id: uuidv4(),
            firstName,
            lastName,
            email,
            password: hashedPassword,
            birthDate: new Date(birthDate),
            currentJob: currentJob || ""
        };

        await usersCollection.insertOne(newUser);
        
        return reply.send({ 
            success: true, 
            userId: newUser.id,
            user: { firstName, lastName, email } 
        });
    });

    app.post("/api/auth/login", async (req, reply) => {
        const { email, password } = req.body as any;

        const user = await usersCollection.findOne({ email });
        if (!user) {
            return reply.status(401).send({ error: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return reply.status(401).send({ error: "Invalid email or password" });
        }

        return reply.send({
            success: true,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                currentJob: user.currentJob
            }
        });
    });
};