import { AgentMessage, AgentPart, AgentConversationStatus } from '../shared/types';
import { PlanFields } from '../prompts/imagePlanFields';
export interface ImageAgentProcessResult {
    conversationId: string;
    aiMessage: AgentMessage;
    status: AgentConversationStatus;
}
export declare class ImageAgentService {
    /** 创建新会话 */
    createConversation(userId: string): Promise<{
        conversationId: string;
        welcome: AgentMessage;
    }>;
    /** 处理一轮用户输入 — 极简 passthrough
     * v3.0.0.13: 删 LLM 提取字段/多轮问答, 用户发什么原文就 plan_cn_ready
     *   - 第一次: enPrompt = 用户原文 + 末尾 quality tags
     *   - modification (i2i): 沿用 i2i prompt 策略, confirm 阶段附加 last_result_url
     *   - aspectRatio: 优先 client 传的, 缺省 1024x1024
     */
    processTurn(conversationId: string, userInputParts: AgentPart[], aspectRatioFromClient?: string): Promise<ImageAgentProcessResult>;
    /** DEPRECATED: v3.0.0.16 极简模式后不再使用, 计划 v3.1.0 删除
     *  - 原 v3.0.0.13 流程: processTurn → plan_cn_ready → translatePlan → plan_ready
     *  - v3.0.0.16+: processTurn 直接 plan_ready, 前端 AgentChatPanel.confirmAndGenerate 也跳过 translatePlan
     *  - 但 routes/imageAgent.ts 仍挂载 POST /translate-plan, controller 仍调此方法
     *  - 现 processTurn 已不再返 plan_cn_ready, 状态检查会拒绝调用; 保留方法只为不破坏 API 契约
     *  - v3.1.0 cleanup: 删 routes/translate-plan + controller.translatePlan + 此方法
     */
    translatePlan(conversationId: string): Promise<{
        conversationId: string;
        status: AgentConversationStatus;
        enPrompt: string;
        cnDescription: string;
        negative: string;
        missingFields?: Array<{
            key: string;
            label: string;
        }>;
    }>;
    /** DEPRECATED: v3.0.0.16 极简模式后不再使用, 计划 v3.1.0 删除
     *  - 原 v3.0.0.2 流程: 用户在 plan_cn_ready 可手动改 10 字段, 然后重新 translatePlan
     *  - v3.0.0.16+: 极简 passthrough 删了 10 字段 UI (前端 AgentChatPanel 无 form 改动), 只能改 subject
     *  - routes/imageAgent.ts 仍挂载 PUT /plan-fields, controller 仍调此方法
     *  - 现 processTurn 已不再返 plan_cn_ready, 状态检查会拒绝调用; 保留方法只为不破坏 API 契约
     *  - v3.1.0 cleanup: 删 routes/plan-fields + controller.updatePlanFields + 此方法
     */
    updatePlanFields(conversationId: string, updates: Partial<PlanFields>): Promise<{
        conversationId: string;
        status: AgentConversationStatus;
        planFields: PlanFields;
    }>;
    /** v3.0.0.17: 用户确认 → 返 taskId (status: queued) + 后台 fire-and-forget 跑 agens image
     *  - 跟 video 一样的持久化模式: 用户关浏览器, 后台任务继续跑, DB 写好, 用户回来 GET conversation 看到结果
     *  - 不再同步 await agens (之前会让前端 hang 5-30s, 期间用户看不到 streaming 卡片, 关页面就 500)
     *  - 8K/4K bug fix: 用 parseAspectToDims 替代硬编码 if-else
     */
    confirm(conversationId: string): Promise<{
        taskId: string;
        status: 'queued';
        error?: string;
    }>;
    /** v3.0.0.17: 后台跑 agnes image 生成, 完成后写 DB
     *  - 跟 video 的 startPolling 类似, 但 image API 是同步返 URL, 不用轮询
     *  - 5min 超时 (跟 agnesImageProvider 内部一致)
     *  - 失败 → tool_failed + error_msg
     */
    private runImageGenerationBackground;
}
export declare const imageAgentService: ImageAgentService;
