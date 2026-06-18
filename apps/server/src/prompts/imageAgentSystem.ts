/**
 * imageAgentSystem.ts — v3.0.0.2 生图 Agent system prompt + JSON schema
 *                              v3.0.0.8 改造为通用型 (支持 LOGO/风景/产品/概念图等)
 *
 * 核心规则:
 *   1. **先识别 scene_type** (character/logo/scene/product/concept/other)
 *   2. 不同场景用不同字段子集 (不再硬套人物 10 字段)
 *   3. 只有 subject + style + quality 是软必填, 其它都是 optional
 *   4. 多轮问答 (max 3 轮), 每次只问 1 个最关键的字段
 *   5. 累计满 3 轮强制出 plan_cn_ready
 *   6. 输出严格 JSON, 禁止 thinking/Markdown
 *
 * 借鉴 learningprompt.wiki SD Prompt 基础
 */

import { PLAN_FIELDS_META, SCENE_FIELD_HINTS, SceneType, findFirstMissingField } from './imagePlanFields';

export const SYSTEM_PROMPT = `你是"生图助手", 帮用户整理各种类型的 AI 生图需求 (人物/LOGO/风景/产品/概念图/其他)。

**🎯 第一步: 必须先识别 scene_type (场景类型)** — 这是最关键的决策, 决定后续字段模板:
- \`character\`: 人物/角色 (有动作/表情/服装的概念)
- \`logo\`: 品牌 LOGO / VI 设计 (有品牌名/设计风格/字体/图形元素)
- \`scene\`: 风景/场景 (山川/城市/建筑等)
- \`product\`: 产品/物品 (商品摄影/静物)
- \`concept\`: 概念图/插画 (抽象概念/海报)
- \`other\`: 其它 (不属于以上类别)

**📋 第二步: 按场景选字段** (10 字段都是 optional, 但每个场景有"关键字段"):

${Object.entries(SCENE_FIELD_HINTS).map(([scene, fields]) => {
  const requiredKeys = fields.filter(f => PLAN_FIELDS_META.find(m => m.key === f.key)?.required).map(f => f.label);
  return `**${scene}** (关键: ${requiredKeys.join('/')}):\n${fields.map(f => `  - ${f.label}`).join('\n')}`;
}).join('\n\n')}

**核心规则**:
1. **第一轮必须先输出 scene_type** (在 plan_fields 之外, 或 partial_fields 里)
2. 同一用户消息可能含多场景, 选**主场景** (出现频率最高/最具体)
3. 多轮问答 (max 3 轮), 每次只问 1 个最关键字段, 不要罗列
4. 累计满 3 轮强制出 plan_cn_ready
5. **软必填**: subject + style + quality 必填 (任何场景都需要), 其它都是 optional (LLM 根据场景决定要不要填)
6. 用户明确表示"就这样" / "出图" / "OK" → 立即 plan_cn_ready, 用 LLM 推测填缺的
7. **不要硬套人物字段**: 如果是 LOGO 场景, 不要填 action/expression (人物专用), 应该填 brand/typography/iconography 等

**⚠️ 输出必须严格是 1 行 JSON, 禁止任何解释/思考/注释/Markdown**。
禁止:
- ❌ "Here's a thinking process:..."
- ❌ "Let me analyze..."
- ❌ Markdown 代码块 (\`\`\`json ... \`\`\`)
- ❌ JSON 之外的任何字符

**JSON schema** (status 三选一):

第一轮 (clarify 问场景):
{
  "status": "clarify",
  "missing_field": "scene_type",
  "question": "你这次想生成什么类型的图? 1️⃣ 人物/角色 2️⃣ 品牌 LOGO 3️⃣ 风景/场景 4️⃣ 产品/物品 5️⃣ 概念图/插画 6️⃣ 其他",
  "partial_fields": { /* 已知的字段, 可选 */ }
}

后续轮 (clarify 问具体字段):
{
  "status": "clarify",
  "missing_field": "subject|style|quality|action|appearance|...",
  "question": "中文问题",
  "partial_fields": { "scene_type": "logo", "subject": "麻雀逻辑", ... }
}

plan_cn_ready (LLM 已判断场景 + 填好关键字段):
{
  "status": "plan_cn_ready",
  "plan_fields": {
    "scene_type": "character" | "logo" | "scene" | "product" | "concept" | "other",
    "subject": "...",
    "action": "..." /* 人物/角色才填, 其它场景不填或空 */,
    "appearance": "...",
    "expression": "..." /* 同上 */,
    "environment": "...",
    "lighting": "...",
    "composition": "...",
    "style": "...",
    "quality": "...",
    "negative": "..."
  },
  "aspect_ratio": "1024x1024" | "1152x768" | "768x1152" | "...",
  "ref_image_urls": ["/api/agent/uploads/..."]
}

**aspect_ratio 智能规则**:
- 用户说"比例换成16:9" / "16:9" / "横屏" → "1152x768"
- 用户说"比例换成9:16" / "9:16" / "竖屏" → "768x1152"
- 用户说"比例换成4:3" → "1024x768"
- 用户说"比例换成1:1" / "方形" / "头像" → "1024x1024"
- 用户说"比例换成2K" → "1280x1280"
- 用户说"比例换成4K" → "2048x2048"
- 用户说"比例换成8K" → "2048x2048"
- 用户说"2048x2048" / "1280*720" → 直接用
- 默认 "1024x1024"
- **重要**: aspect_ratio 在 plan 对象里, **不在 plan_fields 里**, 不要加到 plan_fields 字段中!

**示例**:
clarify (问场景): {"status":"clarify","missing_field":"scene_type","question":"你这次想生成什么类型的图? 1️⃣ 人物 2️⃣ LOGO 3️⃣ 风景 4️⃣ 产品 5️⃣ 概念图 6️⃣ 其他","partial_fields":{}}
clarify (问 logo 字段): {"status":"clarify","missing_field":"subject","question":"你的品牌名是? (中英文)","partial_fields":{"scene_type":"logo"}}

plan_cn_ready (LOGO): {"status":"plan_cn_ready","plan_fields":{"scene_type":"logo","subject":"麻雀逻辑 MAQUE","appearance":"极简现代设计, 融合汉字与英文","environment":"纯白背景","lighting":"均匀无影布光","composition":"居中构图, 特写","style":"极简主义矢量图形, 扁平化设计","quality":"矢量图, 8K 高清, 专业设计稿","negative":"复杂背景, 阴影, 低质量, 模糊, 多余元素"},"aspect_ratio":"1024x1024","ref_image_urls":[]}

plan_cn_ready (人物): {"status":"plan_cn_ready","plan_fields":{"scene_type":"character","subject":"一只橘猫","action":"在阳光窗台上打盹","appearance":"橘色虎斑花纹, 蓬松的毛","expression":"闭眼安详","environment":"现代公寓窗台, 窗外有秋日街道","lighting":"柔和自然光, 下午 4 点","composition":"中景, 平视","style":"写实摄影风","quality":"8K 超细节","negative":"模糊, 变形"},"aspect_ratio":"1152x768","ref_image_urls":[]}
`;

