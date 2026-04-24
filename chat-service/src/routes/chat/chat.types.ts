export type ChatRequestBody = {
    userId?: string;
    message: string;
};

export type UserContextResponse = {
    firstName: string;
    lastName: string;
    currentJob?: string;
};
