/**
 * Manual test for ffmpegHelper.extractFirstFrameAsPngBase64
 *
 * v3.0.0.23 (S43): 防止 ffmpeg 抽帧回归 (上次手误 \, escape 跟 错用 `,` 都没 work).
 *
 * 跑法 (在 apps/server 目录下):
 *   npm run test:ffmpeg -- /www/wwwroot/shipin-APP/uploads/videos/<userId>/<some>.mp4
 *   或 npx tsx scripts/test-ffmpeg-helper.ts /path/to/sample.mp4
 *
 * 验证项:
 *  1. 抽帧返回 base64 (非空字符串, 长度合理)
 *  2. pngBytes > 0
 *  3. mp4Bytes === statSync(mp4Path).size
 *  4. dimensions 是 WxH 形式 (>= 100x100, <= 4096x4096, 限宽 maxWidth)
 *  5. base64 decode 后写文件能被 ffmpeg 重新识别为 PNG
 *  6. 传不存在路径必须 throw
 */

import { extractFirstFrameAsPngBase64 } from '../src/utils/ffmpegHelper';
import * as fs from 'fs';
import * as path from 'path';

const SAMPLE = process.argv[2];

function assert(cond: any, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  } else {
    console.log('OK:', msg);
  }
}

function main() {
  if (!SAMPLE) {
    console.error('Usage: tsx scripts/test-ffmpeg-helper.ts <path-to-mp4>');
    process.exit(1);
  }
  if (!fs.existsSync(SAMPLE)) {
    console.error('mp4 not found:', SAMPLE);
    process.exit(1);
  }
  console.log('Sample mp4:', SAMPLE, '(' + fs.statSync(SAMPLE).size + ' bytes)');

  // 1. 正常抽帧
  const r = extractFirstFrameAsPngBase64(SAMPLE);
  assert(r.base64.length > 100, 'base64 长度 > 100 (实际 ' + r.base64.length + ')');
  assert(r.pngBytes > 0, 'pngBytes > 0 (实际 ' + r.pngBytes + ')');
  assert(r.mp4Bytes === fs.statSync(SAMPLE).size, 'mp4Bytes === 文件实际大小');
  assert(/^\d{2,4}x\d{2,4}$/.test(r.dimensions), 'dimensions 是 WxH 形式 (实际 ' + r.dimensions + ')');

  // 2. 写回 PNG 文件验证 ffmpeg 抽出来的确实是合法 PNG
  const tmpPng = path.join(require('os').tmpdir(), 'ffmpeg-helper-test-' + Date.now() + '.png');
  const buf = Buffer.from(r.base64, 'base64');
  // PNG magic: 89 50 4E 47 0D 0A 1A 0A
  assert(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47, 'magic bytes 是 PNG header');
  fs.writeFileSync(tmpPng, buf);
  const { spawnSync } = require('child_process');
  const probeRes = spawnSync('/usr/bin/ffmpeg', ['-i', tmpPng, '-hide_banner'], { stdio: ['ignore', 'pipe', 'pipe'] });
  // ffmpeg 把 input info 输出到 stderr
  const probeText = (probeRes.stderr?.toString() || '') + (probeRes.stdout?.toString() || '');
  assert(/png/.test(probeText), 'ffmpeg 能识别抽出来的 PNG');
  fs.unlinkSync(tmpPng);

  // 3. 限宽测试: maxWidth=100 应该抽到 W <= 100
  const r2 = extractFirstFrameAsPngBase64(SAMPLE, { maxWidth: 100 });
  const [w2] = r2.dimensions.split('x').map(Number);
  assert(w2 <= 100, 'maxWidth=100 时抽到的 W <= 100 (实际 ' + w2 + ')');

  // 4. 限宽测试: maxWidth=2048 应该跟原始一样或 ≤ 2048
  const r3 = extractFirstFrameAsPngBase64(SAMPLE, { maxWidth: 2048 });
  const [w3] = r3.dimensions.split('x').map(Number);
  assert(w3 <= 2048, 'maxWidth=2048 时抽到的 W <= 2048 (实际 ' + w3 + ')');

  // 5. 不存在的文件必须 throw
  let threw = false;
  try {
    extractFirstFrameAsPngBase64('/tmp/__not_exists__' + Date.now() + '.mp4');
  } catch (e: any) {
    threw = true;
    console.log('  expected throw:', e.message);
  }
  assert(threw, '不存在文件必须 throw');

  console.log('\nAll ffmpegHelper manual tests passed.');
}

main();
