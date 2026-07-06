/**
 * 通知工具 — 在错误/异常发生时自动创建系统通知
 *
 * 用法:
 *   import { notifyError, notifyWarning, notifyInfo } from './notify';
 *   notifyError(userId, '余额不足', '分镜生成需要 ¥0.05，当前余额 ¥0.03');
 *   notifyWarning(userId, '任务中断', '小说分析因网络异常中断，请重试');
 *   notifyInfo(userId, '生成完成', '《暴君的笼中雀》第3集分镜已生成');
 */
type NotifyType = 'system' | 'announcement' | 'feedback_reply';
/**
 * 创建通知并推送 WebSocket
 */
export declare function createNotification(userId: string, type: NotifyType, title: string, content: string, relatedId?: string): Promise<void>;
/** 错误通知 (余额不足/生成失败/API异常等) */
export declare function notifyError(userId: string, title: string, content: string, relatedId?: string): Promise<void>;
/** 警告通知 (任务中断/超时/部分失败等) */
export declare function notifyWarning(userId: string, title: string, content: string, relatedId?: string): Promise<void>;
/** 成功通知 (生成完成/导出完成等) */
export declare function notifySuccess(userId: string, title: string, content: string, relatedId?: string): Promise<void>;
/** 信息通知 (系统公告/功能更新等) */
export declare function notifyInfo(userId: string, title: string, content: string, relatedId?: string): Promise<void>;
export {};
