import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
export declare function getDb(): Promise<Pool>;
export declare function queryOne<T = RowDataPacket>(sql: string, params?: any[]): Promise<T | undefined>;
export declare function queryAll<T = RowDataPacket>(sql: string, params?: any[]): Promise<T[]>;
export declare function execute(sql: string, params?: any[]): Promise<ResultSetHeader>;
export declare function poolQuery<T = RowDataPacket>(sql: string, params?: any[]): Promise<T[]>;
