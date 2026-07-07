#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v3.0.103 BUG-181: 重写 mobile AnalysisCard 为 3 个独立可编辑 Card
跟 web 端 1:1 镜像: 剧情要点 + 主要场景 + 完整AI分析报告 (3 个独立 textarea 永远 active + 保存按钮)
"""
import re

FILE = r"F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\src\screens\EpisodeListScreen.tsx"

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 更新 import (加 updateAnalysisReportApi)
old_import = """import { getEpisodes, generateEpisodes, getTaskProgress, generateShots, getNovelAnalysis } from '../api/client';"""
new_import = """import { getEpisodes, generateEpisodes, getTaskProgress, generateShots, getNovelAnalysis, updateAnalysisReportApi } from '../api/client';"""
content = content.replace(old_import, new_import)

# 2. 修改 analysis state type (加 analysisReport 字段)
old_state = """  const [analysis, setAnalysis] = useState<{ genre: string; style: string; theme: string; scenes: Scene[]; plotPoints: PlotPoint[] } | null>(null);"""
new_state = """  // v3.0.103 (S86 2026-07-07) BUG-181: 加 analysisReport 字段供编辑用 (之前漏存, 修法 1:1 镜像 web 端)
  const [analysis, setAnalysis] = useState<{ genre: string; style: string; theme: string; scenes: Scene[]; plotPoints: PlotPoint[]; analysisReport: string; fullSummary: string } | null>(null);"""
content = content.replace(old_state, new_state)

# 3. 修改 loadData (把 analysisReport + fullSummary 也存进 state)
old_load = """      if (ana.genre || ana.scenes?.length > 0) {
        setAnalysis({ genre: ana.genre, style: ana.style, theme: ana.theme, scenes: ana.scenes || [], plotPoints: ana.plotPoints || [] });
      }"""
new_load = """      // v3.0.103 BUG-181: 把 analysisReport + fullSummary 也存进 state (server 已返, 修前漏存)
      if (ana.genre || ana.scenes?.length > 0 || ana.analysisReport || ana.fullSummary) {
        setAnalysis({ genre: ana.genre, style: ana.style, theme: ana.theme, scenes: ana.scenes || [], plotPoints: ana.plotPoints || [], analysisReport: ana.analysisReport || '', fullSummary: ana.fullSummary || '' });
      }"""
content = content.replace(old_load, new_load)

# 4. 重写 AnalysisCard 组件
old_card = """function AnalysisCard({ analysis }: { analysis: { genre: string; style: string; theme: string; scenes: Scene[]; plotPoints: PlotPoint[] } }) {
  return (
    <View style={styles.analysisCard}>
      <Text style={styles.analysisTitle}>小说分析</Text>
      <View style={styles.analysisTags}>
        <View style={styles.analysisTag}><Text style={styles.analysisTagText}>{analysis.genre}</Text></View>
        <View style={styles.analysisTag}><Text style={styles.analysisTagText}>{analysis.style}</Text></View>
        <View style={styles.analysisTag}><Text style={styles.analysisTagText}>{analysis.theme}</Text></View>
      </View>
      {analysis.plotPoints.length > 0 && (
        <View style={styles.plotSection}>
          <Text style={styles.plotTitle}>📜 剧情大纲</Text>
          {analysis.plotPoints.map((p, i) => (
            <View key={i} style={styles.plotItem}>
              <View style={[styles.plotDot, { backgroundColor: p.type === 'climax' ? '#EF4444' : p.type === 'rising_action' ? '#FF9500' : '#2563EB' }]} />
              <Text style={styles.plotText}>{p.description}</Text>
            </View>
          ))}
        </View>
      )}
      {analysis.scenes.length > 0 && <Text style={styles.scenesHint}>🏞️ {analysis.scenes.length}个主要场景</Text>}
    </View>
  );
}"""

new_card = """// v3.0.103 (S86 2026-07-07) BUG-181: AnalysisCard 重写为 3 个独立可编辑 Card (跟 web 端 1:1 镜像)
//   修前 (v3.0.0 起): 只读显示 4 个 tag + plotPoints 列表 + scenesHint 文字
//   修后 (v3.0.103): 3 个独立 Card (剧情要点 / 主要场景 / 完整AI分析报告), 每个 1 个 textarea 永远 active + 保存按钮
//   跨端铁律 4++ 1:1 镜像 web 端 ScriptDetailPage.tsx line 299-426 的 4 个可编辑卡片
//   v3.0.102 简化思路延续: textarea 永远 active (不要 [编辑/预览] toggle), 用户随时编辑
//   保留 [保存] 按钮: 用户编辑完主动持久化 (避免输入半截就触发请求)
//   3 个 Card 都自带 [复制全部] 按钮, 跟 v3.0.102 web shots 编辑模式 1:1
function AnalysisCard({ analysis, novelId, onUpdated }: { analysis: { genre: string; style: string; theme: string; scenes: Scene[]; plotPoints: PlotPoint[]; analysisReport: string; fullSummary: string }; novelId: string; onUpdated: (newReport: string) => void }) {
  // plot/scenes 从 analysisReport 里 parse 出来 (跟 web 端 ScriptDetailPage.tsx line 33-34 1:1)
  const [plotDraft, setPlotDraft] = React.useState(extractPlot(analysis.analysisReport));
  const [scenesDraft, setScenesDraft] = React.useState(extractScenes(analysis.analysisReport));
  const [reportDraft, setReportDraft] = React.useState(analysis.analysisReport || '');
  const [savingSection, setSavingSection] = React.useState<'plot' | 'scenes' | 'report' | null>(null);
  const [copiedSection, setCopiedSection] = React.useState<'plot' | 'scenes' | 'report' | null>(null);

  const saveSection = async (section: 'plot' | 'scenes' | 'report', newValue: string) => {
    setSavingSection(section);
    try {
      let updated: string;
      if (section === 'report') {
        updated = newValue;
      } else {
        const current = reportDraft || '';
        if (section === 'plot') {
          updated = current.replace(
            /(📜\\s*剧情要点[：:][\\s\\S]*?)(?=🏞️|主要场景|$)/,
            `📜 剧情要点：\\n${newValue}\\n\\n`
          );
          if (updated === current) updated = current + `\\n\\n📜 剧情要点：\\n${newValue}`;
        } else {
          updated = current.replace(
            /(🏞️?\\s*主要场景[：:][\\s\\S]*?)$/,
            `🏞️ 主要场景：\\n${newValue}`
          );
          if (updated === current) updated = current + `\\n\\n🏞️ 主要场景：\\n${newValue}`;
        }
      }
      await updateAnalysisReportApi(novelId, updated);
      setReportDraft(updated);
      onUpdated(updated);
      Alert.alert('已保存', `剧情要点 / 主要场景 / 完整AI分析报告 已持久化到 server`);
    } catch (e: any) {
      Alert.alert('保存失败', e?.response?.data?.error?.message || e?.message || '网络错误');
    } finally {
      setSavingSection(null);
    }
  };

  const copyToClipboard = async (text: string, section: 'plot' | 'scenes' | 'report') => {
    try {
      // v3.0.103: react-native 0.73 已内置 Clipboard API (旧版本需 @react-native-clipboard/clipboard)
      const { Clipboard } = require('react-native');
      Clipboard.setString(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch {
      Alert.alert('复制失败', '请长按文本框手动选择复制');
    }
  };

  return (
    <View style={styles.analysisCard}>
      <Text style={styles.analysisTitle}>小说分析</Text>
      {/* 基本信息 (genre/style/theme) 只读 tag 保持不变 - 用户没要求编辑 4 字段 */}
      <View style={styles.analysisTags}>
        <View style={styles.analysisTag}><Text style={styles.analysisTagText}>{analysis.genre}</Text></View>
        <View style={styles.analysisTag}><Text style={styles.analysisTagText}>{analysis.style}</Text></View>
        <View style={styles.analysisTag}><Text style={styles.analysisTagText}>{analysis.theme}</Text></View>
      </View>

      {/* Card 1: 📜 剧情要点 (跟 web 端 ScriptDetailPage line 299-341 1:1) */}
      <View style={styles.editableCard}>
        <View style={styles.editableCardHeader}>
          <Text style={styles.editableCardTitle}>📜 剧情要点</Text>
          <View style={styles.editableCardMeta}>
            <Text style={styles.editableCardMetaText}>{plotDraft.length} 字符</Text>
            <TouchableOpacity onPress={() => copyToClipboard(plotDraft, 'plot')} style={styles.iconBtn} disabled={!plotDraft}>
              <Ionicons name={copiedSection === 'plot' ? 'checkmark' : 'copy-outline'} size={16} color={plotDraft ? '#2563EB' : '#C7C7CC'} />
            </TouchableOpacity>
          </View>
        </View>
        <TextInput
          style={styles.editableTextarea}
          value={plotDraft}
          onChangeText={setPlotDraft}
          multiline
          textAlignVertical="top"
          placeholder="每行一个剧情要点, 可使用 • - 开头\\n• 主角初遇反派\\n• 反派身份揭晓\\n• 最终决战"
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity
          style={[styles.saveBtn, savingSection === 'plot' && styles.saveBtnDisabled]}
          onPress={() => saveSection('plot', plotDraft)}
          disabled={savingSection !== null}
          activeOpacity={0.7}
        >
          {savingSection === 'plot' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>💾 保存剧情要点</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Card 2: 🏞️ 主要场景 (跟 web 端 ScriptDetailPage line 343-385 1:1) */}
      <View style={styles.editableCard}>
        <View style={styles.editableCardHeader}>
          <Text style={styles.editableCardTitle}>🏞️ 主要场景</Text>
          <View style={styles.editableCardMeta}>
            <Text style={styles.editableCardMetaText}>{scenesDraft.length} 字符</Text>
            <TouchableOpacity onPress={() => copyToClipboard(scenesDraft, 'scenes')} style={styles.iconBtn} disabled={!scenesDraft}>
              <Ionicons name={copiedSection === 'scenes' ? 'checkmark' : 'copy-outline'} size={16} color={scenesDraft ? '#2563EB' : '#C7C7CC'} />
            </TouchableOpacity>
          </View>
        </View>
        <TextInput
          style={styles.editableTextarea}
          value={scenesDraft}
          onChangeText={setScenesDraft}
          multiline
          textAlignVertical="top"
          placeholder="每行一个场景\\n• 皇城大殿 - 金碧辉煌, 是朝政议事之所\\n• 冷宫 - 阴暗潮湿, 关押失势嫔妃"
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity
          style={[styles.saveBtn, savingSection === 'scenes' && styles.saveBtnDisabled]}
          onPress={() => saveSection('scenes', scenesDraft)}
          disabled={savingSection !== null}
          activeOpacity={0.7}
        >
          {savingSection === 'scenes' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>💾 保存主要场景</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Card 3: 📄 完整 AI 分析报告 (跟 web 端 ScriptDetailPage line 387-426 1:1) */}
      <View style={styles.editableCard}>
        <View style={styles.editableCardHeader}>
          <Text style={styles.editableCardTitle}>📄 完整 AI 分析报告</Text>
          <View style={styles.editableCardMeta}>
            <Text style={styles.editableCardMetaText}>{reportDraft.length} 字符</Text>
            <TouchableOpacity onPress={() => copyToClipboard(reportDraft, 'report')} style={styles.iconBtn} disabled={!reportDraft}>
              <Ionicons name={copiedSection === 'report' ? 'checkmark' : 'copy-outline'} size={16} color={reportDraft ? '#2563EB' : '#C7C7CC'} />
            </TouchableOpacity>
          </View>
        </View>
        <TextInput
          style={[styles.editableTextarea, styles.editableTextareaLarge]}
          value={reportDraft}
          onChangeText={setReportDraft}
          multiline
          textAlignVertical="top"
          placeholder="完整的 AI 分析报告, 包含类型/基调/主题/风格/剧情要点/主要场景/角色分析等所有内容. 可以直接编辑, 也可以粘贴新的报告覆盖."
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity
          style={[styles.saveBtn, savingSection === 'report' && styles.saveBtnDisabled]}
          onPress={() => saveSection('report', reportDraft)}
          disabled={savingSection !== null}
          activeOpacity={0.7}
        >
          {savingSection === 'report' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>💾 保存完整 AI 分析报告</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// v3.0.103 BUG-181: 从 analysis_report 中解析 plot section (跟 web 端 SECTION_RE.plot 1:1)
function extractPlot(report: string): string {
  if (!report) return '';
  const m = report.match(/(?:📜\\s*剧情要点|剧情要点)[：:]\\s*([\\s\\S]*?)(?=🏞️|主要场景|$)/u);
  return m ? m[1].trim() : '';
}

// v3.0.103 BUG-181: 从 analysis_report 中解析 scenes section (跟 web 端 SECTION_RE.scenes 1:1)
function extractScenes(report: string): string {
  if (!report) return '';
  const m = report.match(/(?:🏞️?\\s*主要场景|主要场景)[：:]\\s*([\\s\\S]*?)$/u);
  return m ? m[1].trim() : '';
}"""

content = content.replace(old_card, new_card)

# 5. 更新 AnalysisCard 调用点 (2 处: line 123 + 151) 传 novelId + onUpdated
old_call_1 = """            {analysis && (
              <ScrollView style={styles.analysisScroll}>
                <AnalysisCard analysis={analysis} />"""
new_call_1 = """            {analysis && (
              <ScrollView style={styles.analysisScroll}>
                <AnalysisCard analysis={analysis} novelId={novelId} onUpdated={(r) => setAnalysis({ ...analysis, analysisReport: r })} />"""
content = content.replace(old_call_1, new_call_1)

old_call_2 = """            {analysis && <AnalysisCard analysis={analysis} />}"""
new_call_2 = """            {analysis && <AnalysisCard analysis={analysis} novelId={novelId} onUpdated={(r) => setAnalysis({ ...analysis, analysisReport: r })} />}"""
content = content.replace(old_call_2, new_call_2)

# 6. 添加新 styles (editableCard 系列)
# 在 exportButtonText 后面加
old_styles_end = """  exportButtonText: { fontSize: 15, fontWeight: '600', color: '#2563EB' },
});"""
new_styles_end = """  exportButtonText: { fontSize: 15, fontWeight: '600', color: '#2563EB' },
  // v3.0.103 BUG-181: 新增 styles (3 个 editable card 共用)
  editableCard: { backgroundColor: '#F8F9FB', borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  editableCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  editableCardTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', flexShrink: 1 },
  editableCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editableCardMetaText: { fontSize: 11, color: '#94A3B8' },
  iconBtn: { padding: 6, borderRadius: 8 },
  editableTextarea: { minHeight: 80, fontSize: 13, color: '#1C1C1E', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, paddingTop: 10, textAlignVertical: 'top', lineHeight: 20 },
  editableTextareaLarge: { minHeight: 200, fontFamily: 'monospace', fontSize: 12 },
  saveBtn: { backgroundColor: '#2563EB', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});"""
content = content.replace(old_styles_end, new_styles_end)

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. New file size: {len(content)} chars")