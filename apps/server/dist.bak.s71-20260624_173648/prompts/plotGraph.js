"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plotGraphSystemPrompt = void 0;
exports.buildPlotGraphUserPrompt = buildPlotGraphUserPrompt;
/**
 * v2.5.13 - 章节事件图谱 prompt (风格感知版)
 * 输出: JSON { chapters: [{ chapter, title, events: [{ type, summary, characters, importance }] }] }
 */
const plotGraphSystemPrompt = (styleBibleBlock) => `你是一位擅长解构剧情结构的影视分析师。
任务: 把小说按"章节"(按剧情阶段切分, 5-8 章) 拆解, 每章提取 3-6 个关键事件, 形成事件图谱。

${styleBibleBlock ? `
${styleBibleBlock}

## ⚠️ 风格约束
- 章节标题与事件 summary 必须符合风格圣经的文风、句式、词汇
` : ''}

事件类型 (type) 可选值:
- "setup": 背景铺陈
- "inciting_incident": 诱发事件
- "rising_action": 上升动作
- "climax": 高潮
- "falling_action": 下行动
- "resolution": 结局
- "turning_point": 转折点

要求:
1. importance 字段 1-5, 5 为最重要转折
2. characters 字段列出该事件涉及的 1-3 个角色名
3. summary 字段 30-80 字, **使用风格圣经的句式和词汇**
4. 整体呈"起承转合"结构
5. 严格按 JSON 输出, 不要任何额外文字

JSON Schema:
{
  "chapters": [
    {
      "chapter": 1,
      "title": "章节标题 (符合风格圣经文风)",
      "events": [
        {
          "type": "setup",
          "summary": "事件简述 (符合风格圣经文风)",
          "characters": ["角色A"],
          "importance": 3
        }
      ]
    }
  ]
}
`;
exports.plotGraphSystemPrompt = plotGraphSystemPrompt;
function buildPlotGraphUserPrompt(params) {
    const truncated = params.fullContent.length > 10000
        ? params.fullContent.slice(0, 5000) + '\n\n...(中间省略)...\n\n' + params.fullContent.slice(-5000)
        : params.fullContent;
    const charList = params.characters.length > 0
        ? params.characters.map(c => `- ${c.name} (${c.role || '?'})`).join('\n')
        : '（暂未识别角色）';
    return `小说标题: ${params.novelTitle}
总字数: ${params.totalChars}

角色列表:
${charList}

${params.styleBibleBlock ? `
## 风格圣经 (必须遵守)
${params.styleBibleBlock}
` : ''}

小说全文 (前 5000 + 后 5000 字):
${truncated}

请按剧情阶段拆为 5-8 章, 每章 3-6 个关键事件, 输出 JSON。`;
}
