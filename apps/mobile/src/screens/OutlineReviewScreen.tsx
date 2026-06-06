/**
 * v2.0.0 - 分集大纲确认
 * 流程: 加载大纲 → AI 生成(无则) → 用户可编辑 → 确认
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing, radii, typography, shadows } from '../theme';
import { GlassCard, GradientButton, useToast } from '../components';
import { getOutline, generateOutline, updateOutline, confirmOutline } from '../api/client';
import type { EpisodeOutline, EpisodeOutlineItem } from '@ai-script/shared-types';

type RouteParams = { novelId: string };

export function OutlineReviewScreen(): React.JSX.Element {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { novelId } = route.params as RouteParams;
  const toast = useToast();

  const [outline, setOutline] = useState<EpisodeOutline | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOutline(novelId);
      if (res.data?.data) {
        setOutline(res.data.data);
        setDirty(false);
      }
    } catch (e) {
      console.warn('Load outline failed', e);
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generateOutline(novelId);
      setOutline(res.data.data);
      setDirty(false);
      toast.show('大纲已生成', 'sparkles');
    } catch (e: any) {
      Alert.alert('生成失败', e?.response?.data?.error?.message || e?.message || '请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!outline) return;
    try {
      const res = await updateOutline(novelId, outline.items);
      setOutline(res.data.data);
      setDirty(false);
      toast.show('已保存', 'checkmark-circle');
    } catch (e: any) {
      Alert.alert('保存失败', e?.response?.data?.error?.message || e?.message || '请稍后重试');
    }
  };

  const handleConfirm = async () => {
    if (!outline) return;
    if (dirty) {
      // 先保存再确认
      try { await updateOutline(novelId, outline.items); } catch {}
    }
    setConfirming(true);
    try {
      const res = await confirmOutline(novelId);
      setOutline(res.data.data);
      setDirty(false);
      toast.show('大纲已确认', 'checkmark-done-circle');
      setTimeout(() => navigation.goBack(), 600);
    } catch (e: any) {
      Alert.alert('确认失败', e?.response?.data?.error?.message || e?.message || '请稍后重试');
    } finally {
      setConfirming(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<EpisodeOutlineItem>) => {
    if (!outline) return;
    const items = outline.items.map((it, i) => i === idx ? { ...it, ...patch } : it);
    setOutline({ ...outline, items });
    setDirty(true);
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
        <Text style={styles.pageTitle}>分集大纲</Text>
        <Text style={styles.pageSub}>
          AI 根据小说内容自动拆分, 你可以编辑后确认, 确认后即可生成分集详情。
        </Text>

        {!outline && (
          <GlassCard padded={true} style={styles.emptyCard}>
            <Ionicons name="list-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>暂无大纲</Text>
            <Text style={styles.emptySub}>点击下方按钮让 AI 自动生成分集大纲</Text>
          </GlassCard>
        )}

        {outline && outline.items.map((item, idx) => (
          <GlassCard key={idx} padded={true} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={styles.itemNum}>
                <Text style={styles.itemNumText}>{item.episodeNumber}</Text>
              </View>
              <View style={styles.itemHeaderInfo}>
                <Text style={styles.itemDuration}>{item.estimatedDuration || 120}秒</Text>
                {outline.confirmedAt ? (
                  <View style={styles.confirmedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={colors.success} />
                    <Text style={styles.confirmedBadgeText}> 已确认</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <TextInput
              style={styles.titleInput}
              value={item.title}
              onChangeText={t => updateItem(idx, { title: t })}
              placeholder="本集标题"
              placeholderTextColor={colors.text.tertiary}
              editable={!outline.confirmedAt}
            />
            <TextInput
              style={styles.summaryInput}
              value={item.summary}
              onChangeText={t => updateItem(idx, { summary: t })}
              placeholder="本集剧情概要 100-200 字"
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={4}
              editable={!outline.confirmedAt}
            />
            <Text style={styles.itemChars}>
              角色: {item.keyCharacters?.join('、') || '—'}
            </Text>
          </GlassCard>
        ))}

        {outline && (
          <Text style={styles.metaText}>
            生成时间: {new Date(outline.generatedAt).toLocaleString('zh-CN')}
            {outline.confirmedAt ? ` · 确认时间: ${new Date(outline.confirmedAt).toLocaleString('zh-CN')}` : ''}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {!outline ? (
          <GradientButton
            title={generating ? 'AI 生成中...' : '一键生成分集大纲'}
            onPress={handleGenerate}
            loading={generating}
            style={{ flex: 1 }}
          />
        ) : (
          <>
            {dirty && (
              <GradientButton
                title="保存"
                onPress={handleSave}
                style={{ flex: 1, marginRight: spacing.sm }}
                variant="secondary"
              />
            )}
            {!outline.confirmedAt && (
              <GradientButton
                title={confirming ? '确认中...' : (dirty ? '保存并确认' : '确认大纲')}
                onPress={handleConfirm}
                loading={confirming}
                style={{ flex: 2 }}
              />
            )}
          </>
        )}
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
  itemCard: { marginBottom: spacing.md, ...shadows.sm },
  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  itemNum: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm,
  },
  itemNumText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  itemHeaderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  itemDuration: { ...typography.caption, color: colors.text.tertiary, fontWeight: '600' },
  confirmedBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.md },
  confirmedBadgeText: { ...typography.caption, color: colors.success, fontSize: 11 },
  titleInput: {
    ...typography.h3, color: colors.text.primary, fontWeight: '700',
    backgroundColor: colors.bg.secondary, borderRadius: radii.md, padding: spacing.sm,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  summaryInput: {
    ...typography.body, color: colors.text.primary, lineHeight: 22,
    backgroundColor: colors.bg.secondary, borderRadius: radii.md, padding: spacing.sm,
    borderWidth: 1, borderColor: colors.border, minHeight: 80, textAlignVertical: 'top',
  },
  itemChars: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xs },
  metaText: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.md, textAlign: 'center' },
  footer: {
    flexDirection: 'row', padding: spacing.md, paddingBottom: spacing.lg,
    backgroundColor: colors.bg.primary, borderTopWidth: 1, borderTopColor: colors.border,
  },
});
