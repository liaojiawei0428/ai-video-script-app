import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userModel } from '../models/user';
import { generateUUID } from '../shared/utils';
import { config } from '../config';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'ai-script-jwt-secret-dev';
const JWT_EXPIRES = '365d';

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
        balance: 0,
        totalGenerations: 0,
        createdAt: now,
        updatedAt: now,
      };

      await userModel.create(user);

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

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

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

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

  async recharge(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false, error: { code: 'NOT_FOUND', message: '用户不存在' },
          meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        });
      }

      // 固定支付链接（可替换为真实支付渠道）
      const payUrl = process.env.RECHARGE_URL || 'https://example.com/recharge';

      res.json({
        success: true,
        data: {
          payUrl,
          balance: user.balance,
          message: '请在浏览器中打开链接完成支付',
        },
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
        data: {
          totalGenerations: user.totalGenerations,
          usageRecords: [],
        },
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      });
    } catch (error) {
      next(error);
    }
  },
};
