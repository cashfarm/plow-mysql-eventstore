import { PoolConfig } from "mysql";

export interface EsConnectionConfig {
    poolConfig: PoolConfig;
    database: string;
    aggregates: string[];
}