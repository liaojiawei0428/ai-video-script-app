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
export interface PlanFields {
    scene_type?: string;
    subject: string;
    action?: string;
    appearance?: string;
    expression?: string;
    environment?: string;
    lighting?: string;
    composition?: string;
    style?: string;
    quality?: string;
    negative?: string;
}
export declare const PLAN_FIELDS_META: Array<{
    key: keyof PlanFields;
    label: string;
    required: boolean;
}>;
/** 校验关键必填字段 (passthrough 模式只检查 subject 非空) */
export declare function isCompletePlanFields(fields: any): fields is PlanFields;
/** 找第一个缺失的必填字段 (passthrough 模式只查 subject) */
export declare function findFirstMissingField(fields: Partial<PlanFields> | null | undefined): keyof PlanFields | null;
/** 提取已填的字段 (passthrough 模式只输出 subject) */
export declare function getFilledFields(fields: Partial<PlanFields> | null | undefined): Array<{
    key: keyof PlanFields;
    label: string;
    value: string;
}>;
/** 把 fields 转成结构化中文描述 (passthrough 模式: 只输出 subject) */
export declare function fieldsToChineseDescription(fields: PlanFields): string;
export type SceneType = 'character' | 'logo' | 'scene' | 'product' | 'concept' | 'other';
export declare const SCENE_FIELD_HINTS: Record<SceneType, Array<{
    key: string;
    label: string;
}>>;
