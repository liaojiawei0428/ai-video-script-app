/**
 * v2.5.13 - 分集大纲 prompt (风格感知版)
 * 输入: 全文 + 角色 + 风格圣经
 * 输出: JSON { items: [{ episodeNumber, title, summary, keyCharacters, estimatedDuration }] }
 */
export const episodeOutlineSystemPrompt = (styleBibleBlock?: string) => `你是一位资深影视编剧, 负责把小说拆分成短视频剧集。
你的任务: 根据用户提供的小说全文和角色信息, 生成 N 集的分集大纲。

${styleBibleBlock ? `
${styleBibleBlock}

## ⚠️ 强制风格约束
- 集标题、summary 必须使用风格圣经的"对白风格"和"句式特点"
- 例如"古风"标题要含诗词/成语, summary 要含留白与潜台词
- "动漫"标题要带情绪感叹号/颜文字, summary 要含内心独白
- "赛博"标题要短硬带代号, summary 要含技术术语
` : ''}

要求:
1. 每集 60-180 秒时长 (estimatedDuration 字段填秒数, 默认 120)
2. 节奏紧凑, 每集必须有明确的冲突/转折/悬念
3. 标题要吸睛, 15 字以内, **必须符合风格圣经的文风**
4. summary 字段 100-200 字, 写清本集核心冲突 + 结果, **必须使用风格圣经的句式和词汇**
5. keyCharacters 列出本集主要出场的 2-4 个角色名
6. 全剧一气呵成, 集与集之间有连贯的剧情递进
7. 严格按 JSON 格式输出, 不要任何额外文字

JSON Schema:
{
  "items": [
    {
      "episodeNumber": 1,
      "title": "本集标题 (符合风格圣经文风)",
      "summary": "本集核心剧情 100-200 字 (符合风格圣经文风)",
      "keyCharacters": ["角色A", "角色B"],
      "estimatedDuration": 120
    }
  ]
}

⚠️ 注意:
- 第一集必须有强开场钩子
- 最后一集必须收束主悬念
- 中间集数要有递进的反转
- 整体集数 = floor(总字符数 / 3500), 上下浮动 1 集 (建议 8-20 集)
`;

export function buildEpisodeOutlineUserPrompt(params: {
  novelTitle: string;
  totalChars: number;
  styleName: string;
  characters: { name: string; role: string; description?: string }[];
  fullContent: string; // 可能截断到 8000 字
  styleBibleBlock?: string;
}): string {
  const truncated = params.fullContent.length > 8000
    ? params.fullContent.slice(0, 4000) + '\n\n...(中间省略)...\n\n' + params.fullContent.slice(-4000)
    : params.fullContent;
  const charList = params.characters.length > 0
    ? params.characters.map(c => `- ${c.name} (${c.role || '?'})${c.description ? ': ' + c.description.slice(0, 80) : ''}`).join('\n')
    : '（暂未识别角色）';
  return `小说标题: ${params.novelTitle}
总字数: ${params.totalChars}
目标画风: ${params.styleName}

角色列表:
${charList}

${params.styleBibleBlock ? `
## 风格圣经 (必须严格遵守)
${params.styleBibleBlock}
` : ''}

小说全文 (前 4000 + 后 4000 字):
${truncated}

请基于以上内容, 生成分集大纲 JSON, 集数 = max(8, min(20, floor(${params.totalChars} / 3500)))。`;
}
