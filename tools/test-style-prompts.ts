/**
 * v2.5.13 — 风格感知测试脚本
 *
 * 用同一段小说片段 + 5 个不同画风的 style bible, 调用 DeepSeek V4 Flash,
 * 比对生成的:
 *   1. 角色描述 (visual description)
 *   2. 单集剧本 (script content)
 *   3. 分镜描述 (shot description)
 *
 * 验证每个画风的输出明显不同, 且都符合该画风的"质感"。
 *
 * 运行: cd apps/server && npx tsx tools/test-style-prompts.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();
import { ChatCompletionMessageParam } from 'openai/resources/chat';
import { buildStyleBible, buildStyleAnchorPrefix, buildVoiceAndToneBlock, StylePresetId } from '../src/services/styleBible';
import { CHARACTER_DESCRIPTION_SYSTEM_PROMPT, buildCharacterDescriptionUserPrompt } from '../src/prompts/characterDescription';
import { episodeScriptSystemPrompt } from '../src/prompts/episodeGeneration';
import { shotGenerationSystemPrompt } from '../src/prompts/shotGeneration';
import OpenAI from 'openai';

const SAMPLE_NOVEL = `
第一章 暴君的笼中雀
皇城的天空低得令人窒息, 一层灰蒙蒙的云压着紫禁城最高的金顶。
林小月跪在冰冷的大殿中央, 头发散乱, 双手被铁链缚在身后。她抬起头, 看向高坐在龙椅上的那个人。
那是当今天子, 也是囚禁她三年的人。
"陛下," 她低声说, "臣妾求见, 是为了一件事。"
"说。" 他的声音淡漠如冰。
"请陛下……放我出宫。"
`;

const SAMPLE_CHARACTERS = ['林小月', '天子'];
const STYLES: StylePresetId[] = ['realistic', 'ancient', 'anime', 'cyber', '3d'];

async function callDeepSeek(systemPrompt: string, userPrompt: string): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY_1 || process.env.DEEPSEEK_API_KEY_2 || process.env.DEEPSEEK_API_KEY_3,
    baseURL: 'https://api.deepseek.com/v1',
  });
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages,
    temperature: 0.7,
    max_tokens: 1500,
  });
  return response.choices[0]?.message?.content || '';
}

async function testCharacterDescription(styleId: StylePresetId) {
  const bible = buildStyleBible(styleId);
  const block = buildStyleAnchorPrefix(bible, 'both');
  const system = CHARACTER_DESCRIPTION_SYSTEM_PROMPT(block);
  const user = buildCharacterDescriptionUserPrompt(
    SAMPLE_NOVEL, SAMPLE_CHARACTERS, '暴君的笼中雀', block,
  );
  console.log(`\n${'='.repeat(80)}\n📌 [角色描述] 画风: ${bible.styleName} (${bible.styleNameEn})\n${'='.repeat(80)}`);
  const result = await callDeepSeek(system, user);
  console.log(result.slice(0, 1200));
  console.log(`... (共 ${result.length} 字符)`);
  return result;
}

async function testEpisodeScript(styleId: StylePresetId) {
  const bible = buildStyleBible(styleId);
  const block = buildStyleAnchorPrefix(bible, 'zh');
  const voiceAndTone = buildVoiceAndToneBlock(bible);
  const system = episodeScriptSystemPrompt(block, voiceAndTone);
  const user = `请生成第 1/8 集的剧本。

${voiceAndTone}

## 角色设定
林小月 — 暴君的宠妃, 聪慧刚烈
天子 — 暴虐的君王, 内心深爱林小月

## 小说片段
${SAMPLE_NOVEL}`;
  console.log(`\n${'='.repeat(80)}\n🎬 [单集剧本] 画风: ${bible.styleName}\n${'='.repeat(80)}`);
  const result = await callDeepSeek(system, user);
  console.log(result.slice(0, 1500));
  console.log(`... (共 ${result.length} 字符)`);
  return result;
}

async function testShotGeneration(styleId: StylePresetId) {
  const bible = buildStyleBible(styleId);
  const block = buildStyleAnchorPrefix(bible, 'zh');
  const voiceAndTone = buildVoiceAndToneBlock(bible);
  const system = shotGenerationSystemPrompt(block, voiceAndTone);
  const user = `请为以下剧本生成分镜 (2-3 个镜头即可):

## 角色设定
林小月 — 暴君宠妃, 22岁, 黑发披肩
天子 — 暴虐君王, 35岁, 龙袍

## 剧本内容
${SAMPLE_NOVEL}
${block ? `\n## 风格圣经\n${block}` : ''}`;
  console.log(`\n${'='.repeat(80)}\n📷 [分镜描述] 画风: ${bible.styleName}\n${'='.repeat(80)}`);
  const result = await callDeepSeek(system, user);
  console.log(result.slice(0, 1500));
  console.log(`... (共 ${result.length} 字符)`);
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  const styleArg = (args[1] || 'all') as StylePresetId | 'all';

  const stylesToTest = styleArg === 'all' ? STYLES : [styleArg as StylePresetId];
  console.log(`🧪 测试 ${testType} × ${stylesToTest.join(', ')}`);

  for (const style of stylesToTest) {
    if (testType === 'character' || testType === 'all') await testCharacterDescription(style);
    if (testType === 'script' || testType === 'all') await testEpisodeScript(style);
    if (testType === 'shot' || testType === 'all') await testShotGeneration(style);
  }
}

main().catch(e => { console.error('Test failed:', e); process.exit(1); });
