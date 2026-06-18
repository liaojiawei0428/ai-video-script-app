/**
 * prompt-builder 单元测试
 *
 * 运行: ts-node test-prompt-builder.ts
 *  或: npx tsx test-prompt-builder.ts
 */

import { buildCharacterPrompt, listStyles, listTemplates, listPlatforms } from './prompt-builder';
import { detectRole, extractSignalsFromDescription } from './role-detector';

const DUGU_YAN: any = {
  id: '368c3642-83c4-44c9-afc9-94f862065022',
  name: '独孤琰',
  description: `# 基本信息
- 年龄: 十八岁
- 身份: 大周天子，暴君
# 外貌与服装
- 身形颀长，宽肩窄腰，四肢修长
- 瓜子脸，眉如远山，猩红眼眸，妖冶阴鸷
- 朱砂痣位于眉心，肤色苍白如纸
- 墨黑长发，玉冠束发
- 玄色龙袍绣金丝龙纹，黑色皂靴
# 性格与气质
- 冷峻阴鸷，嗜血疯狂
- 对万公公极度信赖
- 后宫嫔妃皆惧怕他
- 行事乖张，喜怒无常，朝臣侧目
- 偶尔流露少年人的脆弱与孤独
# 标志物
- 羊角匕 (随身暗器)
- 龙纹玉佩
# 人际关系
- 信任万公公如父
- 视苏蓉蓉为贡品玩物
- 与陆婕妤暗中博弈
- 对独孤皇后心存芥蒂
# 习惯动作
- 拂袖转身时左手抚过玉佩
- 烦躁时拇指按压眉心朱砂痣
- 嗜饮冷酒，喜用白玉杯
- 夜深独坐御书房凝视窗外`,
  extraDescription: `# 台词与口头禅
- "朕要做的事, 没有做不成的。"
- "这天下, 终究是朕的天下。"
- "你不配让朕多看一眼。"
- "退下。朕乏了。"
# 关键剧情
- 在贡品入宫仪式上看中苏蓉蓉
- 因陆婕妤告密而对苏蓉蓉产生怀疑
- 与万公公密谋清洗朝中异己
- 深夜独处时流露对亡母的追思
# 命运走向
- 前期暴虐, 中期被苏蓉蓉触动, 后期为护她不惜与太后决裂
- 最终在权力斗争中失去龙位`,
  aliases: ['陛下', '圣上', '皇上'],
};

