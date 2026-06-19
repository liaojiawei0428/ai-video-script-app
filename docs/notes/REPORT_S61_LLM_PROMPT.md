# REPORT S61: 视频 Agent 加 LLM Prompt 优化层

**Session**: S61 (含 v1 + v2)
**Date**: 2026-06-19 (v1), 2026-06-20 (v2 分镜模式)
**Author**: Mavis (ai-script-server)
**Branch**: main
**Commit**: 5a279c1 (v1) + TBD (v2)
**Scope**: `apps/server/src/services/videoAgentService.ts` + `apps/server/src/prompts/videoAgentSystem.ts`

---

## 0. 版本演进

| 版本 | 日期 | 主要变更 |
|---|---|---|
| v1 | 2026-06-19 | 加 LLM 优化层（通用模式：中文 → 英文 + quality tags） |
| **v2** | **2026-06-20** | **加分镜脚本专用模式（保留字段/时间分段/对白/术语直译）** |

---

# PART I — v1 (2026-06-19 通用模式)

## 1. 背景

### 1.1 现状 (v3.0.0.28 之前)

shipin-APP 视频 Agent 走"极简 passthrough"模式 — 用户原文（包括中文）**100% 原样**转发给 `agnes-video-v2.0` 模型。

```ts
// v3.0.0.28 (S48) videoAgentService.ts:228
const finalPrompt = (userText || '').trim();
// 然后: prompt: finalPrompt.slice(0, 4000)
```

### 1.2 问题

`agnes-video-v2.0` 对**中文 prompt 理解力偏弱**。S49 实测过：
- EN trigger 词匹配率 ~85%
- ZH trigger 词匹配率 ~55% (降 30%+)

这导致：
- 中文用户提交后视频质量低（人物比例错、风格跑偏、动作不达意）
- 用户需要"自己写好 prompt"门槛高
- 转化率低（用户看不到好结果就流失）

### 1.3 决策

User 选 **A 方案：全量调 LLM 优化**（贵但最准）：
- 中/英/混合输入 → LLM 改写为结构化英文 prompt + quality tags
- LLM 失败/超时 → 100% passthrough 兜底
- 计费 ¥0.01/次（复用 `billingService.chargeImage`）

---

## 2. 设计 (v1)

### 2.1 System Prompt（`apps/server/src/prompts/videoAgentSystem.ts`）

LLM Role：视频 prompt engineer（翻译 + 结构化 + quality tags）

**输入**：用户原始 prompt（任意语言）
**输出**：优化后的英文 prompt，single paragraph，无 Markdown
**结构**：`[Subject][Action][Scene][Camera][Style]` 顺序自然句
**末尾追加**：`cinematic, professional cinematography, smooth camera motion, high quality, masterpiece, ultra-detailed`

**3 个内置 Example** 覆盖中文 / 中文带场景 / 英文原样。

### 2.2 调用流程

```
用户提交
  ↓
videoAgentService.processTurn()
  ├─ userText = partsToText(input)
  ├─ isModification = status==='tool_completed' (i2v 模式)
  │
  ├─ if (!isModification && userText.length >= 3) {
  │    try {
  │      agnesTextProvider.chatCompletion({
  │        messages: [system, user=userText],
  │        temperature: 0.7,
  │        maxTokens: 800,
  │        enableThinking: false  ← 简单翻译任务, 不跑 thinking
  │      })
  │      ⏱ 30s timeout (Promise.race)
  │
  │      if (output.length >= 5) {
  │        finalPrompt = llmOutput
  │        billingService.chargeImage(userId, 0.01, 'video prompt LLM 优化', convId)
  │        log 'prompt optimized by LLM'
  │      } else {
  │        log 'LLM output too short, fallback'
  │        finalPrompt = userText.trim() ← 兜底
  │      }
  │    } catch (err) {
  │      log 'LLM prompt optimization failed, fallback to original passthrough'
  │      finalPrompt = userText.trim() ← 兜底
  │    }
  │  } else {
  │    finalPrompt = userText.trim() ← i2v 模式跳过 LLM
  │  }
  │
  ↓
plan.prompt = finalPrompt.slice(0, 4000) ← 发给 agens
```

### 2.3 兜底策略（fail-safe）