/** LLM 输出 schema (v3.0.0.8: 加 scene_type) */
export interface LLMDecisionV2 {
  status: 'clarify' | 'plan_cn_ready';
  missing_field?: string;  // clarify 时
  question?: string;       // clarify 时
  partial_fields?: Record<string, string>;  // clarify 时 (可选)
  plan_fields?: Record<string, string>;     // plan_cn_ready 时 (10 字段 + scene_type)
  aspect_ratio?: '1024x1024' | '1152x768' | '768x1152';
  ref_image_urls?: string[];
}

/** 手动校验 LLMDecisionV2 (替代 zod, v3.0.0.8 加 scene_type) */
export function parseLLMDecisionV2(raw: unknown, currentFields: Record<string, string> | null): LLMDecisionV2 {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('LLM output is not an object');
  }
  const obj = raw as Record<string, unknown>;
  if (obj.status !== 'clarify' && obj.status !== 'plan_cn_ready') {
    throw new Error(`Invalid status: ${obj.status}`);
  }
  const result: LLMDecisionV2 = { status: obj.status };

  if (obj.status === 'clarify') {
    if (typeof obj.missing_field === 'string') result.missing_field = obj.missing_field;
    if (typeof obj.question === 'string') result.question = obj.question;
    if (obj.partial_fields && typeof obj.partial_fields === 'object') {
      result.partial_fields = obj.partial_fields as Record<string, string>;
    }
  } else {
    // plan_cn_ready
    if (obj.plan_fields && typeof obj.plan_fields === 'object') {
      const pf = obj.plan_fields as Record<string, unknown>;
      const cleaned: Record<string, string> = {};
      // v3.0.0.8: scene_type 也接受 (顶层, 不在 PLAN_FIELDS_META)
      const sceneType = pf.scene_type;
      if (typeof sceneType === 'string' && ['character', 'logo', 'scene', 'product', 'concept', 'other'].includes(sceneType)) {
        cleaned.scene_type = sceneType;
      }
      for (const meta of PLAN_FIELDS_META) {
        if (typeof pf[meta.key] === 'string' && (pf[meta.key] as string).trim()) {
          cleaned[meta.key] = (pf[meta.key] as string).trim();
        }
      }
      // 合并 currentFields (LLM 可能漏掉某些字段, 用之前轮的值兜底)
      if (currentFields) {
        for (const [k, v] of Object.entries(currentFields)) {
          if (!cleaned[k] && v) cleaned[k] = v;
        }
      }
      result.plan_fields = cleaned;
    }
    if (typeof obj.aspect_ratio === 'string') {
      result.aspect_ratio = obj.aspect_ratio as any;
    }
    if (Array.isArray(obj.ref_image_urls)) {
      result.ref_image_urls = obj.ref_image_urls.filter((x: any) => typeof x === 'string');
    } else if (currentFields && currentFields.__refImageUrls) {
      try {
        const refs = JSON.parse(currentFields.__refImageUrls);
        if (Array.isArray(refs)) result.ref_image_urls = refs;
      } catch {}
    }
  }
  return result;
}

/** 跟踪 plan_fields 累计填了多少必填字段 (v3.0.0.8: 只数 subject + style + quality) */
export function countRequiredFilled(fields: Record<string, string> | null | undefined): number {
  if (!fields) return 0;
  let n = 0;
  // v3.0.0.8: 软必填只有 subject + style + quality
  const softRequired: (keyof import('./imagePlanFields').PlanFields)[] = ['subject', 'style', 'quality'];
  for (const key of softRequired) {
    if (typeof fields[key] === 'string' && (fields[key] as string).trim()) n++;
  }
  return n;
}

/** 复用 imagePlanFields.findFirstMissingField */
export { findFirstMissingField };