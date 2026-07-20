import type { UserDocument } from "../users/user.model";
import { toUser } from "../users/user.utils";
import type { AdminUserSummary } from "./admin.types";

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const normalizeAdminEmail = (email: string): string => email.trim().toLowerCase();

export const buildSearchRegex = (query: string): RegExp => new RegExp(escapeRegex(query.trim()), "i");

export const buildExactEmailRegex = (email: string): RegExp => new RegExp(`^${escapeRegex(normalizeAdminEmail(email))}$`, "i");

export const toAdminUserSummary = (userDocument: UserDocument): AdminUserSummary => {
    const user = toUser(userDocument);

    return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
    };
};