| 失败场景 | 处理 |
|---|---|
| LLM API 报错 (5xx / 4xx) | catch → logger.warn → 用原文 passthrough |
| LLM 超时 (30s) | Promise.race reject → catch → 原文 passthrough |
| LLM 返空 / < 5 chars | 不用 LLM 输出 → 原文 passthrough |
| AGNES_API_KEY 未配 | `chatCompletion` 抛错 → catch → 原文 passthrough |
| i2v (modification) 模式 | **跳过 LLM**（用户期望"按指令改"，不要 LLM 加工） |

**视频生成流程永远不中断**，LLM 优化是 best-effort 增强。

### 2.4 计费

复用 `billingService.chargeImage(userId, amount, description, conversationId)`：
- `amount = 0.01`（注意：原本写 0.005，但 MySQL DECIMAL(10,2) 会自动 round half-up 到 0.01，等价 ¥0.01。直接写 0.01 避免误解）
- `description = 'video prompt LLM 优化'`
- `type = 'consumption'`
- **失败不阻塞**：try-catch 隔离，charge 失败仅 logger.warn

---

## 3. E2E 验证 (v1)

### 3.1 Test Case 1：中文 prompt → 英文优化

**Input**：`古风绿衣仙子站在桃花树下微风拂面`

**Output (plan.prompt)**：
```
An elegant Chinese fairy in flowing green traditional dress stands gracefully
beneath a blooming peach blossom tree, ...
cinematic, professional cinematography, smooth camera motion, high quality,
masterpiece, ultra-detailed
```

**Server log**：
```json
{
  "elapsedMs": 1965,
  "message": "VideoAgent: prompt optimized by LLM",
  "optimizedLen": 474,
  "originalLen": 16,
  "usage": {"completionTokens": 87, "promptTokens": 868, "totalTokens": 955}
}
```

✅ 中文翻译正确 + 结构化完整 + quality tags 追加 + 计费正常

---

# PART II — v2 (2026-06-20 分镜模式)

## 4. v2 背景与问题

### 4.1 v1 实测暴露的局限

v1 上线后，**专业分镜师用户**（用 shipin-APP 做严肃短剧分镜）反馈：
- 中文原文是**专业分镜脚本**（含 景别/构图/运镜/画面/灯光/色彩/音效/转场/对白 等字段）
- v1 LLM 翻译出来的英文把**专有名词丢了**（苏蓉蓉 → a woman）、**对白丢了**、**时间分段丢了**、**音效转场丢了**
- 翻译质量反而比"原文 passthrough"更差（v1 是 best-effort 增强，但实际降级）

### 4.2 真实案例对比

**User 中文原文** (495 chars)：
```
【镜头1 | 5秒】 景别：大远景 | 构图：三分法 运镜：航拍（缓缓下降俯拍宫道）
画面：夕阳如熔金倾泻，宫道蜿蜒延伸向远方。一辆凤鸾春恩车通体金黄，
在红墙间如玩具般精致移动，车顶金色流苏微晃，地面拉出纤长的影子（0-3秒）。
飞檐庑殿顶镀上橘红光泽，琉璃瓦在暮色中反射出梦幻般的HDRI光晕（3-5秒）。
灯光：夕阳逆光+暖色环境光 色彩：暖调+高饱和+高对比
音效：车轮辘辘碾压青砖声，远处钟楼悠远钟鸣，微风呜咽穿过宫墙 转场：溶解

【镜头2 | 4秒】 景别：近景 | 构图：中心构图 运镜：固定（慢速推近）
画面：春恩车内，苏蓉蓉侧面特写。光线透过雕花窗棂在她脸上投下斑驳光影。
她眉心朱砂痣如红宝石般闪耀，皮肤透着次表面散射的微光。
她睫毛微颤（0-2秒），冷汗从额头滑落（2-3秒），
眼中闪过慌乱和抗拒（3-4秒她闭眼，嘴唇微张，仿佛在默默祈祷。
对白：【苏蓉蓉（内心独白）】"我明明是个品学兼优的高三学生，连鸡都没杀过，怎么就要杀人！"
转场：硬切
```

