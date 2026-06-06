// 角色一致性 v2.0 Controller
// 三阶段流程: 描述提取 → 用户确认 → 多角度变体图

import { Request, Response, NextFunction } from 'express';
import {
  extractDescriptions,
  confirmDescription,
  generateImageVariants,
  generateImageForShot,
  findCharacterById,
  listCharactersByNovel,
} from '../services/characterService';
import { logger } from '../utils/logger';
import { getMaintenance } from '../shared/maintenance';
import { StylePresetId } from '../shared/types';

function success(res: Response, data: unknown) {
  res.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (res.req as any).requestId,
    },
  });
}

function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({
    success: false,
    error: { code, message },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: (res.req as any).requestId,
    },
  });
}

export const characterController = {
  /**
   * POST /api/novels/:novelId/characters/extract
   * 触发角色描述生成（异步执行, 完成后通过 WS 推送）
   */
  async extract(req: Request, res: Response, next: NextFunction) {
    try {
      if (getMaintenance()) return fail(res, 503, 'MAINTENANCE', '系统维护中');

      const novelId = req.params.novelId;
      const userId = (req as any).userId;
      if (!novelId || !userId) return fail(res, 400, 'BAD_REQUEST', '缺少 novelId 或 userId');

      // 立即返回 202, 实际提取在后台进行
      res.status(202).json({
        success: true,
        data: { message: '角色描述生成已启动, 完成后将通过 WebSocket 通知', novelId },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
        },
      });

      // 后台执行
      setImmediate(async () => {
        try {
          const result = await extractDescriptions(novelId);
          logger.info('Character extract completed', { novelId, ...result });
        } catch (err) {
          logger.error('Character extract failed', { novelId, error: err });
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/novels/:novelId/characters
   * 列出小说所有角色
   */
  async listByNovel(req: Request, res: Response, next: NextFunction) {
    try {
      const novelId = req.params.novelId;
      if (!novelId) return fail(res, 400, 'BAD_REQUEST', '缺少 novelId');
      const characters = await listCharactersByNovel(novelId);
      return success(res, { characters, total: characters.length });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/characters/:characterId
   * 查单个角色详情
   */
  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const characterId = req.params.characterId;
      if (!characterId) return fail(res, 400, 'BAD_REQUEST', '缺少 characterId');
      const character = await findCharacterById(characterId);
      if (!character) return fail(res, 404, 'NOT_FOUND', '角色不存在');
      return success(res, character);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/characters/:characterId/confirm
   * 用户确认角色描述（只更新确认状态，不覆盖描述数据）
   */
  async confirm(req: Request, res: Response, next: NextFunction) {
    try {
      if (getMaintenance()) return fail(res, 503, 'MAINTENANCE', '系统维护中');
      const characterId = req.params.characterId;
      if (!characterId) return fail(res, 400, 'BAD_REQUEST', '缺少 characterId');
      const result = await confirmDescription(characterId, { description: {} as any, extraDescription: {} as any });
      return success(res, result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/characters/:characterId/generate-images
   * 生成 3 张变体图（按张扣费）
   * Body: { onlyAngles?: ['front_bust', 'side_bust', 'full_body'] }
   */
  async generateImages(req: Request, res: Response, next: NextFunction) {
    try {
      if (getMaintenance()) return fail(res, 503, 'MAINTENANCE', '系统维护中');
      const characterId = req.params.characterId;
      const userId = (req as any).userId;
      if (!characterId || !userId) return fail(res, 400, 'BAD_REQUEST', '缺少 characterId 或 userId');

      const { onlyAngles } = req.body || {};
      const result = await generateImageVariants(characterId, userId, { onlyAngles });
      return success(res, result);
    } catch (err: any) {
      if (err.message?.includes('余额不足')) {
        return fail(res, 402, 'INSUFFICIENT_BALANCE', err.message);
      }
      next(err);
    }
  },

  /**
   * POST /api/shots/:shotId/generate-image
   * 镜头参考图生成（按张扣费）
   */
  async generateShotImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (getMaintenance()) return fail(res, 503, 'MAINTENANCE', '系统维护中');
      const shotId = req.params.shotId;
      const userId = (req as any).userId;
      if (!shotId || !userId) return fail(res, 400, 'BAD_REQUEST', '缺少 shotId 或 userId');

      const result = await generateImageForShot(shotId, userId);
      return success(res, result);
    } catch (err: any) {
      if (err.message?.includes('余额不足')) {
        return fail(res, 402, 'INSUFFICIENT_BALANCE', err.message);
      }
      next(err);
    }
  },

  /**
   * GET /api/style-presets
   * 列出所有画风预设
   */
  async listStylePresets(req: Request, res: Response, next: NextFunction) {
    try {
      const { queryAll } = await import('../models/db');
      const rows = await queryAll<any>('SELECT * FROM style_presets ORDER BY sort_order');
      return success(res, { presets: rows });
    } catch (err) {
      next(err);
    }
  },
};
