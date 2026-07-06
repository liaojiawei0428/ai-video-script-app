import { Request, Response, NextFunction } from 'express';
export declare const imageAgentController: {
    /** POST /api/image-agent/conversations - 创建新会话 */
    createConversation(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /** POST /api/image-agent/chat - 处理一轮对话 (LLM 自适应) */
    chat(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /** v3.0.0.2: POST /api/image-agent/translate-plan - 中文方案 → 英文 prompt 翻译 */
    translatePlan(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /** v3.0.0.2: PUT /api/image-agent/plan-fields - 用户在 plan_cn_ready 状态下修改字段 */
    updatePlanFields(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /** POST /api/image-agent/confirm - 用户确认英文 prompt, 调 agnes image */
    confirm(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /** GET /api/image-agent/conversations - 历史会话 */
    history(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /** GET /api/image-agent/conversations/:id - 会话详情 (含 messages.parts) */
    getById(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /** v3.0.0.17: DELETE /api/image-agent/conversations/:id - 永久删除 (含 image_generations 审计)
     *  鉴权: 只能删自己的 (admin 可删任意, 暂不开) */
    deleteConversation(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
};
