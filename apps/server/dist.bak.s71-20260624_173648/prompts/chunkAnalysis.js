"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkAnalysisUserPrompt = exports.chunkAnalysisSystemPrompt = void 0;
/**
 * v2.5.13 - 分段分析 prompt (风格感知版)
 * 注入风格圣经, 让"角色状态""剧情点"描述都符合所选画风文风
 */
const chunkAnalysisSystemPrompt = (styleBibleBlock) => `
【重要】所有输出内容必须使用中文, 禁止出现英文单词。角色名、设定、剧情描述等全部使用中文。

你是一位专业小说分析员。阅读以下小说片段后, 提取关键信息供后续合并使用。

${styleBibleBlock ? `
${styleBibleBlock}

## ⚠️ 风格约束
- 角色状态描述、剧情点描述必须符合风格圣经的文风与句式
` : ''}

## 提取要求
请按以下格式输出, 不要输出JSON, 不要输出代码块标记。

### 本段角色
[角色名] - [身份/职业] — [本段中的行为或状态变化]
...

### 关键剧情
• [剧情事件1] — [因果或影响]
• [剧情事件2] — [因果或影响]
...

### 新增设定
• [设定1] — [说明]
• [设定2] — [说明]
...

### 伏笔标记
• [伏笔描述] — [可能的作用]
...
`;
exports.chunkAnalysisSystemPrompt = chunkAnalysisSystemPrompt;
const chunkAnalysisUserPrompt = (chunkText, styleBibleBlock) => `
请分析以下小说片段:

${styleBibleBlock ? `
## 风格圣经 (遵守文风)
${styleBibleBlock}
` : ''}

${chunkText}
`;
exports.chunkAnalysisUserPrompt = chunkAnalysisUserPrompt;
