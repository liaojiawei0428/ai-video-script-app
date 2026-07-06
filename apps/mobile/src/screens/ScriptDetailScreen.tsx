import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl, TextInput, Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getEpisodes, getEpisode, getNovelAnalysis, updateNovel, updateCharacter } from '../api/client';
import { saveEpisodes, getEpisodes as getLocalEpisodes } from '../db/sqlite';
import { GlassCard, Tag, SkeletonLoader } from '../components';
import { GeneratingLoader } from '../components/ui';
import { colors, spacing, radii, typography } from '../theme';
import type { NavigationProp, ScriptDetailRouteProp } from '../types/navigation';

// v3.0.92 BUG-170 修: 跨端铁律 4++ 1:1 镜像 web 端 `grid grid-cols-2 md:grid-cols-5` 响应式断点.
//   窄屏 (< 600dp, 跟 web 端 < md:768px 1:1) → 2 列, 宽屏 (>= 600dp, 跟 web 端 >= md 1:1) → 5 列.
//   修前 flex:1 5 等分在 ≤392dp 屏 65dp/pill 撑爆 4 字中文, 修后 grid 响应式不溢出.
const WIDE_BREAKPOINT = 600;

export function ScriptDetailScreen(): React.JSX.Element {
  const route = useRoute<ScriptDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  // v3.0.86 (BUG-162 跨项目通用铁律): React Navigation v6 route.params 默认 undefined
  //   修前直接解构 `const { novelId, novelTitle } = route.params;` 调用方不传 params 崩
  //   修法: (route.params ?? {}) 兜底空对象 (跟 BUG-161 AIAssistantScreen 同源修法)
  const { novelId, novelTitle } = (route.params ?? {}) as ScriptDetailRouteProp['params'];
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

  // v3.0.92 BUG-170 修: 跟 web 端 md: 断点 1:1, 宽屏 5 列 / 窄屏 2 列响应式切换.
  const [isWide, setIsWide] = useState(() => Dimensions.get('window').width >= WIDE_BREAKPOINT);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setIsWide(window.width >= WIDE_BREAKPOINT);
    });
    return () => sub.remove();
  }, []);

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
          <GeneratingLoader size="lg" label="正在加载剧集..." />
          <Text style={{ ...typography.caption, marginTop: 16, color: colors.text.tertiary }}>{loadError || '首次加载可能需要几秒钟'}</Text>
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

            {/* v3.0.92 BUG-170 修: 工具栏改 grid 响应式布局, 跟 web 端 grid-cols-2 md:grid-cols-5 跨端 1:1 镜像.
                修前 flex:1 5 等分在窄屏 (≤392dp) 撑爆每 pill 文字 (4 字中文 "事件图谱" 截断成 "事件图…"), 平板/模拟器正常.
                修后 flexWrap + flexBasis 跟 web 端响应式断点 1:1: 窄屏 2 列 (3 行 2+2+1), 宽屏 (≥600dp) 5 列 (1 行).
                跨项目通用铁律 #28 (跟 BUG-118/120 跨端铁律 4++ "Mobile UI 必响应式" 1:1 同源). */}
            <View style={styles.v2Toolbar}>
              <TouchableOpacity
                style={[styles.v2Btn, isWide ? styles.v2BtnWide5 : styles.v2BtnNarrow2]}
                onPress={() => navigation.navigate('CharacterList' as any, { novelId })}
                activeOpacity={0.7}
              >
                <Ionicons name="people" size={20} color={colors.primary} />
                <Text style={styles.v2BtnText} numberOfLines={1}>角色库</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.v2Btn, isWide ? styles.v2BtnWide5 : styles.v2BtnNarrow2]}
                onPress={() => navigation.navigate('OutlineReview' as any, { novelId })}
                activeOpacity={0.7}
              >
                <Ionicons name="list" size={20} color={colors.primary} />
                <Text style={styles.v2BtnText} numberOfLines={1}>分集大纲</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.v2Btn, isWide ? styles.v2BtnWide5 : styles.v2BtnNarrow2]}
                onPress={() => navigation.navigate('PlotGraph' as any, { novelId })}
                activeOpacity={0.7}
              >
                <Ionicons name="git-network" size={20} color={colors.primary} />
                <Text style={styles.v2BtnText} numberOfLines={1}>事件图谱</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.v2Btn, isWide ? styles.v2BtnWide5 : styles.v2BtnNarrow2]}
                onPress={() => navigation.navigate('AssetLibrary' as any, { novelId })}
                activeOpacity={0.7}
              >
                <Ionicons name="images" size={20} color={colors.primary} />
                <Text style={styles.v2BtnText} numberOfLines={1}>资产库</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.v2Btn, isWide ? styles.v2BtnWide5 : styles.v2BtnNarrow2]}
                onPress={() => navigation.navigate('AIAssistant' as any, { novelId, contextTitle: novelTitle })}
                activeOpacity={0.7}
              >
                <Ionicons name="sparkles" size={20} color={colors.primary} />
                <Text style={styles.v2BtnText} numberOfLines={1}>AI助手</Text>
              </TouchableOpacity>
            </View>
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
  // v3.0.92 BUG-170 修: 改 flexWrap grid 跟 web 端 `grid grid-cols-2 md:grid-cols-5 gap-3` 跨端 1:1 镜像.
  //   修前: flexDirection: 'row' + flex: 1 5 等分, ≤392dp 屏 65dp/pill 撑爆 4 字中文 → "事件图…"
  //   修后: flexWrap: 'wrap' + flexBasis 动态 (窄屏 48% = 2 列, 宽屏 18% = 5 列) + numberOfLines={1}
  v2Toolbar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    paddingHorizontal: spacing.md, marginBottom: spacing.md,
  },
  v2Btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.sm, borderRadius: radii.md,
    backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.primary,
  },
  v2BtnNarrow2: { flexBasis: '48%', minWidth: '48%' }, // 窄屏 2 列 (跟 web 端 grid-cols-2 1:1)
  v2BtnWide5: { flexBasis: '18%', minWidth: '18%', flexGrow: 1 }, // 宽屏 5 列 (跟 web 端 md:grid-cols-5 1:1)
  v2BtnText: { ...typography.caption, color: colors.primary, fontWeight: '700', marginLeft: 4, flexShrink: 1 },
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
