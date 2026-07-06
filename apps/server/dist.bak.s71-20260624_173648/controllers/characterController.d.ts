import { Request, Response, NextFunction } from 'express';
export declare const characterController: {
    /**
     * POST /api/novels/:novelId/characters/extract
     * 触发角色描述生成（异步执行, 完成后通过 WS 推送）
     */
    extract(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/novels/:novelId/characters
     * 列出小说所有角色
     */
    listByNovel(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/characters/:characterId
     * 查单个角色详情
     */
    getOne(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/characters/:characterId/confirm
     * 用户确认角色描述（只更新确认状态，不覆盖描述数据）
     */
    confirm(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/characters/:characterId/generate-images
     * 生成 3 张变体图（按张扣费）
     * Body: { onlyAngles?: ['front_bust', 'side_bust', 'full_body'] }
     */
    generateImages(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /api/shots/:shotId/generate-image
     * 镜头参考图生成（按张扣费）
     */
    generateShotImage(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /api/style-presets
     * 列出所有画风预设
     */
    listStylePresets(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * v2.5.35: POST /api/characters/fix-double-json
     * 一次性修复所有角色的双层 JSON 历史数据 (LLM 误返回的旧 11 字段 JSON 字符串)
     * 仅管理员可调用
     */
    fixDoubleJsonDescriptions(req: Request, res: Response, next: NextFunction): Promise<void>;
};
