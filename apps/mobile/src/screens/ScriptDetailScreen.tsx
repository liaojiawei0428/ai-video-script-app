import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl, TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getEpisodes, getEpisode, getNovelAnalysis, updateNovel, updateCharacter } from '../api/client';
import { saveEpisodes, getEpisodes as getLocalEpisodes } from '../db/sqlite';
import { GlassCard, Tag, SkeletonLoader } from '../components';
import { colors, spacing, radii, typography } from '../theme';
import type { NavigationProp, ScriptDetailRouteProp } from '../types/navigation';

export function ScriptDetailScreen(): React.JSX.Element {
  const route = useRoute<ScriptDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { novelId, novelTitle } = route.params;
  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loadingEpId, setLoadingEpId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string>('');
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editTheme, setEditTheme] = useState('');
  const [editStyle, setEditStyle] = useState('');
  const [editTone, setEditTone] = useState('');
  const [editChars, setEditChars] = useState<any[]>([]);
  const [charText, setCharText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!novelId) return;
    navigation.setOptions({ title: novelTitle || '剧本详情' });

    let cancelled = false;
    (async () => {
      // 1. 先加载本地数据（秒开）
      try {
        const local = await getLocalEpisodes(novelId);
        if (local && local.length > 0 && !cancelled) {
          setEpisodes(local);
          setLoading(false); // 本地有数据就停止加载动画
        }
      } catch {}
    })();

    (async () => {
      try {
        const epsRes = await getEpisodes(novelId);
        if (cancelled) return;
        const eps = epsRes.data.data.episodes || [];
        setEpisodes(eps);
        await saveEpisodes(eps).catch(() => {});
        // 加载分析报告
        const analysisData = (await getNovelAnalysis(novelId).catch(() => ({ data: { data: {} } }))).data?.data || {};
        setAnalysis(analysisData);
        setEditGenre(analysisData.genre || '');
        setEditTheme(analysisData.theme || '');
        setEditStyle(analysisData.style || '');
        setEditTone(analysisData.tone || '');
        setEditChars((analysisData.characters || []).map((c: any) => ({ ...c })));
        const roleMap: Record<string, string> = { protagonist: '主角', antagonist: '反派', supporting: '配角', minor: '龙套' };
        setCharText((analysisData.characters || []).map((c: any) => `${c.name} | ${roleMap[c.roleType] || c.roleType || '配角'} | ${c.personality || ''} | ${c.appearance || ''}`).join('\n\n'));
        if (analysisData.analysisReport) {
          setAnalysisText(analysisData.analysisReport);
        } else if (analysisData.fullSummary) {
          setAnalysisText(analysisData.fullSummary);
        }
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.response?.status === 401 ? '登录已过期' : '加载失败，下拉刷新重试');
      }
      if (!cancelled) setLoading(false);
    })();

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setLoadError('加载超时，请下拉刷新重试');
      }
    }, 15000);

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [novelId, novelTitle]);

  const handleEpisodePress = async (ep: any) => {
    setLoadingEpId(ep.id);
    try {
      const res = await getEpisode(ep.id);
      const fullEp = res.data.data?.episode;
      if (fullEp) {
        navigation.navigate('EpisodeDetail', {
          novelId,
          episodeId: ep.id,
          episodeTitle: `第${ep.episodeNumber}集 ${ep.title || ''}`,
        });
      }
    } catch {}
    setLoadingEpId(null);
  };

  const totalDuration = episodes.reduce((sum: number, ep: any) => sum + (ep.durationSec || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const t = analysisText || '';
      const genre = (t.match(/类型[：:]\s*(.+)/) || [])[1]?.trim() || editGenre;
      const theme = (t.match(/主题[：:]\s*(.+)/) || [])[1]?.trim() || editTheme;
      const style = (t.match(/风格[：:]\s*(.+)/) || [])[1]?.trim() || editStyle;
      const tone = (t.match(/基调[：:]\s*(.+)/) || [])[1]?.trim() || editTone;
      
      await updateNovel(novelId, { genre, theme, style, tone });
      
      const roleReverseMap: Record<string, string> = { '主角': 'protagonist', '反派': 'antagonist', '配角': 'supporting', '龙套': 'minor' };
      const charSection = t.split(/角色[：:]/)[1] || t;
      const charLines = charSection.split('\n').filter(l => l.trim() && !l.match(/^(类型|主题|风格|基调)[：:]/));
      const origChars = analysis?.characters || [];
      for (let i = 0; i < charLines.length && i < origChars.length; i++) {
        const line = charLines[i].replace(/^\d+[\.、]\s*/, '');
        const parts = line.split('|').map(p => p.trim());
        if (parts[0]) {
          await updateCharacter(origChars[i].id, {
            name: parts[0],
            roleType: roleReverseMap[parts[1]] || parts[1] || '',
            personality: parts[2] || '',
            appearance: parts[3] || '',
          }).catch(() => {});
        }
      }
      
      setEditGenre(genre); setEditTheme(theme); setEditStyle(style); setEditTone(tone);
      setAnalysis({ ...analysis, genre, theme, style, tone });
    } catch {}
    setSaving(false);
  };

  if (!novelId) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="warning" size={48} color={colors.warning} />
          <Text style={styles.emptyText}>剧本 ID 无效</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ ...typography.body, marginTop: 16, color: colors.text.tertiary }}>正在加载剧集...</Text>
          <Text style={{ ...typography.caption, marginTop: 8, color: colors.text.tertiary }}>{loadError || '首次加载可能需要几秒钟'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ListHeaderComponent={
          <>
            {loadError && episodes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="film" size={48} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>{loadError}</Text>
              </View>
            ) : null}
            {analysis && (
              <GlassCard padded={true} style={{ margin: spacing.md }}>
                <Text style={styles.analysisTitle}>{novelTitle}</Text>
                <Text style={styles.analysisReportText}>
                  {analysisText || `类型：${editGenre || '—'}\n主题：${editTheme || '—'}\n风格：${editStyle || '—'}\n基调：${editTone || '—'}\n\n角色：\n${charText}`}
                </Text>
              </GlassCard>
            )}
            {episodes.length > 0 && (
              <View style={styles.episodeHeader}>
                <Text style={styles.episodeHeaderTitle}>剧集列表</Text>
                <Text style={styles.episodeHeaderMeta}>{episodes.length}集 · 总时长 {Math.floor(totalDuration / 60)}分</Text>
              </View>
            )}
          </>
        }
        data={episodes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.episodeCard}
            onPress={() => handleEpisodePress(item)}
            disabled={loadingEpId === item.id}
          >
            <View style={styles.episodeNum}>
              <Text style={styles.episodeNumText}>{item.episodeNumber}</Text>
            </View>
            <View style={styles.episodeInfo}>
              <Text style={styles.episodeTitle} numberOfLines={1}>{item.title || `第${item.episodeNumber}集`}</Text>
              <View style={styles.episodeMetaRow}>
                <Text style={styles.episodeMeta}>{item.durationSec || 3}秒</Text>
                {item.charCount ? <Text style={styles.episodeMeta}>· {item.charCount}字</Text> : null}
                {item.status === 'completed' ? (
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                ) : item.status === 'failed' ? (
                  <Ionicons name="close-circle" size={16} color={colors.error} />
                ) : null}
              </View>
              {item.summary ? <Text style={styles.episodeSummary} numberOfLines={1}>{item.summary}</Text> : null}
            </View>
            {loadingEpId === item.id ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={styles.arrow}>›</Text>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={loading ? null : (
          <View style={styles.emptyState}>
            <Ionicons name="film" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>{loadError || '暂无剧集数据'}</Text>
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                const epsRes = await getEpisodes(novelId);
                const eps = epsRes.data.data.episodes || [];
                setEpisodes(eps);
                setLoadError(eps.length === 0 ? '该小说暂无剧集数据' : '');
              } catch { setLoadError('加载失败'); }
              setRefreshing(false);
            }}
            tintColor="#2563EB"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  list: { paddingBottom: 40 },
  analysisTitle: { ...typography.h2, marginBottom: spacing.sm },
  analysisReportText: { ...typography.body, color: colors.text.secondary, lineHeight: 22 },
  editLabel: { ...typography.caption, color: colors.text.secondary, marginTop: spacing.sm, marginBottom: spacing.xs },
  editInput: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.sm,
    padding: spacing.sm,
    color: colors.text.primary,
    fontSize: 14,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editRow: { flexDirection: 'row', gap: spacing.sm },
  charTextBox: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.md,
    padding: spacing.sm,
    color: colors.text.primary,
    ...typography.body,
    lineHeight: 22,
    minHeight: 120,
    maxHeight: 400,
    textAlignVertical: 'top',
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  expandBtn: { paddingVertical: spacing.sm, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: spacing.sm },
  expandText: { ...typography.caption, color: colors.accent, fontWeight: '600' },
  analysisTextBox: { backgroundColor: colors.bg.secondary, borderRadius: radii.md, padding: spacing.sm, color: colors.text.primary, ...typography.body, lineHeight: 22, minHeight: 150, maxHeight: 500, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveBtnText: { ...typography.h3, color: colors.text.inverse },
  plotSection: { marginBottom: spacing.xs },
  plotItem: { flexDirection: 'row', marginBottom: spacing.xs },
  plotBullet: { fontSize: 14, color: colors.accent, marginRight: spacing.sm, marginTop: -1 },
  plotText: { ...typography.body, color: colors.text.secondary, flex: 1 },
  episodeHeader: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  episodeHeaderTitle: { ...typography.h2, color: colors.text.primary },
  episodeHeaderMeta: { ...typography.caption, marginTop: spacing.xs },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm + 2,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  episodeNum: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm + 2,
  },
  episodeNumText: { ...typography.h3, color: colors.text.inverse },
  episodeInfo: { flex: 1 },
  episodeTitle: { ...typography.h3, color: colors.text.primary, marginBottom: 2 },
  episodeMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  episodeMeta: { ...typography.caption, marginRight: spacing.sm },
  statusCompleted: { fontSize: 12 },
  statusFailed: { fontSize: 12 },
  episodeSummary: { ...typography.caption, color: colors.text.tertiary },
  arrow: { fontSize: 24, color: colors.text.tertiary, marginLeft: spacing.sm },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyText: { ...typography.h3, color: colors.text.tertiary },
});
