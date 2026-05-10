import type { User, UserDocument } from "./user.model";

export const toUserDocument = (user: User): UserDocument => {
    const { id, ...rest } = user;

    return {
        _id: id,
        ...rest,
    };
};

export const toUser = (userDocument: UserDocument): User => {
    const { _id, ...rest } = userDocument;

    return {
        id: _id,
        ...rest,
    };
};
