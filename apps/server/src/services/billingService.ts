import { execute, poolQuery, queryOne } from '../models/db';
import { userModel } from '../models/user';
import { novelModel } from '../models/novel';
import { taskJobModel } from '../models/taskJob';
import { websocketService } from './websocket';
import { generateUUID } from '../shared/utils';
import { BillingLog } from '../shared/types';
import { logger } from '../utils/logger';

/** 定价标准 */
const PRICING = {
  standard: {
    analyze: 0.012 / 1000,  // ¥0.012/千字 → 分析+剧本阶段按字数计费
    shot: 0.05,              // ¥0.05/集
    comic: 0.10,             // ¥0.10/页 (分镜漫画 — 预存, 跟 line 69-82 兼容)
  },
  vip: {
    analyze: 0.01 / 1000,   // ¥0.01/千字
    shot: 0.04,              // ¥0.04/集
    comic: 0.08,             // ¥0.08/页 VIP
  },
  minCharge: 0.01,
};

// v3.0.0.31 (S51): 平台定价 — 视频按 duration 计费 (替代原 0.05/sec)
// 矩阵: VIP 5s+10s=免费, 15s=0.1; 普通 5s=免费, 10s=0.1, 15s=0.1
export const VIDEO_CHARGING_MATRIX = {
  standard: { 5: 0, 10: 0.1, 15: 0.1 },
  vip:       { 5: 0, 10: 0,   15: 0.1 },
} as const;

// v3.0.0.31 (S51): 普通用户生图日限额
export const IMAGE_DAILY_QUOTA_STANDARD = 30;
export const IMAGE_DAILY_QUOTA_VIP = Infinity;

/**
 * v3.0.0.31 (S51): 视频计费查表
 * @param isVip true=VIP 5s+10s 免费, 15s 仍 0.1; false=普通 5s 免费, 10s+15s 各 0.1
 * @param durationSec 视频时长秒 (5/10/15, 兜底 15)
 */
export function chargingForVideo(isVip: boolean, durationSec: number): number {
  const matrix = isVip ? VIDEO_CHARGING_MATRIX.vip : VIDEO_CHARGING_MATRIX.standard;
  if (durationSec in matrix) return matrix[durationSec as 5 | 10 | 15];
  // 兜底: 不在白名单的 (e.g. 7/12) 用最接近的白名单值
  const allowed = [5, 10, 15] as const;
  const closest = allowed.reduce((prev, cur) =>
    Math.abs(cur - durationSec) < Math.abs(prev - durationSec) ? cur : prev
  );
  return matrix[closest];
}

/**
 * v3.0.0.31 (S51): VIP 状态检查 (export, 让 image/video agent 调)
 */
export function isVipActive(user: any): boolean {
  if ((user?.vipLevel || 0) < 1) return false;
  if (!user?.vipExpiresAt) return true; // 老数据没有过期时间视为永久
  return Date.now() < user.vipExpiresAt;
}

