"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPassthroughPrompt = buildPassthroughPrompt;
exports.buildI2VModificationPrompt = buildI2VModificationPrompt;
exports.buildNegativePrompt = buildNegativePrompt;
exports.buildFinalEnglishPrompt = buildFinalEnglishPrompt;
exports.buildFinalEnglishPromptFromFields = buildFinalEnglishPromptFromFields;
exports.isCompletePlanFields = isCompletePlanFields;
exports.expandChineseDescription = expandChineseDescription;
exports.translateToEnglishPrompt = translateToEnglishPrompt;
/**
 * imagePromptBuilder.ts — v3.0.0.28 100% 原文 passthrough
 *
 * 策略: 用户发什么原文, plan.prompt 就是什么原文, 发给 agens 也是什么原文
 *   1. 删除: QUALITY_TAGS 末尾追加 (masterpiece, best quality 等)
 *   2. 删除: i2v Modification prefix ([Modification Mode] Based on the previous video...)
 *   3. 删除: LLM 翻译/扩写/模板
 *   4. 保留: DEFAULT_NEGATIVE (负向 prompt 约束, 跟原文分开)
 *
 * user 原话 = plan.prompt = 发给 agens 的 prompt
 */
const logger_1 = require("../utils/logger");
/** 负向 prompt 默认 (跟之前一致, 不再按 scene_type 分, 用户自填的会合并) */
const DEFAULT_NEGATIVE = [
    'blurry, low quality, low resolution',
    'deformed, disfigured, ugly',
    'extra fingers, extra limbs, mutated hands',
    'watermark, text, signature, logo',
    'cropped, out of frame',
].join(', ');
/** v3.0.0.28: 100% 原文 passthrough — 不追加任何 quality tags / i2v prefix */
function buildPassthroughPrompt(userText) {
    return (userText || '').trim();
}
/** v3.0.0.28: i2v modification 100% 原文 passthrough — 不加 [Modification Mode] prefix */
function buildI2VModificationPrompt(userText) {
    return (userText || '').trim();
}
/** 合并用户负向 + 默认负向 */
function buildNegativePrompt(userNegative) {
    const user = (userNegative || '').trim();
    if (!user)
        return DEFAULT_NEGATIVE;
    return `${user}, ${DEFAULT_NEGATIVE}`;
}
/** v3.0.0.28: 完整链路 — 用户原文 → enPrompt + negative (100% passthrough, 不调 LLM) */
function buildFinalEnglishPrompt(userText, userNegative = '') {
    const enPrompt = buildPassthroughPrompt(userText);
    const negative = buildNegativePrompt(userNegative);
    logger_1.logger.info('imagePromptBuilder: passthrough 100%', {
        userTextLen: (userText || '').length,
        enPromptLen: enPrompt.length,
    });
    return { enPrompt, negative };
}
/** 兼容旧调用: PlanFields 不再用, 只取 userText 字段 */
async function buildFinalEnglishPromptFromFields(fields) {
    const userText = (fields?.subject || '').toString();
    return buildFinalEnglishPrompt(userText, fields?.negative || '');
}
/** 兼容旧调用, 默认返回 true (不再做必填字段检查) */
function isCompletePlanFields(_fields) {
    return true;
}
/** 兼容旧调用, noop */
async function expandChineseDescription(_fields) {
    return '';
}
/** 兼容旧调用, noop */
async function translateToEnglishPrompt(_cnDescription) {
    return '';
}
