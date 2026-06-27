# tools/append-coding-standards-v3.0.43.py
import re

PATH = r"F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\CODING_STANDARDS.md"

with open(PATH, "r", encoding="utf-8-sig") as f:
    content = f.read()

APPEND = """

## 44. middleware setHeader 必在 body 发送前 (源自 BUG-111, S72 batch 12, 跨项目通用)

- ✅ Express middleware 拦截 `res.json` / `res.send`, 必在 `originalJson(body)` 调用**前** `setHeader` (跟 helmet / bodyParser 同款)
- ❌ **禁止** 在 `res.on('finish', () => setHeader(...))` 后 setHeader — Node.js 在 'finish' 事件触发时**已经把 header flush 到 socket**, setHeader 必抛 `ERR_HTTP_HEADERS_SENT`, 整个 Node 进程 crash
- ✅ 304 处理必须在 body 发送前: `res.status(304).end()` 不能在 finish 后调
- ✅ ETag + Cache-Control 跟 If-None-Match 比较流程:
  ```ts
  res.json = function(body: any): Response {
    if (bodyStr) {
      res.setHeader('ETag', tag);  // body 发送前 OK
      const clientTag = req.headers['if-none-match'];
      if (clientTag && clientTag === tag) {
        return res.status(304).end();  // 命中返 304, 不发 body
      }
    }
    return originalJson(body);
  };
  ```
- ⚠️ **真实案例 (S72 batch 12 BUG-111)**: shipin-APP etag.ts 用 `res.on('finish') + setHeader` 反模式, 生产 server 启动后立即 crash, systemd 5 次 retry 后 failed, nginx 反代 6000 返 502 Bad Gateway
- ✅ **修法 SOP**:
  1. 写完 middleware 必先 `node dist/index.js` 单跑一遍验证不会 crash (shipin-APP 部署在远端, 跑 `cd /www/wwwroot/shipin-APP && node dist/index.js`)
  2. 部署后必跑 `verify-deploy.sh` 维度 22 (4 字段含 highlights), 维度 1 (active) PASS
  3. server stderr.log 必 0 `ERR_HTTP_HEADERS_SENT` 错
- 跨项目通用: 任何 Express middleware 拦截 res.json / res.send 都必遵守

## 45. 缓存方案选型必 5 步验证 (源自 BUG-109, S72 batch 11, 跨项目通用)

任何 native module 选型 (MMKV / Lottie / Reanimated / Skia / SQLite / WatermelonDB / etc.) 必跑 5 步验证, **不依赖 README 推荐** (跟 BUG-079 假报告 100% 同源: 文档说 OK ≠ 实际编译通过):

1. **查 peerDependencies**: 跟项目 RN/React/Node 版本兼容? (例: MMKV 4.x 要 nitro + RN 0.85, shipin-APP RN 0.73 → ❌)
2. **查 engines**: 最低 Node/RN 版本? (例: MMKV 2.x 要 Node ≥ 18, shipin-APP Node 22 → ✓)
3. **查 NDK 依赖**: Android native module 需要 NDK build? (例: MMKV 2.x 要 NDK, shipin-APP NDK 没装 → ❌)
4. **npm install + build 验证**: 实测编译通过? (`npm install --legacy-peer-deps && gradlew assembleRelease`)
5. **fallback 兜底**: 失败立即回退, 不阻塞主线 (例: shipin-APP MMKV ❌ → 改用项目已装 react-native-sqlite-storage v6.0.1 ✅)

- ✅ **真实案例 (S72 batch 11 BUG-109)**:
  - MMKV 4.x: 查 peerDeps 失败 (要 nitro + RN 0.85, shipin-APP RN 0.73) → ❌
  - MMKV 2.12.2: 查 NDK 失败 (shipin-APP NDK 没装, [CXX1101] 错) → ❌
  - react-native-sqlite-storage v6.0.1: 5 步全过 → ✅
- ⚠️ **5 步验证必跑 5/5 才算成功**, 任何 1 步不过 → 立即回退
- ✅ 修法: 写一个 shortlist (3-5 个候选), 跑 5 步验证, 选通过数最多的
- 跨项目通用: 任何 native module / 包选型决策都必跑 5 步验证, 不踩"装上去发现 build 不通过" 的坑

---

**最后更新**: 2026-06-27 (S72 batch 11+12 v3.0.43, 加 § 44 middleware setHeader 必在 body 发送前 (BUG-111) + § 45 缓存方案选型 5 步验证 (BUG-109), 跨项目通用铁律, 跟根 AGENTS.md v2.12 + mobile AGENTS.md v1.4 + web AGENTS.md v1.2 + server AGENTS.md v2.2 + BUGS_INDEX.md v2.7 同步)
"""

# Append at end (before "最后更新" line if exists)
if "**最后更新**" in content:
    # Replace last "最后更新" line with APPEND (which has the new one)
    new_content = re.sub(
        r"\*\*最后更新\*\*: [^\n]*\n?$",
        "",
        content.rstrip(),
    )
    new_content = new_content.rstrip() + "\n\n" + APPEND
else:
    new_content = content.rstrip() + "\n" + APPEND

with open(PATH, "w", encoding="utf-8") as f:
    f.write(new_content)

# Verify
print("SUCCESS: CODING_STANDARDS.md § 44 + § 45 + 新最后更新日期已追加")
print(f"  文件总行数: {new_content.count(chr(10))}")
if "## 44. middleware setHeader" in new_content:
    print("  § 44: ✓ 已加")
if "## 45. 缓存方案选型" in new_content:
    print("  § 45: ✓ 已加")
if "S72 batch 11+12 v3.0.43" in new_content:
    print("  最后更新: ✓ 已改")
else:
    print("  最后更新: ✗ 未改")