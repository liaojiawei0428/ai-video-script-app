// apps/server/scripts/fix-changelog.js (round 3 - clean)
//
// Round 3 算法:
//   匹配模式: "  \r  \n  [whitespace indent]  "
//   含义: array element close-quote + CRLF + indent + next element open-quote
//   缺 array separator `,`. 注入 `,` after LF, before indent (继续复制 indent unchanged).

const fs = require('fs');
const PATH = 'apps/server/changelog.json';
const buf = fs.readFileSync(PATH);

const DQUOTE = 0x22;
const CR = 0x0D;
const LF = 0x0A;
const SPACE = 0x20;
const TAB = 0x09;
const COMMA = 0x2C;
const BRACE_OPEN = 0x7B;
const BRACKET_OPEN = 0x5B;

const parts = [];
let count = 0;
let i = 0;

while (i < buf.length) {
  if (
    buf[i] === DQUOTE &&
    i + 2 < buf.length &&
    buf[i + 1] === CR &&
    buf[i + 2] === LF
  ) {
    let j = i + 3;
    while (j < buf.length && (buf[j] === SPACE || buf[j] === TAB)) j++;
    if (j < buf.length && buf[j] === DQUOTE) {
      // confirm prior non-whitespace byte is NOT already `,`, `{`, `[`
      let k = i - 1;
      while (k >= 0 && (buf[k] === SPACE || buf[k] === TAB || buf[k] === CR || buf[k] === LF)) k--;
      const prev = k >= 0 ? buf[k] : 0xFF; // treat start-of-file as not-preceded
      if (prev !== COMMA && prev !== BRACE_OPEN && prev !== BRACKET_OPEN) {
        // inject comma: emit " <CR> <LF> <COMMA> (indent unchanged) "
        parts.push(buf.slice(i, i + 1)); // "
        parts.push(buf.slice(i + 1, i + 2)); // CR
        parts.push(buf.slice(i + 2, i + 3)); // LF
        parts.push(Buffer.from([COMMA])); // NEW comma
        count++;
        i = i + 3; // now i at indent start
        // copy indent unchanged
        let jj = i;
        while (jj < buf.length && (buf[jj] === SPACE || buf[jj] === TAB)) jj++;
        parts.push(buf.slice(i, jj));
        i = jj;
        continue;
      }
    }
  }
  parts.push(buf.slice(i, i + 1));
  i++;
}

const fixed = Buffer.concat(parts);
fs.writeFileSync(PATH, fixed);
console.log('count=' + count + ' bytes_before=' + buf.length + ' bytes_after=' + fixed.length);
try {
  const j = JSON.parse(fixed.toString('utf8'));
  console.log('OK entries=' + j.entries.length + ' latest=' + j.latest_version);
} catch (e) {
  console.log('FAIL after fix:', e.message);
  const m = /position (\d+)/.exec(e.message);
  if (m) {
    const p = parseInt(m[1]);
    console.log('context:', JSON.stringify(fixed.toString('utf8').slice(Math.max(0, p - 60), p + 60)));
  }
  process.exit(1);
}