/** v3.0.0.31 (S51): 获取今天 0 点 timestamp (ms) */
function todayStartMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export class BillingService {

  /** 获取用户定价档位 */
  async getUserPricing(userId: string): Promise<{ isVip: boolean; unitPrice: number; shotPrice: number; comicPrice: number }> {
    const user = await userModel.findById(userId);
    const vip = isVipActive(user);
    const p = vip ? PRICING.vip : PRICING.standard;
    return { isVip: vip, unitPrice: p.analyze * 1000, shotPrice: p.shot, comicPrice: p.comic };
  }

  getPricing(): typeof PRICING & { slogan: string; breakup: any } {
    return {
      ...PRICING,
      slogan: '分析+剧本按字数，分镜按集数，漫画按页',
      breakup: {
        standard: { analyze: (PRICING.standard.analyze * 1000).toFixed(4) + '/千字', shot: PRICING.standard.shot + '/集', comic: PRICING.standard.comic + '/页' },
        vip: { analyze: (PRICING.vip.analyze * 1000).toFixed(4) + '/千字', shot: PRICING.vip.shot + '/集', comic: PRICING.vip.comic + '/页' },
      },
    };
  }

  /** 预估费用 */
  async estimate(novelId: string, totalChars: number, totalEpisodes: number): Promise<{
    analyzeFee: number; shotFee: number; total: number; balance: number; isVip: boolean;
  }> {
    const novel = await novelModel.findById(novelId);
    const user = novel?.userId ? await userModel.findById(novel.userId) : null;
    const vip = isVipActive(user);
    const p = vip ? PRICING.vip : PRICING.standard;
    const analyzeFee = Math.max(PRICING.minCharge, Math.round(totalChars * p.analyze * 100) / 100);
    const shotFee = Math.round(totalEpisodes * p.shot * 100) / 100;
    const total = Math.round((analyzeFee + shotFee) * 100) / 100;
    return { analyzeFee, shotFee, total, balance: user?.balance || 0, isVip: vip };
  }

  /** 余额守门——调用 API 前检查余额，不足则强制停止并通知客户端 */
  async guardBalance(novelId: string, taskId: string, stage: 'analyze' | 'episode' | 'shot' | 'comic', wordCount: number = 0, pageCount: number = 1): Promise<void> {
    const novel = await novelModel.findById(novelId);
    const user = novel?.userId ? await userModel.findById(novel.userId) : null;
    const balance = user?.balance || 0;
    const vip = isVipActive(user);
    const p = vip ? PRICING.vip : PRICING.standard;

    let amount: number;
    let label: string;
    if (stage === 'shot') {
      amount = p.shot;
      label = '分镜生成';
    } else if (stage === 'comic') {
      amount = Math.round(p.comic * pageCount * 100) / 100;
      label = `漫画生成 (${pageCount}页)`;
    } else {
      amount = Math.max(PRICING.minCharge, Math.round(wordCount * p.analyze * 100) / 100);
      label = stage === 'analyze' ? '小说分析' : '剧本生成';
    }

    if (balance >= amount) return; // 余额充足，继续

    // ---- 余额不足，停止所有操作 ----
    const detail = `余额不足 (需 ¥${amount.toFixed(2)}，当前 ¥${balance.toFixed(2)})，请先充值后重试`;
    logger.warn(`Guard: balance insufficient`, { novelId, taskId, stage, amount, balance });

    websocketService.broadcastProgress(novelId, 0, 'error', { detail });
    websocketService.broadcastLlmUpdate(novelId, {
      phase: 'error', step: 'balance_insufficient',
      content: `❌ ${label}余额不足（需 ¥${amount.toFixed(2)}，余额 ¥${balance.toFixed(2)}），任务已暂停。请充值后重试。`,
      stream: false,
    });
    websocketService.broadcastBalanceUpdate(novelId, balance);

    // v2.5.15: 创建系统通知 (notify module 已迁移/缺, 暂时 skip, 不影响核心余额守门)
    // notify 模块暂不可用, 跳过

    await taskJobModel.fail(taskId, `${label}余额不足（需 ¥${amount.toFixed(2)}，余额 ¥${balance.toFixed(2)}）`);
    await novelModel.updateStatus(novelId, 'error');

    // 抛错终止当前操作
    throw new Error(`BALANCE_INSUFFICIENT: ${label} 需 ¥${amount.toFixed(2)}，余额 ¥${balance.toFixed(2)}`);
  }

  /** 实际扣费（余额守门通过后调用） */
  async chargeStep(novelId: string, stage: 'analyze' | 'episode' | 'shot' | 'comic', wordCount: number = 0, pageCount: number = 1): Promise<boolean> {
    const novel = await novelModel.findById(novelId);
    if (!novel?.userId) return true;
    const user = await userModel.findById(novel.userId);
    const balance = user?.balance || 0;
    const vip = isVipActive(user);
    const p = vip ? PRICING.vip : PRICING.standard;

    let amount: number;
    let desc: string;
    if (stage === 'shot') {
      amount = p.shot;
      desc = '分镜生成';
    } else if (stage === 'comic') {
      amount = Math.round(p.comic * pageCount * 100) / 100;
      desc = `漫画生成 (${pageCount}页)`;
    } else {
      amount = Math.max(PRICING.minCharge, Math.round(wordCount * p.analyze * 100) / 100);
      desc = stage === 'analyze' ? '分析阶段' : '剧本生成';
    }

    if (balance < amount) return false;

    const logId = generateUUID();
    const balanceAfter = Math.round((balance - amount) * 100) / 100;
    await userModel.updateBalance(novel.userId, -amount);
    await execute(
      `INSERT INTO billing_logs (id, user_id, type, amount, balance_after, novel_id, description, word_count, created_at)
       VALUES (?, ?, 'consumption', ?, ?, ?, ?, ?, ?)`,
      [logId, novel.userId, amount, balanceAfter, novelId, desc, wordCount, Date.now()]
    );
    logger.info('Billing: charge', { novelId, userId: novel.userId, stage, amount, balanceAfter });
    websocketService.broadcastBalanceUpdate(novelId, balanceAfter);
    return true;
  }

  async topUp(userId: string, amount: number, description: string): Promise<{ balanceAfter: number; logId: string }> {
    const logId = generateUUID();
    const user = await userModel.findById(userId);
    const balanceAfter = Math.round(((user?.balance || 0) + amount) * 100) / 100;
    await userModel.updateBalance(userId, amount);
    await execute(
      `INSERT INTO billing_logs (id, user_id, type, amount, balance_after, novel_id, description, word_count, created_at)
       VALUES (?, ?, 'charge', ?, ?, '', ?, 0, ?)`,
      [logId, userId, amount, balanceAfter, description, Date.now()]
    );
    logger.info('Billing: top-up', { userId, amount, balanceAfter });
    return { balanceAfter, logId };
  }

  async getLogs(userId: string, limit: number = 50): Promise<BillingLog[]> {
    const rows = await poolQuery<any>(
      'SELECT * FROM billing_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ' + limit, [userId]
    );
    return rows.map((r: any) => ({
      id: r.id, userId: r.user_id, type: r.type,
      amount: parseFloat(r.amount), balanceAfter: parseFloat(r.balance_after),
      novelId: r.novel_id || '', description: r.description || '',
      wordCount: r.word_count || 0, createdAt: r.created_at,
    }));
  }

  /**
   * v3.0.0.31 (S51): 用户今日已成功生图数
   * 查 image_generations JOIN image_conversations (拿 user_id), status='completed' 才算成功
   * created_at >= 今天 0 点
   */
  async imageDailyCount(userId: string): Promise<number> {
    const start = todayStartMs();
    const row = await queryOne<any>(
      `SELECT COUNT(*) as cnt FROM image_generations ig
       JOIN image_conversations ic ON ig.conversation_id = ic.id
       WHERE ic.user_id = ? AND ig.status = 'completed' AND ig.created_at >= ?`,
      [userId, start]
    );
    return row?.cnt || 0;
  }

  /**
   * v3.0.0.31 (S51): 用户今日已成功生成视频数
   * 查 video_generations JOIN video_conversations (拿 user_id), status='completed' 才算成功
   */
  async videoDailyCount(userId: string): Promise<number> {
    const start = todayStartMs();
    const row = await queryOne<any>(
      `SELECT COUNT(*) as cnt FROM video_generations vg
       JOIN video_conversations vc ON vg.conversation_id = vc.id
       WHERE vc.user_id = ? AND vg.status = 'completed' AND vg.created_at >= ?`,
      [userId, start]
    );
    return row?.cnt || 0;
  }

  /**
   * v3.0.0.31 (S51): 生图扣费 (现在免费 amount=0, 仍写 audit log)
   * @returns balanceAfter
   */
  async chargeImage(userId: string, amount: number, description: string, conversationId?: string): Promise<{ balanceAfter: number; logId: string } | null> {
    if (amount < 0) throw new Error('amount must be >= 0');
    const user = await userModel.findById(userId);
    const balance = user?.balance || 0;
    if (amount > 0 && balance < amount) return null;  // 余额不足
    const logId = generateUUID();
    const balanceAfter = Math.round((balance - amount) * 100) / 100;
    await userModel.updateBalance(userId, -amount);
    await execute(
      `INSERT INTO billing_logs (id, user_id, type, amount, balance_after, novel_id, description, word_count, created_at)
       VALUES (?, ?, 'consumption', ?, ?, ?, ?, 0, ?)`,
      [logId, userId, amount, balanceAfter, conversationId || '', description, Date.now()]
    );
    logger.info('Billing: chargeImage', { userId, amount, balanceAfter, description });
    if (conversationId) websocketService.broadcastBalanceUpdate(conversationId, balanceAfter);
    return { balanceAfter, logId };
  }

  /**
   * v3.0.0.31 (S51): 视频扣费 (按 chargingForVideo 矩阵)
   * @returns balanceAfter 或 null (余额不足)
   */
  async chargeVideo(userId: string, durationSec: number, isVip: boolean, conversationId?: string): Promise<{ balanceAfter: number; chargedAmount: number; logId: string } | null> {
    const amount = chargingForVideo(isVip, durationSec);
    if (amount < 0) throw new Error('amount must be >= 0');
    const user = await userModel.findById(userId);
    const balance = user?.balance || 0;
    if (amount > 0 && balance < amount) return null;  // 余额不足
    const logId = generateUUID();
    const balanceAfter = Math.round((balance - amount) * 100) / 100;
    const desc = `视频生成(${durationSec}s${isVip ? '/VIP' : '/普通'})`;
    await userModel.updateBalance(userId, -amount);
    await execute(
      `INSERT INTO billing_logs (id, user_id, type, amount, balance_after, novel_id, description, word_count, created_at)
       VALUES (?, ?, 'consumption', ?, ?, ?, ?, 0, ?)`,
      [logId, userId, amount, balanceAfter, conversationId || '', desc, Date.now()]
    );
    logger.info('Billing: chargeVideo', { userId, durationSec, isVip, amount, balanceAfter });
    if (conversationId) websocketService.broadcastBalanceUpdate(conversationId, balanceAfter);
    return { balanceAfter, chargedAmount: amount, logId };
  }
}

export const billingService = new BillingService();
