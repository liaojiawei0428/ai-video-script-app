import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { billingService } from '../services/billingService';
import { userModel } from '../models/user';
import { generateUUID } from '../shared/utils';
import { execute } from '../models/db';
import { config } from '../config';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-script-jwt-secret-dev';
const JWT_EXPIRES = '365d';
const PRICING_STD = 0.012 / 1000;
const PRICING_VIP = 0.01 / 1000;

function sanitizeUser(user: any) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export const userController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password, email, nickname } = req.body;
      if (!username || !password) {
        return res.status(400).json({
          success: false, error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }
      if (username.length < 2 || username.length > 50) {
        return res.status(400).json({
          success: false, error: { code: 'VALIDATION_ERROR', message: '用户名长度需在2-50个字符之间' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }
      if (password.length < 6) {
        return res.status(400).json({
          success: false, error: { code: 'VALIDATION_ERROR', message: '密码长度不能少于6位' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      const existing = await userModel.findByUsername(username);
      if (existing) {
        return res.status(409).json({
          success: false, error: { code: 'CONFLICT', message: '用户名已被注册' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      if (email) {
        const emailExisting = await userModel.findByEmail(email);
        if (emailExisting) {
          return res.status(409).json({
            success: false, error: { code: 'CONFLICT', message: '邮箱已被注册' },
            meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
          });
        }
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const now = Date.now();
      const user = {
        id: generateUUID(),
        username,
        email: email || undefined,
        passwordHash,
        nickname: nickname || username,
        avatarUrl: '',
        balance: 10,
        totalGenerations: 0,
        vipLevel: 0,
        role: 'user',
        createdAt: now,
        updatedAt: now,
  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { queryAll } = await import('../models/db');
      
      const rows = await queryAll<any>(
        `SELECT 
          n.id, n.title, n.total_chars, n.created_at,
          COALESCE(ep.cnt, 0) as episode_count,
          COALESCE(bl.cost, 0) as total_cost,
          COALESCE(tj.completed_at, n.updated_at) as completed_at
        FROM novels n
        LEFT JOIN (
          SELECT novel_id, COUNT(*) as cnt FROM episodes GROUP BY novel_id
        ) ep ON ep.novel_id = n.id
        LEFT JOIN (
          SELECT novel_id, ROUND(SUM(amount), 2) as cost 
          FROM billing_logs WHERE type = 'consumption' AND novel_id != '' 
          GROUP BY novel_id
        ) bl ON bl.novel_id = n.id
        LEFT JOIN (
          SELECT novel_id, MAX(completed_at) as completed_at 
          FROM task_jobs WHERE status = 'completed'
          GROUP BY novel_id
        ) tj ON tj.novel_id = n.id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT 50`,
        [userId]
      );

      const list = rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        totalChars: r.total_chars,
        episodeCount: r.episode_count,
        totalCost: parseFloat(r.total_cost || '0'),
        timeSpent: r.completed_at && r.created_at 
          ? Math.round((r.completed_at - r.created_at) / 1000) 
          : 0,
        createdAt: r.created_at,
      }));

      const totalNovels = await userModel.findById(userId).then(u => u?.totalGenerations || list.length);

      res.json({ success: true, data: { list, total: totalNovels } });
    } catch (err) { next(err); }
  },
};

      await userModel.create(user);

      const token = jwt.sign({ userId: user.id, role: user.role || 'user' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

      logger.info('User registered', { userId: user.id, username });

      res.status(201).json({
        success: true,
        data: { user: sanitizeUser(user), token },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({
          success: false, error: { code: 'VALIDATION_ERROR', message: '用户名和密码不能为空' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      const user = await userModel.findByUsername(username);
      if (!user) {
        return res.status(401).json({
          success: false, error: { code: 'AUTH_FAILED', message: '用户名或密码错误' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({
          success: false, error: { code: 'AUTH_FAILED', message: '用户名或密码错误' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      const token = jwt.sign({ userId: user.id, role: user.role || 'user' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

      logger.info('User logged in', { userId: user.id, username });

      res.json({
        success: true,
        data: { user: sanitizeUser(user), token },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false, error: { code: 'NOT_FOUND', message: '用户不存在' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      // 自动检查 VIP 是否过期
      if ((user.vipLevel || 0) >= 1 && user.vipExpiresAt && Date.now() > user.vipExpiresAt) {
        await userModel.updateVip(userId, 0, 0);
        (user as any).vipLevel = 0;
        (user as any).vipExpiresAt = undefined;
        logger.info('VIP expired for user', { userId, username: user.username });
      }

      res.json({
        success: true,
        data: { user: sanitizeUser(user) },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { nickname, avatarUrl } = req.body;

      await userModel.updateProfile(userId, { nickname, avatarUrl });

      const user = await userModel.findById(userId);

      res.json({
        success: true,
        data: { user: sanitizeUser(user) },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          success: false, error: { code: 'VALIDATION_ERROR', message: '旧密码和新密码不能为空' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false, error: { code: 'VALIDATION_ERROR', message: '新密码长度不能少于6位' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false, error: { code: 'NOT_FOUND', message: '用户不存在' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      const valid = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({
          success: false, error: { code: 'AUTH_FAILED', message: '旧密码错误' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await userModel.updatePassword(userId, passwordHash);

      res.json({
        success: true,
        data: { message: '密码修改成功' },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },

  async getPricing(req: Request, res: Response, next: NextFunction) {
    try {
      const pricing = billingService.getPricing();
      const userId = (req as any).userId;
      const user = await userModel.findById(userId);
      const now = Date.now();
      const isVip = (user?.vipLevel || 0) >= 1 && (!user?.vipExpiresAt || now < user.vipExpiresAt);
      const p = isVip ? PRICING_VIP : PRICING_STD;

      const calcFee = (wc: number) => Math.max(0.01, Math.round(wc * p * 100) / 100);

      res.json({
        success: true,
        data: {
          standardPrice: PRICING_STD * 1000,
          vipPrice: PRICING_VIP * 1000,
          unitLabel: '千字',
          shotStandard: 0.05,
          shotVip: 0.04,
          examples: {
            '10万字（~10集）': { analyze: calcFee(100000), shot: Math.round(10 * (isVip ? 0.04 : 0.05) * 100) / 100 },
            '50万字（~50集）': { analyze: calcFee(500000), shot: Math.round(50 * (isVip ? 0.04 : 0.05) * 100) / 100 },
            '100万字（~100集）': { analyze: calcFee(1000000), shot: Math.round(100 * (isVip ? 0.04 : 0.05) * 100) / 100 },
          },
          isVip,
          balance: user?.balance || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getBillingLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const logs = await billingService.getLogs(userId);
      res.json({
        success: true,
        data: { logs },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },

  async getUsage(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false, error: { code: 'NOT_FOUND', message: '用户不存在' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      res.json({
        success: true,
        data: { totalGenerations: user.totalGenerations, usageRecords: [] },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) { next(error); }
  },

  /** 购买 VIP */
  async buyVip(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const user = await userModel.findById(userId);
      if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '用户不存在' } });
      if ((user.vipLevel || 0) >= 1) return res.json({ success: false, error: { code: 'ALREADY_VIP', message: '已是VIP会员' } });

      const vipPrice = 10;
      if (user.balance < vipPrice) {
        return res.json({
          success: false,
          error: { code: 'INSUFFICIENT', message: `余额不足，VIP需 ¥${vipPrice}，当前余额 ¥${user.balance}。请先充值后再开通。` },
        });
      }

      const expiresAt = Date.now() + 365 * 24 * 3600 * 1000; // 1年后到期
      await userModel.updateVip(userId, 1, expiresAt);
      await userModel.updateBalance(userId, -vipPrice);

      const balanceAfter = Math.round((user.balance - vipPrice) * 100) / 100;
      await execute(
        `INSERT INTO billing_logs (id, user_id, type, amount, balance_after, description, created_at) VALUES (?, ?, 'consumption', ?, ?, 'VIP会员购买（1年有效）', ?)`,
        [generateUUID(), userId, vipPrice, balanceAfter, Date.now()]
      );

      res.json({ success: true, data: { message: 'VIP购买成功！', balance: balanceAfter, vipLevel: 1, vipExpiresAt: expiresAt } });
    } catch (err) { next(err); }
  },
};
