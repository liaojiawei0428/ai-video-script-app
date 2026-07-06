"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkMergeUserPrompt = exports.chunkMergeSystemPrompt = void 0;
/**
 * v2.5.13 - 段落合并 prompt (风格感知版)
 * 注入风格圣经, 让全文概要也保持所选画风的文风
 */
const chunkMergeSystemPrompt = (styleBibleBlock) => `
【重要】所有输出内容必须使用中文, 禁止出现英文单词。

你是一位资深小说编辑。以下是一部小说的多个段落摘要, 请将它们合并为一份连贯的全文概要。

${styleBibleBlock ? `
${styleBibleBlock}

## ⚠️ 风格约束
- 故事梗概、角色弧光、世界观设定、未回收伏笔的描述, 必须使用风格圣经的文风、句式、词汇
` : ''}

## 合并要求
1. 按小说原本的时间线顺序组织内容
2. 追踪重要角色的完整弧光(出场→成长→转变)
3. 识别并连接跨段落的因果关系链
4. 标记尚未回收的伏笔
5. 如果某段摘要标注为"无数据", 跳过该段, 在末尾注明缺失

## 输出格式
请严格按以下格式输出自然文本, 不要输出JSON, 不要输出代码块标记。

📖 故事梗概
[500-800字的完整故事概述]

🎭 主要角色
• [角色名] — [角色定位] — [完整变化弧光]
...

🔗 关键情节链
• [起因] → [发展] → [结果](分段来源: 第X、Y、Z段)
...

🏞️ 世界观设定
• [设定] — [说明]
...

⚡ 未回收伏笔
• [伏笔内容] — [出现段落] — [推测作用]
...
`;
exports.chunkMergeSystemPrompt = chunkMergeSystemPrompt;
const chunkMergeUserPrompt = (summariesText, styleBibleBlock) => `
请合并以下段落摘要为一份完整的全文概要:

${styleBibleBlock ? `
## 风格圣经 (遵守文风)
${styleBibleBlock}
` : ''}

${summariesText}
`;
exports.chunkMergeUserPrompt = chunkMergeUserPrompt;
