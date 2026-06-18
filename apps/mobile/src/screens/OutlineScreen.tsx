// apps/mobile/src/screens/OutlineScreen.tsx
// v3.0.0 (S58): 任务大纲编辑页 - 跟 web OutlinePage.tsx 1:1 镜像
// 后端: GET/POST /api/novels/:id/outline(generate|confirm)
// 流程: 拉大纲 -> 显示剧集列表 -> 重新生成 / 确认大纲

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  getOutline, generateOutline, confirmOutline,
} from '../api/client';
import { colors, spacing, radii, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';

interface OutlineItem {
  episodeNumber: number;
  title: string;
  summary: string;
  keyCharacters?: string[];
  estimatedDuration: number;
}

interface Outline {
  items: OutlineItem[];
  generatedAt: number;
  confirmedAt?: number;
}

type OutlineRouteProp = RouteProp<RootStackParamList, 'Outline'>;

export function OutlineScreen(): React.JSX.Element {
  const route = useRoute<OutlineRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const novelId = route.params?.novelId;
  const novelTitle = route.params?.novelTitle;

  const [outline, setOutline] = useState<Outline | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!novelId) return;
    setLoading(true);
    try {
      const r = await getOutline(novelId);
      setOutline(r.data?.data || null);
    } catch (e: any) {
      // 没大纲时 404, 静默
      setOutline(null);
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (novelId) load();
    }, [load, novelId])
  );

  // 没 novelId 跳回
  useEffect(() => {
    if (!novelId) {
      Alert.alert('提示', '缺少小说ID', [
        { text: '确定', onPress: () => navigation.goBack() },
      ]);
    }
  }, [novelId, navigation]);

  const handleGen = async () => {
    if (!novelId) return;
    setGenerating(true);
    try {
      await generateOutline(novelId);
      await load();
    } catch (e: any) {
      Alert.alert('生成失败', e?.response?.data?.error?.message || e?.message || '请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirm = async () => {
    if (!novelId) return;
    try {
      await confirmOutline(novelId);
      await load();
      Alert.alert('成功', '大纲已确认');
    } catch (e: any) {
      Alert.alert('确认失败', e?.response?.data?.error?.message || e?.message || '请稍后重试');
    }
  };

  return (
    <View style={styles.container}>
      {/* 操作栏 */}
      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {novelTitle || '分集大纲'}
          </Text>
          <Text style={styles.subtitle}>
            {outline ? `${outline.items.length} 集` : '尚未生成大纲'}
          </Text>
        </View>
        <View style={styles.toolbarActions}>
          <TouchableOpacity
            style={[styles.toolbarBtn, styles.toolbarBtnGhost, generating && { opacity: 0.6 }]}
            onPress={handleGen}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator size="small" color={colors.text.primary} />
            ) : (
              <Text style={styles.toolbarBtnGhostText}>
                {outline ? '重新生成' : '生成大纲'}
              </Text>
            )}
          </TouchableOpacity>
          {outline && !outline.confirmedAt && (
            <TouchableOpacity
              style={[styles.toolbarBtn, styles.toolbarBtnPrimary]}
              onPress={handleConfirm}
            >
              <Text style={styles.toolbarBtnPrimaryText}>确认大纲</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>加载中…</Text>
        </View>
      ) : !outline || outline.items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="list" size={48} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>暂无大纲</Text>
          <Text style={styles.emptyDesc}>点击右上角"生成大纲"开始</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {outline.items.map(item => (
            <View key={item.episodeNumber} style={styles.epCard}>
              <View style={styles.epNumber}>
                <Text style={styles.epNumberText}>{item.episodeNumber}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.epTitleRow}>
                  <Text style={styles.epTitle} numberOfLines={2}>{item.title}</Text>
                  {outline.confirmedAt ? (
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginLeft: spacing.xs }} />
                  ) : null}
                </View>
                <Text style={styles.epSummary} numberOfLines={4}>
                  {item.summary}
                </Text>
                <View style={styles.epMetaRow}>
                  <View style={styles.epMetaItem}>
                    <Ionicons name="time-outline" size={11} color={colors.text.tertiary} />
                    <Text style={styles.epMetaText}>{item.estimatedDuration} 分钟</Text>
                  </View>
                  {item.keyCharacters && item.keyCharacters.length > 0 && (
                    <View style={styles.epMetaItem}>
                      <Ionicons name="people-outline" size={11} color={colors.text.tertiary} />
                      <Text style={styles.epMetaText} numberOfLines={1}>
                        {item.keyCharacters.join('、')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toolbarBtn: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.md,
  },
  toolbarBtnGhost: {
    backgroundColor: colors.bg.tertiary,
  },
  toolbarBtnGhostText: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  toolbarBtnPrimary: {
    backgroundColor: colors.accent,
  },
  toolbarBtnPrimaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyDesc: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  list: {
    padding: spacing.md,
  },
  epCard: {
    flexDirection: 'row',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  epNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  epNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  epTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  epTitle: {
    ...typography.h3,
    color: colors.text.primary,
    flex: 1,
    fontSize: 15,
  },
  epSummary: {
    ...typography.body,
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.xs,
  },
  epMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  epMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  epMetaText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
});