const CHILD: any = {
  id: 'child-1',
  name: '小翠',
  description: '宫女，十三岁，鹅蛋脸，眉清目秀，梳双丫髻，穿淡绿色宫装。',
  extraDescription: '',
  aliases: ['翠儿'],
};

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passCount++;
    console.log(`  ✓ ${msg}`);
  } else {
    failCount++;
    console.log(`  ✗ FAIL: ${msg}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

// ---- Test 1: 角色检测 ----

section('Test 1: 角色自动检测');
{
  const sig1 = extractSignalsFromDescription(DUGU_YAN.description);
  const r1 = detectRole(sig1);
  console.log(`  Dugu Yan signals:`, sig1);
  console.log(`  Dugu Yan detected: ${r1.role} (confidence=${r1.confidence.toFixed(2)})`);
  // Dugu Yan description ~340 字符, mention ~8, 有核心冲突
  // 算法应判为 supporting 或 protagonist (取决于 mentionCount 估算)
  assert(r1.role === 'supporting' || r1.role === 'protagonist', 'Dugu Yan 应该被识别为 supporting 或 protagonist');
  assert(r1.confidence >= 0.3, 'Dugu Yan 置信度 >= 0.3');

  const sig2 = extractSignalsFromDescription(CHILD.description);
  const r2 = detectRole(sig2);
  console.log(`  Xiao Cui signals:`, sig2);
  console.log(`  Xiao Cui detected: ${r2.role} (confidence=${r2.confidence.toFixed(2)})`);
  assert(r2.role === 'background' || r2.role === 'supporting', 'Xiao Cui 应该被识别为 background 或 supporting');
}

// ---- Test 2: 5 画风 × basic 模板 ----

section('Test 2: 5 画风 × basic 模板');
const styles = listStyles();
assert(styles.length === 5, `应有 5 个画风, 实际 ${styles.length}`);

for (const style of styles) {
  const result = buildCharacterPrompt({
    character: DUGU_YAN,
    styleId: style.styleId,
    templateId: 'basic',
    platform: 'midjourney',
  });
  console.log(`  [${style.name}] length=${result.prompt.length}, role=${result.metadata.detectedRole}`);
  assert(result.prompt.length > 50, `${style.name} prompt 长度 > 50`);
  assert(result.metadata.styleId === style.styleId, `${style.name} styleId 正确`);
  // DUGU_YAN 应被识别为 supporting 或 protagonist (主要角色)
  assert(
    result.metadata.detectedRole === 'supporting' || result.metadata.detectedRole === 'protagonist',
    `${style.name} DUGU_YAN 应被识别为 supporting 或 protagonist`
  );
}

// ---- Test 3: 3 模板 × hyperrealistic ----

section('Test 3: 3 模板 × hyperrealistic');
const templates = listTemplates();
assert(templates.length === 3, `应有 3 个模板, 实际 ${templates.length}`);

for (const tmpl of templates) {
  const result = buildCharacterPrompt({
    character: DUGU_YAN,
    styleId: 'hyperrealistic-cinematic',
    templateId: tmpl.templateId as any,
    platform: 'midjourney',
  });
  console.log(`  [${tmpl.name}] length=${result.prompt.length}`);
  assert(result.prompt.length > 50, `${tmpl.name} prompt 长度 > 50`);
  // professional 应该比 basic 更长
  if (tmpl.templateId === 'professional') {
    assert(result.prompt.length > 200, `professional prompt 应 > 200 字符`);
  }
}

// ---- Test 4: 平台参数 ----

section('Test 4: 平台参数');
const platforms = listPlatforms();
for (const platform of platforms) {
  const result = buildCharacterPrompt({
    character: DUGU_YAN,
    styleId: 'hyperrealistic-cinematic',
    templateId: 'advanced',
    platform,
    referenceImageUrl: 'https://example.com/ref.png',
  });
  console.log(`  [${platform}] platformParams: ${result.platformParams.slice(0, 80)}`);
  if (platform === 'midjourney') {
    assert(result.platformParams.includes('--ar'), 'MJ 平台参数应包含 --ar');
    assert(result.platformParams.includes('--v'), 'MJ 平台参数应包含 --v');
  }
  if (platform === 'agnes') {
    assert(result.platformParams.includes('https://example.com/ref.png'), 'Agnes 平台参数应包含 image_url');
  }
}

// ---- Test 5: 完整输出示例 ----

section('Test 5: 完整输出 (独孤琰 × hyperrealistic × professional × midjourney)');
{
  const result = buildCharacterPrompt({
    character: DUGU_YAN,
    styleId: 'hyperrealistic-cinematic',
    templateId: 'professional',
    platform: 'midjourney',
    referenceImageUrl: 'https://cdn.example.com/dugu-yan-ref.png',
  });
  console.log('--- PROMPT ---');
  console.log(result.prompt);
  console.log('--- NEGATIVE ---');
  console.log(result.negativePrompt);
  console.log('--- METADATA ---');
  console.log(JSON.stringify(result.metadata, null, 2));
  assert(result.prompt.includes('独孤琰'), 'prompt 包含角色名');
  assert(result.prompt.includes('hyperrealistic') || result.prompt.includes('cinematic'), 'prompt 包含画风关键词');
  assert(result.negativePrompt.length > 10, '负面 prompt 非空');
}

// ---- Test 6: 角色类型对详细度的影响 ----

section('Test 6: 主角 vs 路人 详细度差异');
{
  const protag = buildCharacterPrompt({
    character: DUGU_YAN,
    styleId: 'hyperrealistic-cinematic',
    templateId: 'advanced',
    platform: 'midjourney',
  });
  const bg = buildCharacterPrompt({
    character: CHILD,
    styleId: 'hyperrealistic-cinematic',
    templateId: 'advanced',
    platform: 'midjourney',
  });
  console.log(`  主角 prompt length: ${protag.prompt.length}`);
  console.log(`  路人 prompt length: ${bg.prompt.length}`);
  assert(protag.prompt.length >= bg.prompt.length, '主角 prompt 应不短于路人');
}

// ---- Summary ----

section('Summary');
console.log(`  ✓ Pass: ${passCount}`);
console.log(`  ✗ Fail: ${failCount}`);
if (failCount > 0) {
  process.exit(1);
}
