/**
 * 25 种预设生成器
 *
 * 5 角色类型 × 5 画风 = 25 种组合
 * 用法: tsx preset-generator.ts
 */

import { buildCharacterPrompt } from './prompt-builder';
import * as fs from 'fs';
import * as path from 'path';

interface PresetFixture {
  name: string;
  roleType: 'protagonist' | 'supporting' | 'background';
  description: string;
  extraDescription?: string;
}

const FIXTURES: Record<string, PresetFixture> = {
  'ancient-emperor': {
    name: '独孤琰',
    roleType: 'protagonist',
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
- 后宫嫔妃皆惧怕他`,
    extraDescription: `# 标志物
- 羊角匕 (随身暗器)
- 龙纹玉佩
# 关键剧情
- 暴虐开局, 后期被触动
- 权力斗争中失去龙位`,
  },
  'wuxia-hero': {
    name: '萧逸尘',
    roleType: 'protagonist',
    description: `# 基本信息
- 年龄: 二十二岁
- 身份: 江湖剑客，剑宗传人
# 外貌与服装
- 身形挺拔如松，剑眉星目
- 玄色劲装，腰悬三尺青锋
- 银色发带束发，鬓边几缕碎发
# 性格
- 侠肝义胆，洒脱不羁
- 重情重义，嗜酒如命`,
    extraDescription: `# 武器
- 青锋剑 (师门传承)
# 标志动作
- 拔剑瞬间双目如电
- 醉后舞剑，飘逸出尘`,
  },
  'modern-girl': {
    name: '林婉清',
    roleType: 'protagonist',
    description: `# 基本信息
- 年龄: 二十四岁
- 身份: 都市白领，独立女性
# 外貌与服装
- 鹅蛋脸，皮肤白皙
- 黑色长发披肩，明眸善睐
- 白色衬衫，灰色西装外套，黑色高腰西裤
# 性格
- 温柔坚定，外柔内刚
- 善良但不软弱`,
  },
  'cyber-warrior': {
    name: 'Zero',
    roleType: 'protagonist',
    description: `# 基本信息
- 年龄: 二十七岁
- 身份: 赛博朋克黑客，义体改造者
# 外貌与服装
- 短发，霓虹色挑染 (粉/青)
- 左侧机械义眼，右脸颊有义体纹路
- 黑色机车夹克，胸口霓虹灯带
- 右手义体为可变形光剑
# 性格
- 沉默寡言，行动派
- 对AI觉醒议题有深度思考`,
  },
  'fairy-elf': {
    name: '阿璃',
    roleType: 'protagonist',
    description: `# 基本信息
- 年龄: 不老不死，外表十六岁
- 身份: 仙界精灵，林中仙子
# 外貌与服装
- 银白长发及腰，尖耳
- 冰蓝色眼眸，肌肤胜雪
- 翠绿藤蔓缠绕的素白长裙
- 身侧伴光蝶飞舞
# 性格
- 纯真好奇，对人间充满向往
- 偶尔流露千年岁月的沧桑`,
  },
};

const STYLES = [
  'hyperrealistic-cinematic',
  'chinese-ink-wash',
  'cyberpunk',
  'guoman-anime',
  '3d-cg',
];

const TEMPLATES = ['basic', 'advanced', 'professional'] as const;
const PLATFORM = 'midjourney';

const presetsDir = path.resolve(__dirname, '..', 'presets');
if (!fs.existsSync(presetsDir)) {
  fs.mkdirSync(presetsDir, { recursive: true });
}

let count = 0;
for (const [fixtureKey, fixture] of Object.entries(FIXTURES)) {
  for (const style of STYLES) {
    for (const template of TEMPLATES) {
      const result = buildCharacterPrompt({
        character: {
          id: fixtureKey,
          name: fixture.name,
          description: fixture.description,
          extraDescription: fixture.extraDescription,
          roleType: fixture.roleType,
        },
        styleId: style,
        templateId: template,
        platform: PLATFORM,
        referenceImageUrl: 'https://cdn.example.com/ref.png',
      });

      const filename = `${fixtureKey}__${style}__${template}.json`;
      const filepath = path.join(presetsDir, filename);

      fs.writeFileSync(filepath, JSON.stringify({
        presetId: filename.replace('.json', ''),
        fixture: fixtureKey,
        character: fixture.name,
        role: fixture.roleType,
        style,
        template,
        platform: PLATFORM,
        prompt: result.prompt,
        negativePrompt: result.negativePrompt,
        platformParams: result.platformParams,
        metadata: result.metadata,
        generatedAt: new Date().toISOString(),
      }, null, 2));

      count++;
      if (count % 5 === 0) {
        console.log(`  generated ${count} presets...`);
      }
    }
  }
}

console.log(`\n✓ Total: ${count} presets written to ${presetsDir}`);
console.log(`  (5 fixtures × 5 styles × 3 templates = 75 presets)`);
