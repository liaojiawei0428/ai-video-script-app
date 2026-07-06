export interface RechargeRow {
    id: string;
    userId: string;
    username: string;
    amount: number;
    status: string;
    remark: string;
    ip: string;
    ipLocation: string;
    createdAt: number;
    updatedAt: number;
}
export declare class RechargeRequestModel {
    create(userId: string, username: string, amount: number, ip: string, ipLocation: string): Promise<RechargeRow>;
    findById(id: string): Promise<RechargeRow | undefined>;
    updateStatus(id: string, status: 'approved' | 'rejected', remark?: string): Promise<void>;
    findByStatus(status: string, limit?: number): Promise<RechargeRow[]>;
    findByUserId(userId: string, limit?: number): Promise<RechargeRow[]>;
    findAll(limit?: number): Promise<RechargeRow[]>;
    countByStatus(status: string): Promise<number>;
    countToday(): Promise<number>;
    private mapRow;
}
export declare const rechargeRequestModel: RechargeRequestModel;
