"use strict";
/**
 * imagePlanFields.ts — v3.0.0.13 极简版
 *
 * v3.0.0.13: 删 SCENE_FIELD_HINTS / SCENE_TYPE_LABELS (前端 UI 不再用)
 * v3.0.0.13: PlanFields 简化为只保留 subject + negative (实际只用这俩)
 * v3.0.0.13: SceneType 仍保留 type (供 imageAspectRatio 等模块引用), 但不再用 SCENE_FIELD_HINTS
 *
 * 历史:
 *   v3.0.0.2: 10 字段标准模板
 *   v3.0.0.8: 加 scene_type, 改通用型
 *   v3.0.0.13: 极简 passthrough, 不再依赖字段细节
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCENE_FIELD_HINTS = exports.PLAN_FIELDS_META = void 0;
exports.isCompletePlanFields = isCompletePlanFields;
exports.findFirstMissingField = findFirstMissingField;
exports.getFilledFields = getFilledFields;
exports.fieldsToChineseDescription = fieldsToChineseDescription;
const logger_1 = require("../utils/logger");
exports.PLAN_FIELDS_META = [
    // v3.0.0.13: 全部软必填, 只校验 subject (passthrough 必须有内容)
    { key: 'subject', label: '主体', required: true },
];
/** 校验关键必填字段 (passthrough 模式只检查 subject 非空) */
function isCompletePlanFields(fields) {
    if (!fields || typeof fields !== 'object')
        return false;
    return typeof fields.subject === 'string' && fields.subject.trim().length > 0;
}
/** 找第一个缺失的必填字段 (passthrough 模式只查 subject) */
function findFirstMissingField(fields) {
    if (!fields || !fields.subject || !String(fields.subject).trim()) {
        return 'subject';
    }
    return null;
}
/** 提取已填的字段 (passthrough 模式只输出 subject) */
function getFilledFields(fields) {
    if (!fields)
        return [];
    return exports.PLAN_FIELDS_META
        .filter(meta => fields[meta.key] && String(fields[meta.key]).trim().length > 0)
        .map(meta => ({ key: meta.key, label: meta.label, value: String(fields[meta.key]) }));
}
/** 把 fields 转成结构化中文描述 (passthrough 模式: 只输出 subject) */
function fieldsToChineseDescription(fields) {
    return (fields.subject || '').trim();
}
// ── SCENE_FIELD_HINTS 桩 ──
// v3.0.0.13 极简模式后已废弃 (前端 UI 不再用), 但 imageAgentSystem.ts 仍引用.
// 给空对象桩防 TS2305, LLM prompt 在极简模式不会真用 scene-specific hints.
// 真实"按场景选字段"逻辑在 imageAgentService.processTurn 内联判断, 不依赖这个常量.
// TODO: v3.1.0 删 imageAgentSystem.ts 引用, 同步删这个桩.
exports.SCENE_FIELD_HINTS = {
    character: [], logo: [], scene: [], product: [], concept: [], other: [],
};
// ── SCENE_FIELD_HINTS / SCENE_TYPE_LABELS 已删除 (前端不再用) ──
// 之前版本: UI 提示用, 字段子集按场景显示. 全部废弃.
// logger import 防 unused 警告
void logger_1.logger;
