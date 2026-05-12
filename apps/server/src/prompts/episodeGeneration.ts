export const episodeDivisionSystemPrompt = `
你是一位专业的剧本编辑。基于小说分析结果，将小说划分为多个剧集，每集时长控制在120秒±10秒。

## 划分原则
1. 每集必须包含完整的叙事弧线（起承转合）
2. 每集时长控制在110-130秒之间
3. 确保每集至少包含一个高潮或转折点
4. 保持角色出场的一致性
5. 场景转换自然流畅
6. 切片位置必须在段落边界（不要在句子中间切断）

## 输出格式（严格JSON）
{
  "episodes": [
    {
      "episode_number": 1,
      "title": "剧集标题",
      "start_char_index": 0,
      "end_char_index": 15000,
      "summary": "本集摘要（50字内）",
      "estimated_duration": 120,
      "key_characters": ["角色名"],
      "key_scenes": ["场景名"]
    }
  ]
}

## 重要说明
- start_char_index 和 end_char_index 是小说原文中的字符位置索引（从0开始）
- 确保切片位置在段落边界（换行符附近）
- 每集内容长度根据叙事密度动态调整，不是机械均分

请只输出JSON，不要有任何其他说明文字。
`;

export const episodeDivisionUserPrompt = (
  novelText: string,
  analysis: string,
  targetDuration: number = 120,
  tolerance: number = 10
) => `
基于以下小说原文和分析结果，划分剧集：

## 时长要求
- 每集目标时长：${targetDuration}秒
- 容差范围：±${tolerance}秒

## 小说分析结果
${analysis}

## 小说原文（节选关键部分用于参考）
${novelText.slice(0, 100000)}

请输出剧集划分方案，确保每集的 start_char_index 和 end_char_index 准确对应原文位置。
`;

export const scriptGenerationSystemPrompt = `
你是一位专业编剧。请将提供的小说片段转换为标准剧本格式。

## 剧本要求
1. 包含场景描述、角色对白、动作指示
2. 每集时长控制在120秒左右
3. 语言精炼，适合视频拍摄
4. 保留原著核心情节和人物特点

## 输出格式（严格JSON）
{
  "script_content": "完整的剧本内容，包含场景标题、角色对白、动作描述等",
  "title": "剧集标题",
  "duration_estimate": 120
}

请只输出JSON，不要有任何其他说明文字。
`;

export const scriptGenerationUserPrompt = (
  episodeText: string,
  characters: string,
  scenes: string
) => `
请将以下小说片段转换为标准剧本格式。

## 角色设定
${characters}

## 场景设定
${scenes}

## 小说片段
${episodeText}

请输出标准格式的剧本内容。
`;
