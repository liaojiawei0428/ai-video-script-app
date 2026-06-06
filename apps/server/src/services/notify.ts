/**
 * 通知工具 — 在错误/异常发生时自动创建系统通知
 *
 * 用法:
 *   import { notifyError, notifyWarning, notifyInfo } from './notify';
 *   notifyError(userId, '余额不足', '分镜生成需要 ¥0.05，当前余额 ¥0.03');
 *   notifyWarning(userId, '任务中断', '小说分析因网络异常中断，请重试');
 *   notifyInfo(userId, '生成完成', '《暴君的笼中雀》第3集分镜已生成');
 */

import { notificationModel } from '../models/notification';
import { websocketService } from './websocket';
import { logger } from '../utils/logger';

type NotifyType = 'system' | 'announcement' | 'feedback_reply';

function getPriority(type: NotifyType, title: string): 'low' | 'normal' | 'high' | 'urgent' {
  if (type === 'system') {
    if (title.includes('余额') || title.includes('失败') || title.includes('错误')) return 'high';
    if (title.includes('警告') || title.includes('中断')) return 'normal';
  }
  return 'normal';
}

/**
 * 创建通知并推送 WebSocket
 */
export async function createNotification(
  userId: string,
  type: NotifyType,
  title: string,
  content: string,
  relatedId: string = '',
): Promise<void> {
  try {
    const notification = await notificationModel.create(userId, type, title, content, relatedId);
    const priority = getPriority(type, title);

    // 通过 WebSocket 推送实时通知 (广播到所有连接, 客户端按 userId 过滤)
    websocketService.broadcastProgress('__notification__', 0, 'notification', {
      id: notification.id, title, content, type, priority, createdAt: notification.createdAt, userId,
    });

    logger.info('Notification created', { userId, type, title: title.slice(0, 50), priority });
  } catch (err) {
    logger.warn('Failed to create notification', { userId, type, title, error: err instanceof Error ? err.message : String(err) });
  }
}

/** 错误通知 (余额不足/生成失败/API异常等) */
export async function notifyError(userId: string, title: string, content: string, relatedId?: string) {
  return createNotification(userId, 'system', `❌ ${title}`, content, relatedId);
}

/** 警告通知 (任务中断/超时/部分失败等) */
export async function notifyWarning(userId: string, title: string, content: string, relatedId?: string) {
  return createNotification(userId, 'system', `⚠️ ${title}`, content, relatedId);
}

/** 成功通知 (生成完成/导出完成等) */
export async function notifySuccess(userId: string, title: string, content: string, relatedId?: string) {
  return createNotification(userId, 'system', `✅ ${title}`, content, relatedId);
}

/** 信息通知 (系统公告/功能更新等) */
export async function notifyInfo(userId: string, title: string, content: string, relatedId?: string) {
  return createNotification(userId, 'system', `ℹ️ ${title}`, content, relatedId);
}
