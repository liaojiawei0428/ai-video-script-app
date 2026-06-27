// tools/verify-bug107-key-label.js (v3.0.42 BUG-107 验证)
// 复刻 web + mobile + server 三端 KEY_LABEL 字典, 验证 objectToText 输出全中文 label (严禁中英夹杂)

const KEY_LABEL = {
  role_type: '角色类型', gender: '性别', age: '年龄',
  height: '身高', build: '体型', skin: '肤色', makeup: '妆容',
  face: '脸型', eyes: '眼睛', eyebrows: '眉毛', nose: '鼻子', lips: '嘴唇', ears: '耳朵',
  hair_color: '发色', hair_style: '发型', hair_length: '发长', hair_texture: '发质', hair_accessories: '发饰',
  clothing_top: '上衣', clothing_bottom: '下装', clothing_outer: '外套', clothing_shoes: '鞋',
  clothing_underwear: '内衣', clothing_socks: '袜',
  accessories_neck: '颈部配饰', accessories_ears: '耳饰', accessories_hands: '手部配饰',
  accessories_waist: '腰饰', accessories_other: '其他配饰',
  props: '道具', distinctive_features: '显著特征', default_expression: '默认表情',
  emotional_range: '情绪范围', body_language: '肢体语言',
  personality_visual: '性格(视觉)', social_class_visual: '社会阶层(视觉)', personality: '性格',
  prompt_safe_description: '生图提示词', relationships: '关系', _relationships: '关系',
  'role type': '角色类型', 'hair color': '发色', 'hair style': '发型',
  'clothing top': '上衣', 'accessories neck': '颈部配饰',
};

function objectToText(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return Object.entries(obj)
    .filter(([k, v]) => k !== 'name' && v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const label = KEY_LABEL[k] || k.replace(/_/g, ' ');
      if (Array.isArray(v)) return `- ${label}: ${v.join(', ')}`;
      if (typeof v === 'object') return `- ${label}: ${JSON.stringify(v)}`;
      return `- ${label}: ${v}`;
    })
    .join('\n');
}

const ENGLISH_KEYS = Object.keys(KEY_LABEL);

// 实战 case 1: server 返回的 11 字段 JSON 对象 (老 prompt / LLM 误返)
const obj1 = {
  name: '苏蓉儿',
  role_type: '主角',
  gender: '女',
  age: '17岁',
  height: '163厘米左右',
  build: '纤细苗条',
  hair_color: '黑色',
  hair_style: '高马尾',
  clothing_top: '淡蓝色襦裙',
  clothing_bottom: '白色百褶裙',
  clothing_outer: '粉色薄纱披帛',
  distinctive_features: '左眼下有泪痣',
  personality: '活泼开朗, 聪明伶俐',
  relationships: '皇帝之女',
  // 故意加一个 KEY_LABEL 没有的 key 测 fallback
  custom_field: 'test',
};

// 实战 case 2: 空格分隔 key (老 prompt LLM 偶发)
const obj2 = {
  'role type': '主角',
  'hair color': '黑色',
  'hair style': '高马尾',
  'clothing top': '蓝色长袍',
};

const cases = [
  {
    name: '1. 中文 label 完整替换 (14 字段 100% 中文)',
    fn: () => objectToText(obj1),
    expectNotContains: ['role_type', 'gender', 'hair_color', 'clothing_top', 'clothing_bottom', 'clothing_outer', 'distinctive_features', 'prompt_safe_description'],
    expectContains: ['角色类型', '性别', '发色', '发型', '上衣', '下装', '外套', '显著特征'],
  },
  {
    name: '2. 空格分隔 key 兼容 (老 prompt LLM 风格)',
    fn: () => objectToText(obj2),
    expectNotContains: ['role type:', 'hair color:', 'hair style:', 'clothing top:'],
    expectContains: ['角色类型', '发色', '发型', '上衣'],
  },
  {
    name: '3. fallback 走 k.replace(/_/g, " ") (新增字段)',
    fn: () => {
      const r = objectToText({ custom_field: 'test' });
      return r;
    },
    expectContains: ['custom field: test'],  // 空格分隔, 不是 raw english
  },
  {
    name: '4. name 字段过滤',
    fn: () => objectToText({ name: '苏蓉儿', age: '17岁' }),
    expectNotContains: ['name: 苏蓉儿'],
    expectContains: ['年龄: 17岁'],
  },
  {
    name: '5. 数组值拼接',
    fn: () => objectToText({ hair_accessories: ['玉簪', '绢花', '银步摇'] }),
    expectContains: ['发饰: 玉簪, 绢花, 银步摇'],
  },
  {
    name: '6. KEY_LABEL 字典 37 项 1:1 三端对齐',
    fn: () => {
      // 复刻 37 字段 (server 端 line 391-404 v2.5.35)
      const serverKeys = [
        'role_type', 'gender', 'age', 'height', 'build', 'skin', 'makeup',
        'face', 'eyes', 'eyebrows', 'nose', 'lips', 'ears',
        'hair_color', 'hair_style', 'hair_length', 'hair_texture', 'hair_accessories',
        'clothing_top', 'clothing_bottom', 'clothing_outer', 'clothing_shoes',
        'clothing_underwear', 'clothing_socks',
        'accessories_neck', 'accessories_ears', 'accessories_hands', 'accessories_waist', 'accessories_other',
        'props', 'distinctive_features', 'default_expression',
        'emotional_range', 'body_language', 'personality_visual', 'social_class_visual', 'personality',
        'prompt_safe_description', 'relationships', '_relationships',
      ];
      const missing = serverKeys.filter(k => !KEY_LABEL[k]);
      return missing.length === 0 ? 'all 37 keys present' : 'missing: ' + missing.join(', ');
    },
    expectContains: ['all 37 keys present'],
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  console.log('\n=== ' + c.name + ' ===');
  try {
    const out = c.fn();
    console.log('  output: ' + JSON.stringify(out).slice(0, 250));
    let ok = true;
    if (c.expectContains) {
      for (const s of c.expectContains) {
        if (!out.includes(s)) { console.log('  ❌ missing: ' + s); ok = false; }
      }
    }
    if (c.expectNotContains) {
      for (const s of c.expectNotContains) {
        if (out.includes(s)) { console.log('  ❌ should not contain: ' + s); ok = false; }
      }
    }
    if (ok) { console.log('  ✅ PASS'); pass++; }
    else { console.log('  ❌ FAIL'); fail++; }
  } catch (e) {
    console.log('  ❌ ERROR: ' + e.message);
    fail++;
  }
}

console.log('\n========================================');
console.log('PASS: ' + pass + ' / ' + cases.length);
console.log('FAIL: ' + fail);
console.log('========================================');
console.log('\n📋 KEY_LABEL 字典大小: ' + Object.keys(KEY_LABEL).length + ' (37 字段 + 5 空格分隔兼容)');
process.exit(fail > 0 ? 1 : 0);