**v1 LLM 翻译 (差评)**：
```
A majestic golden phoenix carriage travels along a winding palace corridor
bathed in melting sunset light, ... ultra-detailed
```
- ❌ 苏蓉蓉 → "a woman"（专有名词丢了）
- ❌ 朱砂痣 / 次表面散射 → 完全丢
- ❌ HDRI 光晕 → 简化
- ❌ 对白 100% 丢
- ❌ 时间分段 100% 丢（0-3s / 3-5s 合并）
- ❌ 音效 / 转场 100% 丢
- ❌ 凤鸾春恩车 / 飞檐庑殿顶 / 琉璃瓦 → 简化成 generic terms

### 4.3 根因

v1 system prompt 设计目标 = "普通用户一句话描述 → 结构化英文"。它主动**重构 + 简化**，反而稀释了专业分镜师的精确表达。

v2 解决方案：**双模式**，自动检测是否分镜脚本 → 走专用路径。

---

## 5. v2 设计

### 5.1 检测器 `isStoryboardScript(text)`

```ts
// 强特征: 任一命中即认定为分镜
const strongPatterns = [
  /【镜头/, /【镜\d/, /【shot\s*\d/i,
  /景别[：:]/, /构图[：:]/, /运镜[：:]/,
  /灯光[：:]/, /音效[：:]/, /对白[：:]/,
  /内心独白/, /转场[：:]/
];
// 任一命中 → true

// 弱特征: 3 个以上才认定
// 含 \d+-\d+秒 / 画面 / 色彩 / 行首【...】
```

### 5.2 双 system prompt

| 模式 | 触发条件 | 输出风格 | temperature | maxTokens |
|---|---|---|---|---|
| **generic** | 默认（普通一句话） | Single paragraph，结构化 + quality tags | 0.7 | 800 |
| **storyboard** | 检测到分镜特征 | Multi-paragraph，**保留字段/时间分段/对白/音效/转场** | 0.5 (稳定) | 1500 (更长) |

### 5.3 storyboard system prompt 核心规则

```text
1. **逐字段翻译** (不合并): 景别/构图/运镜/画面/灯光/色彩/音效/转场/对白 各自独立
2. **保留时间分段**: "（0-3秒）" → "from 0 to 3 seconds: ..."
3. **专有名词直译**:
   - 苏蓉蓉 = Su Rongrong (not "a woman")
   - 凤鸾春恩车 = Fengluan Spring Grace Carriage
   - 飞檐庑殿顶 = flying eaves hip-and-gable roof
   - 琉璃瓦 = glazed ceramic tiles
   - 朱砂痣 = cinnabar mark
   - 次表面散射 = subsurface scattering
   - HDRI = HDRI (保留)
   - 青砖 = blue-grey bricks
4. **对白 verbatim 保留**: "..." → "Dialogue: '...'" 或 "Inner monologue: '...'"
5. **音效/转场作 meta**: Sound: ... / Transition: ...
6. **输出格式**: Multi-paragraph with "Shot N (X seconds):" + "from X to Y seconds:"
7. **术语映射表** 嵌入 system prompt (景别/构图/运镜/灯光/色彩/转场)
```

### 5.4 计费分账

- generic 模式：`description = 'video prompt LLM 优化'`，¥0.01
- storyboard 模式：`description = 'video prompt LLM 优化(分镜)'`，¥0.01（**计费不变**，区别仅在 description 区分）

---

## 6. v2 E2E 验证

### 6.1 Test Case A：分镜脚本（user 真实案例）

**Input**：见 §4.2 (495 chars 中文分镜)

