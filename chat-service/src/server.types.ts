export interface ServerConfig {
    port: number;
    host: string;
    mongoConfig: {
        mongoConnectionString: string;
        mongoKeyPath?: string;
    };
    chatConfig: {
        usersServiceBaseUrl: string;
        jobServiceBaseUrl: string;
        geminiApiKey: string;
    }
}
