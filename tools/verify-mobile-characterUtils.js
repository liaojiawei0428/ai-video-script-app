// tools/verify-mobile-characterUtils.js (纯 JS, 不依赖 tsx)
// 直接复刻 mobile characterUtils.ts 逻辑, 模拟 mobile 端 4 种格式处理

function extractDescriptionText(d) {
  if (!d) return '';
  if (typeof d === 'string') return parseStringToText(d);
  if (typeof d === 'object' && d !== null) return objectToText(d);
  return '';
}

function parseStringToText(s, maxDepth = 3) {
  if (!s || !s.trim()) return '';
  const trimmed = s.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const inner = JSON.parse(trimmed);
      if (typeof inner === 'string') return parseStringToText(inner, maxDepth - 1);
      if (typeof inner === 'object' && inner !== null) return objectToText(inner);
    } catch {}
  }
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      if (typeof obj === 'object' && obj !== null) return objectToText(obj);
    } catch {}
  }
  return s;
}

function objectToText(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return Object.entries(obj)
    .filter(([k, v]) => k !== 'name' && v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      if (Array.isArray(v)) return `- ${k}: ${v.join(', ')}`;
      if (typeof v === 'object') return `- ${k}: ${JSON.stringify(v)}`;
      if (typeof v === 'string' && (v.trim().startsWith('{') || (v.trim().startsWith('"') && v.trim().endsWith('"')))) {
        const cleaned = extractDescriptionText(v);
        if (cleaned !== v) return `- ${k}: ${cleaned.split('\n').join(' | ')}`;
      }
      return `- ${k}: ${v}`;
    })
    .join('\n');
}

function summaryOf(text, max = 80) {
  if (!text) return '';
  const lines = text.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('#') || t.startsWith('-') || t.startsWith('*') || t.startsWith('>')) continue;
    return t.length > max ? t.slice(0, max) + '...' : t;
  }
  return text.slice(0, max);
}

const cases = [
  {
    name: '1. 自由文本字符串 (server v3.0.41 主流程)',
    fn: () => extractDescriptionText('# 独孤琰\n\n## 基本信息\n- 年龄: 18岁\n- 身份: 皇帝\n\n## 外貌与服装\n- 剑眉星目, 身形修长\n\n## 性格与行为\n- 隐忍克制, 心思缜密'),
    expectContains: '独孤琰',
    expectContains2: '## 基本信息',
  },
  {
    name: '2. JSON 字符串 (LLM 误返, 走 objectToText)',
    fn: () => extractDescriptionText('{"name":"秋霞","description":"## 基本信息\\n- 年龄: 16岁\\n- 身份: 陆婕妤的贴身宫女\\n\\n## 性格与行为\\n- 善良单纯, 勇敢护主"}'),
    // 实际行为: parseStringToText 解析 JSON 字符串 → objectToText(name 过滤 → description 是字符串直接拼, 不递归解析 markdown)
    // 这是 mobile 跟 web 端 100% 一致的设计, 跟 web 端 characterUtils.ts 同款行为
    expectContains: '- description:',
    expectContains2: '年龄: 16岁',
  },
  {
    name: '3. JSON 对象 (旧版 11 字段)',
    fn: () => extractDescriptionText({ name: '兰烟', age: '20', height: '约160cm', build: '虎背熊腰', face: '方脸黝黑', features: '铜铃眼', hair: '高髻', personality: '狗仗人势' }),
    expectContains: '- age: 20',
    expectContains2: '- height: 约160cm',
  },
  {
    name: '4. summaryOf 跳 markdown 标题',
    fn: () => summaryOf('# 独孤琰\n\n## 基本信息\n- 年龄: 18岁\n\n独孤琰本是前朝太子, 性格隐忍克制。'),
    expectContains: '独孤琰本是前朝太子',
    expectNotContains: '#',
  },
  {
    name: '5. summaryOf 跳 markdown 列表项',
    fn: () => summaryOf('- 年龄: 18岁\n- 身份: 皇帝\n\n独孤琰本是前朝太子, 性格隐忍。'),
    expectContains: '独孤琰本是前朝太子',
    expectNotContains: '-',
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  console.log('\n=== ' + c.name + ' ===');
  try {
    const out = c.fn();
    console.log('  output: ' + JSON.stringify(out).slice(0, 200));
    let ok = out.includes(c.expectContains);
    if (c.expectContains2) ok = ok && out.includes(c.expectContains2);
    if (c.expectNotContains) ok = ok && !out.includes(c.expectNotContains);
    if (ok) { console.log('  ✅ PASS'); pass++; }
    else {
      console.log('  ❌ FAIL  expected contains: ' + JSON.stringify(c.expectContains));
      fail++;
    }
  } catch (e) {
    console.log('  ❌ ERROR: ' + e.message);
    fail++;
  }
}

console.log('\n========================================');
console.log('PASS: ' + pass + ' / ' + cases.length);
console.log('FAIL: ' + fail);
console.log('========================================');
process.exit(fail > 0 ? 1 : 0);