**Output (plan.prompt, 2058 chars)**：
```
Shot 1 (5 seconds):
A majestic imperial phoenix carriage (Fengluan Spring Grace Carriage) travels
along a winding palace corridor bathed in melting golden sunset light,
appearing miniature between towering red palace walls, with golden tassels
swaying on the carriage roof and long shadows stretching across blue-grey bricks.
From 0 to 3 seconds: aerial shot slowly descending and tilting down along the
corridor, the carriage rolling forward gracefully.
From 3 to 5 seconds: flying eaves hip-and-gable roofs glow orange under HDRI
reflections, glazed ceramic tiles shimmering in the dusk.
Extreme wide shot with rule of thirds composition, golden backlight with warm
ambient light, warm tones with high saturation and high contrast, cinematic,
professional cinematography, smooth camera motion, high quality, masterpiece,
ultra-detailed.
Sound: Wheels rolling over blue-grey bricks, distant bell toll from the clock
tower, wind whistling through palace walls.
Transition: dissolve to next shot.

Shot 2 (4 seconds):
Inside the carriage, a close-up profile of Su Rongrong, with intricate carved
window lattice casting mottled light patterns on her face, a ruby-red cinnabar
mark glowing on her forehead, her skin exhibiting subtle subsurface scattering.
From 0 to 2 seconds: her eyelashes tremble slightly.
From 2 to 3 seconds: cold sweat slides down her temple.
From 3 to 4 seconds: her eyes flash with panic and resistance, then she closes
them, lips slightly parted as if silently praying.
Centered composition, static camera with slow push-in, side backlight with rim
light highlighting facial contours and warm fill on her right cheek, warm tones
with high saturation and dreamy quality, cinematic, professional cinematography,
smooth camera motion, high quality, masterpiece, ultra-detailed.
Dialogue (Su Rongrong inner monologue): "I'm clearly an outstanding high school
senior who's never even killed a chicken — how can I be forced to kill someone!"
Sound: Wheels creaking, slight friction of fabric, her breathing intensifies.
Transition: hard cut.
```

**字段保留对比**：

| 字段 | 中文原文 | v2 翻译 | 保留？ |
|---|---|---|---|
| 时间分段 (0-3s/3-5s) | ✓ | "From 0 to 3 seconds: ..." | ✅ |
| 角色名 苏蓉蓉 | ✓ | "Su Rongrong" | ✅ |
| 凤鸾春恩车 | ✓ | "Fengluan Spring Grace Carriage" | ✅ |
| 飞檐庑殿顶 | ✓ | "flying eaves hip-and-gable roofs" | ✅ |
| 琉璃瓦 | ✓ | "glazed ceramic tiles" | ✅ |
| HDRI 光晕 | ✓ | "HDRI reflections" | ✅ |
| 青砖 | ✓ | "blue-grey bricks" | ✅ |
| 朱砂痣 | ✓ | "cinnabar mark" | ✅ |
| 次表面散射 | ✓ | "subsurface scattering" | ✅ |
| 对白 | ✓ | "Dialogue (Su Rongrong inner monologue): ..." | ✅ |
| 音效 | ✓ | "Sound: Wheels rolling..." | ✅ |
| 转场 | ✓ | "Transition: dissolve to next shot" / "hard cut" | ✅ |
| 景别/构图/运镜 | ✓ | "Extreme wide shot with rule of thirds..." | ✅ |
| 灯光/色彩 | ✓ | "golden backlight with warm ambient light..." | ✅ |

**Server log**：
```json
{
  "conversationId": "26745615-e18c-4b7c-af51-bb05b772328b",
  "elapsedMs": 17534,
  "message": "VideoAgent: prompt optimized by LLM",
  "mode": "storyboard",
  "optimizedLen": 2058,
  "originalLen": 495,
  "usage": {"completionTokens": 441, "promptTokens": 2363, "totalTokens": 2804}
}
```

**billing_logs**：
```
e3aba691... | 0.01 | video prompt LLM 优化(分镜) | 2026-06-20 00:41:13
```

✅ 所有专有名词 / 时间分段 / 对白 / 音效 / 转场 全部保留

### 6.2 Test Case B：通用一句话 (验证 generic 模式不受影响)

**Input**：`古风绿衣仙子站在桃花树下微风拂面`

**Output**：
```
An elegant Chinese fairy in flowing green traditional dress standing under a
blooming peach blossom tree, ... ultra-detailed
```

**Server log**：`mode: "generic"`, `usage: 978 tokens`, `elapsedMs: 7719`

✅ generic 模式行为完全不变 (向后兼容)

---

## 7. 改动清单 (v2)

| 文件 | 类型 | 改动 |
|---|---|---|
| `apps/server/src/prompts/videoAgentSystem.ts` | 改 | 加 `VIDEO_PROMPT_STORYBOARD_SYSTEM` + `isStoryboardScript()` + `buildStoryboardOptimizerMessages()` |
| `apps/server/src/services/videoAgentService.ts` | 改 | 加 import 2 个新导出 + 在 chatCompletion 前 `isStoryboard` 检测 + 选对应 messages builder + temperature/maxTokens 动态 + 计费 description 区分 |

