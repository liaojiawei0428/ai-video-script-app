import { User } from '../shared/types';
export declare class UserModel {
    create(user: User): Promise<void>;
    findById(id: string): Promise<User | undefined>;
    findByUsername(username: string): Promise<User | undefined>;
    findByEmail(email: string): Promise<User | undefined>;
    updateProfile(id: string, data: {
        nickname?: string;
        avatarUrl?: string;
    }): Promise<void>;
    updatePassword(id: string, passwordHash: string): Promise<void>;
    updateBalance(id: string, amount: number): Promise<void>;
    updateVipLevel(id: string, level: number): Promise<void>;
    updateVip(id: string, level: number, expiresAt: number): Promise<void>;
    clearVip(id: string): Promise<void>;
    setRole(id: string, role: string): Promise<void>;
    countAll(): Promise<number>;
    countToday(): Promise<number>;
    incrementGenerations(id: string): Promise<void>;
    countByIp(ip: string): Promise<number>;
    list(): Promise<User[]>;
    updateIp(id: string, ip: string): Promise<void>;
    updateIpLocation(id: string, ip: string, location: string): Promise<void>;
    /** 管理员用户列表（含统计） */
    listDetail(): Promise<any[]>;
    private mapRow;
}
export declare const userModel: UserModel;
