export interface ServerConfig {
    port: number;
    mongoConfig: {
        mongoConnectionString: string;
        mongoKeyPath?: string;
    };
}
