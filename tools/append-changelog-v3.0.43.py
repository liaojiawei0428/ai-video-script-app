# tools/append-changelog-v3.0.43.py
import json, sys

CHANGELOG = r"F:\QiTa\banmu\APP\ai-video-script-app\apps\server\changelog.json"

NEW_ENTRY = {
    "version": "3.0.43",
    "buildDate": "2026-06-27",
    "type": "minor",
    "summary": "Stage 1+2+3 统一加载 UI 模块 (Skeleton + ImageWithLoading + useCachedMedia + GeneratingLoader + useMediaLoader, 跨端铁律 4++ Web→APP 1:1, 解决 5Mbps 慢加载)",
    "highlights": [
        "Stage 1 BUG-108: web + mobile 新建 components/ui/ 独立目录 (Skeleton + ImageWithLoading, shadcn 风格), 集成 CharacterDetail + AssetLibrary + ScriptDetail + EpisodeDetail + ImageAgent 5 处, 跨端铁律 4++ UI 组件 1:1 镜像",
        "Stage 2 BUG-109: server etag middleware (JSON SHA-256 hash + 304), mobile mediaCache.ts (RNFS + react-native-sqlite-storage v6.0.1 + djb2+reverse hash + LRU 500MB/1000 文件), web + mobile useCachedMedia hook 跨端 1:1 API",
        "Stage 2 BUG-109 教训: MMKV 4.x 不兼容 RN 0.73, MMKV 2.x 要 NDK (shipin-APP 缺 [CXX1101]), 改用 react-native-sqlite-storage v6.0.1 (项目已装, 性能 < 5ms)",
        "Stage 3 BUG-110: web + mobile GeneratingLoader (CSS spinner 1s + border-t-blue-500 跨端 1:1 镜像 Animated spinner 1000ms + #3b82f6), useMediaLoader hook (4 态 + retry + MAX_RETRIES 3, 封装 useCachedMedia)",
        "Stage 3 BUG-110 教训: lottie-react 不支持 path (要 animationData), lottie-react-native 要 NDK (缺), 改走 fallback CSS/Animated spinner (Stage 3.5 接入)",
        "verify 3 件: tools/verify-bug109-media-cache.js (8/8 PASS) + tools/verify-bug110-media-loader.js (8/8 PASS) + tools/verify-version-8-points.js (6/6 PASS)",
        "8 项版本号同步 3.0.42→3.0.43 (mobile version.ts + build.gradle versionCode 46→47 + server package.json + index.ts fallback + ecosystem 2 处 + web version.ts + APP_VERSION_CODE 46→47 + changelog.json)"
    ]
}

with open(CHANGELOG, "r", encoding="utf-8-sig") as f:
    data = json.load(f)

# 检查是否已经有 v3.0.43 (防止重复 append)
existing_versions = [e["version"] for e in data["entries"]]
if "3.0.43" in existing_versions:
    print("ERROR: changelog 已有 v3.0.43 条目, 不重复 append")
    print("现有 v3.0.43 索引: " + str(existing_versions.index("3.0.43")))
    sys.exit(1)

# 按 VERSION_MANAGEMENT.md § 4 规范: 每次发版必追加当前版本条目 (同 version 最新放末尾)
data["entries"].append(NEW_ENTRY)

# 写回, 保持原 indentation (4 spaces top + 2 spaces entries)
with open(CHANGELOG, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")  # 末尾 newline (跟原文件一致)

print("✅ append v3.0.43 条目成功")
print("现在 entries 总数: " + str(len(data["entries"])))
print("最后一条 version: " + data["entries"][-1]["version"])
print("最后一条 buildDate: " + data["entries"][-1]["buildDate"])
print("最后一条 highlights 数: " + str(len(data["entries"][-1]["highlights"])))