**总改动 v2**：+213 行 (videoAgentSystem.ts storyboard system prompt ~110 行 + 检测器 ~30 行 + terms 嵌入) + 18 行 (videoAgentService.ts 检测分支)

---

## 8. v2 风险 & 教训

### 8.1 风险

1. **检测器误判**：通用 prompt 偶发命中分镜特征（如"运镜"出现在普通句子里）  
   **缓解**：弱特征需 3 个以上才认定；强特征 + 弱特征组合判断

2. **storyboard 输出可能太长**：分镜 prompt 容易 > 4000 chars → 截断丢信息  
   **缓解**：maxTokens=1500 但 system prompt 写 ≤ 3000 chars 输出限制；LLM 自己控制

3. **分镜术语映射表硬编码**：未来 agnes 升级可能改 prompt 风格，映射失效  
   **缓解**：映射表集中维护在 `videoAgentSystem.ts`，后续可动态注入

### 8.2 教训

1. **system prompt 不是"one size fits all"**：通用优化 ≠ 专业分镜优化。**用户类型不同，system prompt 应该不同**
2. **检测器要"宽进严出"**：宁可漏判（走 generic）不要误判（把普通 prompt 当分镜）
3. **保留 vs 重构的取舍**：v1 强调"重构 + 简化"，v2 强调"保留 + 直译" — 不同场景取不同策略
4. **用户实测是 system prompt 改进的唯一标准**：v1 上线后真实用户反馈才能发现问题，光看 LLM 输出质量不够

---

## 9. 后续优化 (S62+)

| 优先级 | 项 | 预计收益 |
|---|---|---|
| P1 | 分镜输出太长时智能截断（按 shot 切分，丢尾部 shot 而非切中间） | 长分镜不丢信息 |
| P1 | i2v 模式也加可选 LLM 优化（开关，默认关） | i2v 灵活度 |
| P2 | image agent 也加 LLM 优化层（共用 system prompt 风格） | 图片质量提升 |
| P2 | 加用户反馈机制（optimized prompt 旁边 "👍 好 / 👎 重来"） | 数据驱动优化 |
| P3 | LLM 输出 cache（相同 prompt 直接返 cache） | 重复 prompt 省钱 |
| P3 | 拆分 system prompt 为多段，按检测结果动态拼装（节省 token） | 通用模式省 ~30% token |

---

## 10. 关键代码定位

| 逻辑 | 文件:行号 |
|---|---|
| 通用 system prompt | `apps/server/src/prompts/videoAgentSystem.ts:25-100` |
| **分镜 system prompt** | `videoAgentSystem.ts:115-227` |
| **分镜检测器** | `videoAgentSystem.ts:240-275` |
| `isStoryboardScript` | `videoAgentSystem.ts:241-274` |
| `buildVideoPromptOptimizerMessages` (generic) | `videoAgentSystem.ts:280-285` |
| `buildStoryboardOptimizerMessages` | `videoAgentSystem.ts:290-295` |
| videoAgentService import | `videoAgentService.ts:11-30` |
| processTurn 检测分支 | `videoAgentService.ts:243-247` |
| processTurn temperature/maxTokens 动态 | `videoAgentService.ts:258-261` |
| 计费 description 区分 | `videoAgentService.ts:281-282` |
| logger mode 字段 | `videoAgentService.ts:329-340` |

---

## 11. 验收清单

### v1 (通用模式)
- [x] tsc 编译 0 错
- [x] PM2 reload OK (pid 20576)
- [x] E2E 中文 → 英文结构化 prompt
- [x] billing_logs 写入 ¥0.01/次
- [x] LLM 调用 ~2s，平均 950 tokens
- [x] 失败兜底覆盖

### v2 (分镜模式)
- [x] 检测器 `isStoryboardScript` 命中真实分镜
- [x] 双 system prompt 切换（generic + storyboard）
- [x] 分镜 E2E：所有专有名词 / 时间分段 / 对白 / 音效 / 转场 100% 保留
- [x] generic E2E：行为完全不变（向后兼容）
- [x] billing description 区分（"(分镜)" 后缀）
- [x] server log `mode: "storyboard"` / `"generic"` 字段
- [ ] Git commit + push (v2)

