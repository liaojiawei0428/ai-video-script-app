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

// v3.0.31 (S69 BUG-072 A): 角色三视图 + 镜头图, ¥0.1/张 (GLM-Image 第三方按张收费), 普通/VIP 同价, 无日限额
export const CHARACTER_VARIANT_PRICE = 0.1;

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
    let refType: string;
    let refLabel: string;
    if (stage === 'shot') {
      amount = p.shot;
      desc = '分镜生成';
      refType = 'shot';
      refLabel = `分镜分析《${novel.title}》`;
    } else if (stage === 'comic') {
      amount = Math.round(p.comic * pageCount * 100) / 100;
      desc = `漫画生成 (${pageCount}页)`;
      refType = 'comic';
      refLabel = `漫画生成《${novel.title}》(${pageCount}页)`;
    } else if (stage === 'analyze') {
      amount = Math.max(PRICING.minCharge, Math.round(wordCount * p.analyze * 100) / 100);
      desc = '小说分析';
      refType = 'novel_analyze';
      refLabel = `小说分析《${novel.title}》(${wordCount}字)`;
    } else {
      amount = Math.max(PRICING.minCharge, Math.round(wordCount * p.analyze * 100) / 100);
      desc = '剧本生成';
      refType = 'episode';
      refLabel = `剧本生成《${novel.title}》`;
    }

    if (balance < amount) return false;

    // v3.0.32 BUG-078 S71: 走统一 recordConsumption 入口 (含 is_free / ref_type / ref_id / ref_label)
    const result = await this.recordConsumption(novel.userId, {
      refType, refId: novelId, refLabel, amount,
      description: desc, wordCount, pageCount, novelId,
    });
    if (!result) return false;
    logger.info('Billing: charge', { novelId, userId: novel.userId, stage, amount, balanceAfter: result.balanceAfter });
    websocketService.broadcastBalanceUpdate(novelId, result.balanceAfter);
    return true;
  }

  async topUp(userId: string, amount: number, description: string): Promise<{ balanceAfter: number; logId: string }> {
    const logId = generateUUID();
    const user = await userModel.findById(userId);
    const balanceAfter = Math.round(((user?.balance || 0) + amount) * 100) / 100;
    await userModel.updateBalance(userId, amount);
    // v3.0.32 BUG-078 S71: 充值也用统一入口
    await execute(
      `INSERT INTO billing_logs (id, user_id, type, amount, balance_after, novel_id, description, word_count, is_free, ref_type, ref_id, ref_label, created_at)
       VALUES (?, ?, 'charge', ?, ?, '', ?, 0, 0, 'recharge', '', ?, ?)`,
      [logId, userId, amount, balanceAfter, description, Date.now()]
    );
    logger.info('Billing: top-up', { userId, amount, balanceAfter });
    return { balanceAfter, logId };
  }

  /**
   * v3.0.32 BUG-078 S71: 统一记录消费/免费日志 (web 账单明细核心)
   * 所有生成服务 (novel analyze / episode / shot / comic / character variant / image / video / prompt optimize) 都走这个入口
   * - amount=0 时: 免费额度内 / VIP免费 / 活动赠送, is_free=1
   * - amount>0 时: 实际扣费, is_free=0
   * @returns { balanceAfter, logId, isFree } 或 null (余额不足)
   */
  async recordConsumption(userId: string, opts: {
    refType: 'novel_analyze' | 'episode' | 'shot' | 'comic' | 'character_variant' | 'image' | 'video' | 'prompt_optimize' | 'recharge' | 'refund' | string;
    refId: string;
    refLabel: string;
    amount: number;
    isFree?: boolean;
    description?: string;
    wordCount?: number;
    pageCount?: number;
    novelId?: string;
  }): Promise<{ balanceAfter: number; logId: string; isFree: boolean } | null> {
    const { refType, refId, refLabel, amount } = opts;
    const isFree = !!(opts.isFree || amount === 0);
    if (amount < 0) throw new Error('amount must be >= 0');
    const user = await userModel.findById(userId);
    const balance = user?.balance || 0;
    // 收费时才检查余额 (免费的不扣钱, 直接通过)
    if (amount > 0 && balance < amount) return null;
    const logId = generateUUID();
    const balanceAfter = Math.round((balance - amount) * 100) / 100;
    if (amount > 0) {
      await userModel.updateBalance(userId, -amount);
    }
    await execute(
      `INSERT INTO billing_logs
        (id, user_id, type, amount, balance_after, novel_id, description, word_count,
         is_free, ref_type, ref_id, ref_label, created_at)
       VALUES (?, ?, 'consumption', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId, userId, amount, balanceAfter,
        opts.novelId || '',
        opts.description || refLabel,
        opts.wordCount || 0,
        isFree ? 1 : 0,
        refType,
        refId,
        refLabel,
        Date.now(),
      ]
    );
    logger.info('Billing: recordConsumption', {
      userId, refType, refId, refLabel, amount, isFree, balanceAfter,
    });
    if (opts.novelId || refId) {
      try { websocketService.broadcastBalanceUpdate(opts.novelId || refId, balanceAfter); } catch {}
    }
    return { balanceAfter, logId, isFree };
  }

  /**
   * v3.0.32 BUG-078 S71: web 端账单明细 API (含充值 + 消费 + 免费)
   * @param userId 用户 ID
   * @param opts { limit, offset, type?, refType? } 筛选
   */
  async getTransactions(userId: string, opts: { limit?: number; offset?: number; type?: string; refType?: string } = {}): Promise<{ items: BillingLog[]; total: number }> {
    const limit = Math.min(opts.limit || 50, 200);
    const offset = opts.offset || 0;
    const where: string[] = ['user_id = ?'];
    const params: any[] = [userId];
    if (opts.type) { where.push('type = ?'); params.push(opts.type); }
    if (opts.refType) { where.push('ref_type = ?'); params.push(opts.refType); }
    const whereSql = where.join(' AND ');

    const totalRow = await queryOne<any>(
      `SELECT COUNT(*) AS cnt FROM billing_logs WHERE ${whereSql}`, params
    );
    const total = totalRow?.cnt || 0;

    const rows = await poolQuery<any>(
      `SELECT * FROM billing_logs WHERE ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const items: BillingLog[] = rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      amount: parseFloat(r.amount),
      balanceAfter: parseFloat(r.balance_after),
      novelId: r.novel_id || '',
      description: r.description || '',
      wordCount: r.word_count || 0,
      isFree: r.is_free || 0,
      refType: r.ref_type || '',
      refId: r.ref_id || '',
      refLabel: r.ref_label || '',
      createdAt: r.created_at,
    }));
    return { items, total };
  }

  /**
   * v3.0.31 (S69 BUG-072 B): 用户今日已成功生图数 (UNION 3 表)
   * 1. image_generations JOIN image_conversations (S51 原有, t2i/i2i/multiRef 生图)
   * 2. characters JOIN novels (角色三视图, characterService.generateImageVariants, characters 表没 user_id, JOIN novels)
   * 3. shots JOIN episodes JOIN novels (镜头图, characterService.generateImageForShot)
   * created_at >= 今天 0 点
   */
  async imageDailyCount(userId: string): Promise<number> {
    const start = todayStartMs();
    const row = await queryOne<any>(
      `SELECT (
         (SELECT COUNT(*) FROM image_generations ig
          JOIN image_conversations ic ON ig.conversation_id = ic.id
          WHERE ic.user_id = ? AND ig.status = 'completed' AND ig.created_at >= ?)
         +
         (SELECT COUNT(*) FROM characters c
          JOIN novels n ON c.novel_id = n.id
          WHERE n.user_id = ? AND c.image_generated_at IS NOT NULL AND c.image_generated_at >= ?)
         +
         (SELECT COUNT(*) FROM shots s
          JOIN episodes e ON s.episode_id = e.id
          JOIN novels n ON e.novel_id = n.id
          WHERE n.user_id = ? AND s.image_generated_at IS NOT NULL AND s.image_generated_at >= ?)
       ) as cnt`,
      [userId, start, userId, start, userId, start]
    );
    return row?.cnt || 0;
  }

  /**
   * v3.0.31 (S69 BUG-072 B): 检查用户生图配额 (供 characterService 调, 普通用户超 30 抛错)
   * VIP 无限 (Infinity)
   */
  async checkImageQuota(userId: string): Promise<{ allowed: boolean; used: number; quota: number | 'unlimited' }> {
    const user = await userModel.findById(userId);
    const vip = isVipActive(user);
    if (vip) return { allowed: true, used: 0, quota: 'unlimited' };
    const used = await this.imageDailyCount(userId);
    const quota = IMAGE_DAILY_QUOTA_STANDARD;
    return { allowed: used < quota, used, quota };
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
  async chargeImage(userId: string, amount: number, description: string, conversationId?: string, refType: string = 'image', refLabel?: string): Promise<{ balanceAfter: number; logId: string } | null> {
    const result = await this.recordConsumption(userId, {
      refType, refId: conversationId || '',
      refLabel: refLabel || description,
      amount, description,
    });
    if (!result) return null;
    return { balanceAfter: result.balanceAfter, logId: result.logId };
  }

  /**
   * v3.0.0.31 (S51): 视频扣费 (按 chargingForVideo 矩阵)
   * v3.0.32 BUG-078 S71: 走统一 recordConsumption 入口
   * @returns balanceAfter 或 null (余额不足)
   */
  async chargeVideo(userId: string, durationSec: number, isVip: boolean, conversationId?: string): Promise<{ balanceAfter: number; chargedAmount: number; logId: string } | null> {
    const amount = chargingForVideo(isVip, durationSec);
    const refLabel = `视频生成 ${durationSec}s (${isVip ? 'VIP' : '普通'})`;
    const result = await this.recordConsumption(userId, {
      refType: 'video', refId: conversationId || '', refLabel, amount,
      description: refLabel,
    });
    if (!result) return null;
    return { balanceAfter: result.balanceAfter, chargedAmount: amount, logId: result.logId };
  }

  /**
   * S72 v3.0.33 P0 #2 修复 (ADR-0002): 异常时回滚扣费
   * 退费 = 加钱到 user_balance + 写 billing_logs (type='refund', schema enum 已支持)
   * 注意: 只在最外层 catch 调用, 避免嵌套退费双倍
   * @returns true=成功退费 / false=无 novel.userId 跳过
   */
  async refundStep(novelId: string, stage: 'analyze' | 'episode' | 'shot' | 'comic', wordCount: number = 0, pageCount: number = 1): Promise<boolean> {
    const novel = await novelModel.findById(novelId);
    if (!novel?.userId) return false;
    const user = await userModel.findById(novel.userId);
    const vip = isVipActive(user);
    const p = vip ? PRICING.vip : PRICING.standard;

    let amount: number;
    let desc: string;
    let refType: string;
    if (stage === 'shot') {
      amount = p.shot;
      desc = '分镜生成退款';
      refType = 'shot';
    } else if (stage === 'comic') {
      amount = Math.round(p.comic * pageCount * 100) / 100;
      desc = `漫画生成退款 (${pageCount}页)`;
      refType = 'comic';
    } else if (stage === 'analyze') {
      amount = Math.max(PRICING.minCharge, Math.round(wordCount * p.analyze * 100) / 100);
      desc = '小说分析退款';
      refType = 'novel_analyze';
    } else {
      amount = Math.max(PRICING.minCharge, Math.round(wordCount * p.analyze * 100) / 100);
      desc = '剧本生成退款';
      refType = 'episode';
    }

    // 退费: 加钱到 user_balance + 写 billing_logs (type='refund')
    const logId = generateUUID();
    const balanceAfter = Math.round(((user?.balance || 0) + amount) * 100) / 100;
    await userModel.updateBalance(novel.userId, amount);
    await execute(
      `INSERT INTO billing_logs (id, user_id, type, amount, balance_after, novel_id, description, word_count, is_free, ref_type, ref_id, ref_label, created_at)
       VALUES (?, ?, 'refund', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [logId, novel.userId, amount, balanceAfter, novelId, desc, wordCount, refType, novelId, `退款: ${desc}`, Date.now()]
    );
    logger.info('Billing: refund', { novelId, userId: novel.userId, stage, amount, balanceAfter });
    try { websocketService.broadcastBalanceUpdate(novelId, balanceAfter); } catch {}
    return true;
  }
}

export const billingService = new BillingService();
