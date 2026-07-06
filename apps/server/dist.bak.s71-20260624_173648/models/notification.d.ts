export interface Notification {
    id: string;
    userId: string;
    type: 'feedback_reply' | 'announcement' | 'system';
    title: string;
    content: string;
    isRead: boolean;
    relatedId: string;
    createdAt: number;
}
export declare class NotificationModel {
    create(userId: string, type: Notification['type'], title: string, content: string, relatedId?: string): Promise<Notification>;
    /** 给所有用户发公告 */
    createAnnouncement(title: string, content: string): Promise<number>;
    findByUserId(userId: string, limit?: number): Promise<Notification[]>;
    countUnread(userId: string): Promise<number>;
    markRead(id: string): Promise<void>;
    markAllRead(userId: string): Promise<void>;
    private mapRow;
}
export declare const notificationModel: NotificationModel;
