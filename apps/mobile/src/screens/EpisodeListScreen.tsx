import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getEpisodes, generateEpisodes, getTaskProgress, generateShots, getNovelAnalysis, updateAnalysisReportApi } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { saveEpisodes } from '../db/sqlite';
import type { NavigationProp } from '../types/navigation';
import { Episode, Scene, PlotPoint } from '@ai-script/shared-types';
import { colors } from '../theme';

export function EpisodeListScreen(): React.JSX.Element {
  const route = useRoute<any>();
  const navigation = useNavigation<NavigationProp>();
  // v3.0.86 (BUG-162 跨项目通用铁律): React Navigation v6 route.params 默认 undefined
  //   修前直接解构, 调用方不传 params → undefined.novelId 崩
  //   修法: (route.params ?? {}) 兜底空对象 (跟 BUG-161 AIAssistantScreen 同源修法)
  //   (历史: EpisodeListScreen 是孤儿代码, navigation.ts 没注册 EpisodeListRouteProp, 用弱类型 any 兜底)
  const { novelId = '', novelTitle = '' } = (route.params ?? {}) as { novelId?: string; novelTitle?: string };
  const { episodes, setEpisodes, addActiveTask, updateTaskProgress } = useNovelStore();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  // v3.0.103 (S86 2026-07-07) BUG-181: 加 analysisReport 字段供编辑用 (之前漏存, 修法 1:1 镜像 web 端)
  const [analysis, setAnalysis] = useState<{ genre: string; style: string; theme: string; scenes: Scene[]; plotPoints: PlotPoint[]; analysisReport: string; fullSummary: string } | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: novelTitle || '剧集目录' });
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [epsRes, analysisRes] = await Promise.all([
        getEpisodes(novelId).catch(() => ({ data: { data: { episodes: [] } } })),
        getNovelAnalysis(novelId).catch(() => ({ data: { data: {} } })),
      ]);
      const eps = epsRes.data.data.episodes || [];
      const ana = analysisRes.data.data;
      setEpisodes(eps);
      await saveEpisodes(eps);
      // v3.0.103 BUG-181: 把 analysisReport + fullSummary 也存进 state (server 已返, 修前漏存)
      if (ana.genre || ana.scenes?.length > 0 || ana.analysisReport || ana.fullSummary) {
        setAnalysis({ genre: ana.genre, style: ana.style, theme: ana.theme, scenes: ana.scenes || [], plotPoints: ana.plotPoints || [], analysisReport: ana.analysisReport || '', fullSummary: ana.fullSummary || '' });
      }
    } catch { /* not generated */ }
    setLoading(false);
  };

  const handleGenerate = async () => {
    // 如果已有剧集，提示用户旧内容将被覆盖
    if (episodes.length > 0) {
      return Alert.alert(
        '重新生成',
        `已有 ${episodes.length} 集剧本，重新生成将覆盖旧内容。确定继续？`,
        [
          { text: '取消', style: 'cancel' },
          { text: '确定', style: 'destructive', onPress: doGenerate },
        ]
      );
    }
    doGenerate();
  };

  const doGenerate = async () => {
    setGenerating(true);
    try {
      const response = await generateEpisodes(novelId);
      const { taskId } = response.data.data;
      addActiveTask({ novelId, novelTitle, genre: '', taskId, status: 'running', progress: 0, phase: 'generating' });
      const interval = setInterval(async () => {
        try {
          const res = await getTaskProgress(taskId);
          const t = res.data.data;
          updateTaskProgress(novelId, t.progress, t.status, 'generating');
          if (t.status === 'completed') {
            clearInterval(interval);
            const eps = await getEpisodes(novelId);
            setEpisodes(eps.data.data.episodes);
            await saveEpisodes(eps.data.data.episodes);
            setGenerating(false);
            for (const ep of eps.data.data.episodes) {
              try {
                const shotRes = await generateShots(ep.id);
                if (shotRes.data.data.taskId) await waitForTask(shotRes.data.data.taskId);
              } catch { /* continue */ }
            }
            Alert.alert('生成完成', '剧集和镜头已全部生成');
          } else if (t.status === 'failed') {
            clearInterval(interval); setGenerating(false);
            Alert.alert('生成失败', t.errorMsg || '请重试');
          }
        } catch { /* ignore */ }
      }, 2000);
    } catch { setGenerating(false); Alert.alert('启动失败', '请检查网络连接'); }
  };

  const waitForTask = (taskId: string): Promise<void> => new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const res = await getTaskProgress(taskId);
        if (res.data.data.status === 'completed' || res.data.data.status === 'failed') { clearInterval(interval); resolve(); }
      } catch { clearInterval(interval); resolve(); }
    }, 2000);
  });

  const handleExportAll = async () => {
    const txt = episodes.map(ep => {
      const header = `=== 第${ep.episodeNumber}集：${ep.title} ===\n时长：${ep.durationSec}秒\n摘要：${ep.summary || ''}\n\n`;
      return header + (ep.scriptContent || '');
    }).join('\n\n');
    await Share.share({ message: txt, title: `${novelTitle} - 完整剧本` });
  };

  const totalDuration = episodes.reduce((sum, ep) => sum + (ep.durationSec || 0), 0);

  if (loading) {
    return <View style={styles.container}><ActivityIndicator style={{ marginTop: 60 }} size="large" color="#2563EB" /></View>;
  }

  if (episodes.length === 0 && !generating) {
    return (
      <View style={styles.container}>
        {analysis && (
          <ScrollView style={styles.analysisScroll}>
            <AnalysisCard analysis={analysis} />
            <View style={styles.emptyState}>
              <Ionicons name="film" size={48} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>还未生成剧集</Text>
              <TouchableOpacity style={styles.generateButton} onPress={handleGenerate} disabled={generating}>
                {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateButtonText}>开始生成剧集</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
        {!analysis && (
          <View style={styles.emptyState}>
            <Ionicons name="film" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>还未生成剧集</Text>
            <TouchableOpacity style={styles.generateButton} onPress={handleGenerate} disabled={generating}>
              {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateButtonText}>开始生成剧集</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ListHeaderComponent={
          <>
            {analysis && <AnalysisCard analysis={analysis} novelId={novelId} onUpdated={(r) => setAnalysis({ ...analysis, analysisReport: r })} />}
            <View style={styles.header}>
              <Text style={styles.headerMeta}>共 {episodes.length} 集 · 总时长 {Math.floor(totalDuration / 60)}分{totalDuration % 60}秒</Text>
            </View>
          </>
        }
        data={episodes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.episodeCard}
            onPress={() => navigation.navigate('ShotDetail', { episodeId: item.id, episodeTitle: `第${item.episodeNumber}集 ${item.title}`, novelId })}
          >
            <View style={styles.episodeNum}><Text style={styles.episodeNumText}>{item.episodeNumber}</Text></View>
            <View style={styles.episodeInfo}>
              <Text style={styles.episodeTitle} numberOfLines={1}>{item.title || `第${item.episodeNumber}集`}</Text>
              <Text style={styles.episodeMeta}>{item.durationSec}秒 · {item.sceneLocation || '待定'}</Text>
              {item.summary ? <Text style={styles.episodeSummary} numberOfLines={2}>{item.summary}</Text> : null}
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          episodes.length > 0 ? (
            <TouchableOpacity style={styles.exportButton} onPress={handleExportAll}>
              <Text style={styles.exportButtonText}>导出全部剧本 (TXT)</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

// v3.0.103 (S86 2026-07-07) BUG-181: AnalysisCard 重写为 3 个独立可编辑 Card (跟 web 端 1:1 镜像)
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
            /(📜\s*剧情要点[：:][\s\S]*?)(?=🏞️|主要场景|$)/,
            `📜 剧情要点：\n${newValue}\n\n`
          );
          if (updated === current) updated = current + `\n\n📜 剧情要点：\n${newValue}`;
        } else {
          updated = current.replace(
            /(🏞️?\s*主要场景[：:][\s\S]*?)$/,
            `🏞️ 主要场景：\n${newValue}`
          );
          if (updated === current) updated = current + `\n\n🏞️ 主要场景：\n${newValue}`;
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
          placeholder="每行一个剧情要点, 可使用 • - 开头\n• 主角初遇反派\n• 反派身份揭晓\n• 最终决战"
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
          placeholder="每行一个场景\n• 皇城大殿 - 金碧辉煌, 是朝政议事之所\n• 冷宫 - 阴暗潮湿, 关押失势嫔妃"
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
  const m = report.match(/(?:📜\s*剧情要点|剧情要点)[：:]\s*([\s\S]*?)(?=🏞️|主要场景|$)/u);
  return m ? m[1].trim() : '';
}

// v3.0.103 BUG-181: 从 analysis_report 中解析 scenes section (跟 web 端 SECTION_RE.scenes 1:1)
function extractScenes(report: string): string {
  if (!report) return '';
  const m = report.match(/(?:🏞️?\s*主要场景|主要场景)[：:]\s*([\s\S]*?)$/u);
  return m ? m[1].trim() : '';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  analysisScroll: { flex: 1 },
  analysisCard: { backgroundColor: '#fff', margin: 16, padding: 16, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  analysisTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginBottom: 10 },
  analysisTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  analysisTag: { backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  analysisTagText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  plotSection: { marginTop: 4 },
  plotTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginBottom: 8 },
  plotItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  plotDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, marginRight: 8, flexShrink: 0 },
  plotText: { fontSize: 13, color: '#333', lineHeight: 18, flex: 1 },
  scenesHint: { fontSize: 13, color: '#94A3B8', marginTop: 8 },
  header: { paddingHorizontal: 16, paddingVertical: 8 },
  headerMeta: { fontSize: 14, color: '#94A3B8' },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#94A3B8', marginBottom: 24 },
  generateButton: { backgroundColor: '#2563EB', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  generateButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  episodeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  episodeNum: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  episodeNumText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  episodeInfo: { flex: 1 },
  episodeTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginBottom: 2 },
  episodeMeta: { fontSize: 12, color: '#94A3B8', marginBottom: 2 },
  episodeSummary: { fontSize: 13, color: '#666', lineHeight: 18 },
  arrow: { fontSize: 24, color: '#C7C7CC', marginLeft: 8 },
  exportButton: { marginHorizontal: 16, marginTop: 20, marginBottom: 40, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#2563EB', alignItems: 'center' },
  exportButtonText: { fontSize: 15, fontWeight: '600', color: '#2563EB' },
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
});
