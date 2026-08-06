import { z } from "zod";

export const envString = (name: string) => z.string().min(1, `${name} is required`);

export const optionalEmptyString = (value: unknown): unknown =>
    typeof value === "string" && value.trim().length === 0 ? undefined : value;
