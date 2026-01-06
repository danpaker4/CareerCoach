import { DatabaseConfig } from "../mongo/mongo";

export interface CommonServerConfig {
  port: number;
  host?: string;
}

export type ServerConfig = CommonServerConfig & {
  mongoConfig: DatabaseConfig;
};

