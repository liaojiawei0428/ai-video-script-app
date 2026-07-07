#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v3.0.102 BUG-179 web EpisodeDetailPage 重构脚本
使用 Python 处理 UTF-8 + 中文，避免 PowerShell Edit 工具中文吃码问题
"""
import re

FILE = r"F:\QiTa\banmu\APP\ai-video-script-app\apps\web\src\pages\EpisodeDetailPage.tsx"

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 修改 import (line 3-8): 删 updateShotApi
content = content.replace(
    "  generateShotsApi, getShotsApi, updateShotApi,",
    "  generateShotsApi, getShotsApi,"
)

# 2. 修改 icon imports (line 14-18): 删 ChevronDown/ChevronUp (不再用)
content = content.replace(
    "  ChevronDown, ChevronUp, Layers, MessageSquare, Clock, Wand2, Eye, Hash, BookOpen, Users,",
    "  Layers, MessageSquare, Clock, Wand2, Eye, Hash, BookOpen, Users,"
)

# 3. 修改 Episode interface (line 22-30): 加 shotsTextCache
content = content.replace(
    "  comicTotalPages?: number;\n}",
    "  comicTotalPages?: number;\n  // v3.0.101 BUG-178: 用户编辑过的整段分镜文本 (server shots_text_cache 字段)\n  //   v3.0.102 (S85 2026-07-07): BUG-179 web 端用整段 textarea 显示 + 编辑\n  shotsTextCache?: string;\n}"
)

# 4. 在 SHOT_STEPS 前插入 formatShotsToText helper (line 38-46 之前)
helper_code = '''// v3.0.102 (S85 2026-07-07) BUG-179: 把 shots 数组拼接成整段文本 (跟 mobile loadShots 1:1 镜像)
function formatShotsToText(shots): string {
  return shots.map((s, i) => {
    if (!s.cameraAngle && !s.cameraMove && !s.lighting) {
      return s.description || '';
    }
    return `【镜头${i + 1} | ${s.durationSec || 0}秒】\\n景别：${s.cameraAngle || '中景'} | 运镜：${s.cameraMove || '固定'} | 灯光：${s.lighting || '自然光'}\\n画面：${s.description || ''}${s.dialogue ? `\\n对白：「${s.dialogue}」` : ''}${s.audioNote ? `\\n音效：${s.audioNote}` : ''}`;
  }).join('\\n\\n---\\n\\n');
}

'''
content = content.replace(
    "const SHOT_STEPS = [",
    helper_code + "const SHOT_STEPS = ["
)

# 5. 删 editShotId/shotDraft/savingShot state (line 60-62), 替换为新 state
content = content.replace(
    "const [editShotId, setEditShotId] = useState<string | null>(null);\n  const [shotDraft, setShotDraft] = useState<Partial<Shot>>({});\n  const [savingShot, setSavingShot] = useState(false);",
    "// v3.0.102 BUG-179: 整段 textarea 模式 (跟 mobile 1:1 镜像)\n  const [shotsTextDraft, setShotsTextDraft] = useState('');\n  const [savingShotsText, setSavingShotsText] = useState(false);"
)

# 6. 删 startEditShot + saveShot + cancelEditShot 函数, 替换为 saveShotsText + useEffect + addToast
# 先在 genStep state 后面插入 addToast
content = content.replace(
    "const [genStep, setGenStep] = useState(0);",
    "const [genStep, setGenStep] = useState(0);\n  // v3.0.102 BUG-179: 提取 addToast 给 saveShotsText 用\n  const addToast = useNotificationStore(s => s.addToast);"
)

# 删 startEditShot + saveShot + cancelEditShot
old_funcs = """  const startEditShot = (shot: Shot) => {
    setEditShotId(shot.id);
    setShotDraft({ ...shot });
  };
  const saveShot = async () => {
    if (!editShotId || savingShot) return;
    setSavingShot(true);
    try {
      const payload = {
        shotNumber: shotDraft.shotNumber,
        description: shotDraft.description,
        durationSec: shotDraft.durationSec,
        sceneType: shotDraft.sceneType,
        location: shotDraft.location,
        timeOfDay: shotDraft.timeOfDay,
        cameraAngle: shotDraft.cameraAngle,
        cameraMove: shotDraft.cameraMove,
        lighting: shotDraft.lighting,
        dialogue: shotDraft.dialogue,
        action: shotDraft.action,
        audioNote: shotDraft.audioNote,
        imagePrompt: shotDraft.imagePrompt,
      };
      await updateShotApi(editShotId, payload);
      setShots(prev => prev.map(s => s.id === editShotId ? { ...s, ...payload } as Shot : s));
      setEditShotId(null);
    } catch (e: any) {
      alert('保存失败: ' + (e?.response?.data?.error?.message || e.message));
    } finally { setSavingShot(false); }
  };

  const cancelEditShot = () => { setEditShotId(null); setShotDraft({}); };"""

new_funcs = """// v3.0.102 BUG-179: 替换为 saveShotsText (跟 mobile handleSaveShots 1:1 镜像)
  const saveShotsText = async () => {
    if (savingShotsText) return;
    setSavingShotsText(true);
    try {
      await updateEpisodeApi(id!, { shotsTextCache: shotsTextDraft });
      setEpisode(prev => prev ? { ...prev, shotsTextCache: shotsTextDraft } : prev);
      addToast({ type: 'system', title: '分镜内容已保存', content: `已保存到 episode.shotsTextCache (${shotsTextDraft.length} 字符)` });
    } catch (e: any) {
      alert('保存失败: ' + (e?.response?.data?.error?.message || e?.message || '网络错误'));
    } finally { setSavingShotsText(false); }
  };"""

content = content.replace(old_funcs, new_funcs)

# 7. 在 cleanup useEffect 后面插入新 useEffect (同步 shots → shotsTextDraft)
# 在第二个 useEffect (cleanup) 后面插入
old_effects = """  useEffect(() => {
    return () => {
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);"""

new_effects = """  useEffect(() => {
    return () => {
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // v3.0.102 BUG-179: 同步 shots → shotsTextDraft (跟 mobile loadShots 1:1 镜像)
  const lastShotsSigRef = useRef<string>('');
  useEffect(() => {
    const sig = (episode?.shotsTextCache || '') + '|' + shots.map(s => s.id + ':' + s.shotNumber).join(',');
    if (sig === lastShotsSigRef.current) return;
    lastShotsSigRef.current = sig;
    if (episode?.shotsTextCache && episode.shotsTextCache.trim()) {
      if (shotsTextDraft !== episode.shotsTextCache) setShotsTextDraft(episode.shotsTextCache);
    } else if (shots.length > 0) {
      const text = formatShotsToText(shots);
      if (shotsTextDraft !== text) setShotsTextDraft(text);
    }
  }, [episode?.shotsTextCache, shots]);"""

content = content.replace(old_effects, new_effects)

# 8. 替换渲染区: 删 ShotsByScene 组件, 替换为 1 个 textarea + 保存按钮 + 复制按钮
old_render = """      {validShots.length === 0 ? (
        <div className="glass p-10 text-center">
          <ImageIcon size={48} className="mx-auto mb-3 text-text-tertiary" />
          <p className="text-text-tertiary">暂无分镜 — 点击右上"生成分镜"按钮开始</p>
        </div>
      ) : (
        <ShotsByScene
          shots={validShots}
          editingId={editShotId}
          draft={editShotId ? shotDraft : null}
          onStartEdit={startEditShot}
          onCancelEdit={cancelEditShot}
          onChangeDraft={setShotDraft}
          onSave={saveShot}
          savingShot={savingShot}
        />
      )}"""

new_render = """      {validShots.length === 0 && !shotsTextDraft.trim() ? (
        <div className="glass p-10 text-center">
          <ImageIcon size={48} className="mx-auto mb-3 text-text-tertiary" />
          <p className="text-text-tertiary">暂无分镜 — 点击右上"生成分镜"按钮开始</p>
        </div>
      ) : (
        // v3.0.102 BUG-179: 1 个 textarea 永远 active, 像 TXT 文档一样编辑
        <div className="glass p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileText size={20} className="text-accent" />
              分镜头描述
              <span className="text-sm text-text-secondary font-normal">
                · {validShots.length} 个镜头 · {validShots.reduce((s, sh) => s + (sh.durationSec || 0), 0).toFixed(1)} 秒
                {shotsTextDraft.length > 0 && <> · {shotsTextDraft.length} 字符</>}
              </span>
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!shotsTextDraft.trim()) {
                    addToast({ type: 'system', title: '没有可复制的内容', content: '请先生成或编辑分镜' });
                    return;
                  }
                  navigator.clipboard.writeText(shotsTextDraft)
                    .then(() => addToast({ type: 'system', title: `已复制分镜内容`, content: `${shotsTextDraft.length} 字符已复制到剪贴板, 可粘贴到任何 AI 工具` }))
                    .catch(() => {
                      const ta = document.createElement('textarea');
                      ta.value = shotsTextDraft; document.body.appendChild(ta); ta.select();
                      document.execCommand('copy'); document.body.removeChild(ta);
                      addToast({ type: 'system', title: `已复制分镜内容 (降级模式)`, content: `${shotsTextDraft.length} 字符已复制` });
                    });
                }}
                className="px-3 py-1.5 text-sm bg-bg-secondary/60 hover:bg-primary/20 border border-border rounded text-text-secondary hover:text-primary flex items-center gap-1.5 transition-colors"
              >
                <Copy size={14} /> 复制全部
              </button>
              <button
                onClick={saveShotsText}
                disabled={savingShotsText}
                className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingShotsText ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                保存修改
              </button>
            </div>
          </div>
          <textarea
            value={shotsTextDraft}
            onChange={e => setShotsTextDraft(e.target.value)}
            rows={Math.max(20, Math.min(60, Math.ceil(shotsTextDraft.length / 80)))}
            placeholder="分镜描述内容...&#10;&#10;支持任意编辑, 删除, 复制. 编辑后点击右上'保存修改'持久化到 server.&#10;&#10;新生成的分镜会自动填到这里, 也可以手动编辑后保存覆盖。"
            className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-3 font-mono leading-relaxed resize-y focus:border-primary/60 focus:outline-none"
          />
          <p className="text-xs text-text-tertiary mt-2">
            💡 这个文本框跟 TXT 文档一样, 随时编辑、复制、删除任意内容. 保存后会持久化到 episode.shotsTextCache, 后续漫画/视频生图也会以你保存的版本为准.
          </p>
        </div>
      )}"""

content = content.replace(old_render, new_render)

# 9. 删 ShotsByScene + CopyAllShotsButton + ShotCard + Field 组件 (在 file 末尾)
# 找 function ShotsByScene 起点, 删到文件末尾 comicImageSrc 之前
shotsby_idx = content.find('// v3.0.101 BUG-178 (S84 2026-07-07): 分镜列表 UI 重设�?')
if shotsby_idx == -1:
    # 备用: 找 function ShotsByScene
    shotsby_idx = content.find('function ShotsByScene({ shots, editingId, draft,')

if shotsby_idx > 0:
    # 找前面的换行
    newline_before = content.rfind('\n', 0, shotsby_idx)
    # 保留到 newline_before + 1, 后面接 comicImageSrc 的 JSDoc
    # 找 comicImageSrc JSDoc 起点
    comic_javadoc_idx = content.find('/**\n * 规范化漫画图片 src:')
    if comic_javadoc_idx > shotsby_idx:
        # 把 newline_before 之前保留, 后面接 comicImageSrc JSDoc + 函数
        content = content[:newline_before + 1] + '\n' + content[comic_javadoc_idx:]
        print(f"Deleted ShotsByScene + CopyAllShotsButton + ShotCard + Field helper ({comic_javadoc_idx - newline_before} chars)")
    else:
        print(f"WARNING: Could not find comicImageSrc JSDoc after ShotsByScene")

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. New file size: {len(content)} chars")