export interface Feedback {
    id: string;
    userId: string;
    username: string;
    content: string;
    contact: string;
    status: 'pending' | 'read' | 'replied';
    adminReply: string;
    createdAt: number;
    updatedAt: number;
}
export declare class FeedbackModel {
    create(userId: string, username: string, content: string, contact: string): Promise<Feedback>;
    findById(id: string): Promise<Feedback | undefined>;
    findByUserId(userId: string, limit?: number): Promise<Feedback[]>;
    findAll(limit?: number): Promise<Feedback[]>;
    findByStatus(status: string, limit?: number): Promise<Feedback[]>;
    updateStatus(id: string, status: 'pending' | 'read' | 'replied'): Promise<void>;
    reply(id: string, adminReply: string): Promise<void>;
    countByStatus(status: string): Promise<number>;
    countAll(): Promise<number>;
    private mapRow;
}
export declare const feedbackModel: FeedbackModel;
