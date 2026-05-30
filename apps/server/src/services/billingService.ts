import { execute, poolQuery, queryOne } from '../models/db';
import { userModel } from '../models/user';
import { novelModel } from '../models/novel';
import { websocketService } from './websocket';
import { generateUUID } from '../shared/utils';
import { BillingLog } from '../shared/types';
import { logger } from '../utils/logger';

/** 定价标准 */
const PRICING = {
  standard: {
    analyze: 0.012 / 1000,  // ¥0.012/千字 → 分析+剧本阶段按字数计费
    shot: 0.05,              // ¥0.05/集
  },
  vip: {
    analyze: 0.01 / 1000,   // ¥0.01/千字
    shot: 0.04,              // ¥0.04/集
  },
  minCharge: 0.01,
};

function isVipActive(user: any): boolean {
  if ((user?.vipLevel || 0) < 1) return false;
  if (!user?.vipExpiresAt) return true; // 老数据没有过期时间视为永久
  return Date.now() < user.vipExpiresAt;
}

export class BillingService {

  /** 获取用户定价档位 */
  async getUserPricing(userId: string): Promise<{ isVip: boolean; unitPrice: number; shotPrice: number }> {
    const user = await userModel.findById(userId);
    const vip = isVipActive(user);
    const p = vip ? PRICING.vip : PRICING.standard;
    return { isVip: vip, unitPrice: p.analyze * 1000, shotPrice: p.shot };
  }

  getPricing(): typeof PRICING & { slogan: string; breakup: any } {
    return {
      ...PRICING,
      slogan: '分析+剧本按字数，分镜按集数',
      breakup: {
        standard: { analyze: (PRICING.standard.analyze * 1000).toFixed(4) + '/千字', shot: PRICING.standard.shot + '/集' },
        vip: { analyze: (PRICING.vip.analyze * 1000).toFixed(4) + '/千字', shot: PRICING.vip.shot + '/集' },
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

  /** 按阶段扣费（核心方法） */
  async chargeStep(novelId: string, stage: 'analyze' | 'episode' | 'shot', wordCount: number = 0): Promise<boolean> {
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
}

export const billingService = new BillingService();
