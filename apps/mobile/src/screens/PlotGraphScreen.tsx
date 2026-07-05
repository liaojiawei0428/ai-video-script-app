/**
 * v2.0.0 - 章节事件图谱
 * 流程: 加载 plot graph → AI 生成(无则) → 时间线展示
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing, radii, typography, shadows } from '../theme';
import { GlassCard, GradientButton, useToast } from '../components';
import { getPlotGraph, generatePlotGraph } from '../api/client';
import type { PlotGraph, PlotGraphChapter, PlotGraphEvent, PlotEventType } from '@ai-script/shared-types';

type RouteParams = { novelId: string };

const EVENT_META: Record<PlotEventType, { label: string; emoji: string; color: string }> = {
  setup: { label: '背景', emoji: '🌱', color: '#6B7280' },
  inciting_incident: { label: '诱发', emoji: '⚡', color: '#F59E0B' },
  rising_action: { label: '上升', emoji: '📈', color: '#3B82F6' },
  climax: { label: '高潮', emoji: '🔥', color: '#EF4444' },
  falling_action: { label: '下落', emoji: '📉', color: '#8B5CF6' },
  resolution: { label: '结局', emoji: '🎬', color: '#10B981' },
  turning_point: { label: '转折', emoji: '🔄', color: '#EC4899' },
};

export function PlotGraphScreen(): React.JSX.Element {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  // v3.0.86 (BUG-162 跨项目通用铁律): React Navigation v6 route.params 默认 undefined
  //   修前 `route.params as RouteParams` 直接 cast, 调用方不传 params → undefined.novelId 崩
  //   修法: (route.params ?? {}) 兜底空对象 (跟 BUG-161 AIAssistantScreen 同源修法)
  const { novelId } = (route.params ?? {}) as RouteParams;
  const toast = useToast();

  const [graph, setGraph] = useState<PlotGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPlotGraph(novelId);
      if (res.data?.data) setGraph(res.data.data);
    } catch (e) {
      console.warn('Load plot graph failed', e);
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generatePlotGraph(novelId);
      setGraph(res.data.data);
      toast.show('事件图谱已生成', 'success');  // v3.0.37 BUG-101: 之前传 'sparkles' 当 ToastVariant, runtime 报 'bg' of undefined
    } catch (e: any) {
      Alert.alert('生成失败', e?.response?.data?.error?.message || e?.message || '请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>章节事件图谱</Text>
        <Text style={styles.pageSub}>
          AI 自动解构小说为 5-8 个章节, 每章包含关键事件与重要性评分, 助你把握整体节奏。
        </Text>

        {!graph && (
          <GlassCard padded={true} style={styles.emptyCard}>
            <Ionicons name="git-network-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>暂无事件图谱</Text>
            <Text style={styles.emptySub}>点击下方按钮让 AI 自动解构小说剧情</Text>
          </GlassCard>
        )}

        {graph && graph.chapters.map((chapter, ci) => (
          <View key={ci} style={styles.chapterBlock}>
            <View style={styles.chapterHeader}>
              <View style={styles.chapterBadge}>
                <Text style={styles.chapterBadgeText}>第{chapter.chapter}章</Text>
              </View>
              <Text style={styles.chapterTitle} numberOfLines={2}>{chapter.title}</Text>
            </View>

            {chapter.events.map((event, ei) => {
              const meta = EVENT_META[event.type] || EVENT_META.setup;
              return (
                <View key={ei} style={styles.eventRow}>
                  <View style={styles.timelineCol}>
                    <View style={[styles.eventDot, { backgroundColor: meta.color }]}>
                      <Text style={styles.eventDotEmoji}>{meta.emoji}</Text>
                    </View>
                    {ei < chapter.events.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <GlassCard padded={true} style={[styles.eventCard, { borderLeftColor: meta.color, borderLeftWidth: 3 }]}>
                    <View style={styles.eventHeader}>
                      <Text style={[styles.eventType, { color: meta.color }]}>{meta.label}</Text>
                      <View style={styles.importanceRow}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <View
                            key={i}
                            style={[styles.star, i < event.importance ? styles.starOn : styles.starOff]}
                          />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.eventSummary}>{event.summary}</Text>
                    {event.characters && event.characters.length > 0 && (
                      <Text style={styles.eventChars}>
                        👥 {event.characters.join('、')}
                      </Text>
                    )}
                  </GlassCard>
                </View>
              );
            })}
          </View>
        ))}

        {graph && (
          <Text style={styles.metaText}>
            生成时间: {new Date(graph.generatedAt).toLocaleString('zh-CN')}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <GradientButton
          title={generating ? 'AI 解构中...' : (graph ? '重新生成事件图谱' : '一键生成事件图谱')}
          onPress={handleGenerate}
          loading={generating}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.primary },
  loadingText: { ...typography.body, color: colors.text.tertiary, marginTop: spacing.md },
  content: { padding: spacing.md, paddingBottom: 100 },
  pageTitle: { ...typography.h1, color: colors.text.primary, fontWeight: '700', marginBottom: spacing.xs },
  pageSub: { ...typography.body, color: colors.text.tertiary, marginBottom: spacing.lg },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.text.primary, marginTop: spacing.md },
  emptySub: { ...typography.body, color: colors.text.tertiary, marginTop: spacing.xs, textAlign: 'center' },
  chapterBlock: { marginBottom: spacing.lg },
  chapterHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  chapterBadge: {
    backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radii.sm, marginRight: spacing.sm,
  },
  chapterBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  chapterTitle: { ...typography.h3, color: colors.text.primary, fontWeight: '700', flex: 1 },
  eventRow: { flexDirection: 'row', marginBottom: spacing.sm },
  timelineCol: { alignItems: 'center', marginRight: spacing.sm, width: 36 },
  eventDot: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  eventDotEmoji: { fontSize: 16 },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4, marginBottom: -spacing.sm },
  eventCard: { flex: 1, marginBottom: spacing.sm },
  eventHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  eventType: { ...typography.caption, fontWeight: '700', fontSize: 12 },
  importanceRow: { flexDirection: 'row' },
  star: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 1 },
  starOn: { backgroundColor: colors.warning },
  starOff: { backgroundColor: colors.border },
  eventSummary: { ...typography.body, color: colors.text.primary, lineHeight: 20 },
  eventChars: { ...typography.caption, color: colors.text.tertiary, marginTop: 4 },
  metaText: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.md, textAlign: 'center' },
  footer: {
    padding: spacing.md, paddingBottom: spacing.lg,
    backgroundColor: colors.bg.primary, borderTopWidth: 1, borderTopColor: colors.border,
  },
});
