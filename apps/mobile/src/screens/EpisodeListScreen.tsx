import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getEpisodes, generateEpisodes, getTaskProgress, generateShots, getNovelAnalysis } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { saveEpisodes } from '../db/sqlite';
import type { NavigationProp, EpisodeListRouteProp } from '../types/navigation';
import { Episode, Scene, PlotPoint } from '@ai-script/shared-types';

export function EpisodeListScreen(): React.JSX.Element {
  const route = useRoute<EpisodeListRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { novelId, novelTitle } = route.params;
  const { episodes, setEpisodes, addActiveTask, updateTaskProgress } = useNovelStore();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<{ genre: string; style: string; theme: string; scenes: Scene[]; plotPoints: PlotPoint[] } | null>(null);

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
      if (ana.genre || ana.scenes?.length > 0) {
        setAnalysis({ genre: ana.genre, style: ana.style, theme: ana.theme, scenes: ana.scenes || [], plotPoints: ana.plotPoints || [] });
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
            {analysis && <AnalysisCard analysis={analysis} />}
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

function AnalysisCard({ analysis }: { analysis: { genre: string; style: string; theme: string; scenes: Scene[]; plotPoints: PlotPoint[] } }) {
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
});
