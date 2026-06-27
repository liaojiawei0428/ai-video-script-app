// 角色列表页 v3.0.29 (S63 UI redesign)
// 跟 web CharacterListPage 1:1 对齐逻辑, 但 UI 全重设计
//
// 设计动机 (user 反馈 S63):
//   旧版 (v3.0.28): 文字太黑 (text.tertiary 跟背景对比度 4.36:1, 几乎看不见)
//                    UI 太丑 (emoji 当 icon, 12.5% alpha chip 隐形, 卡片扁平无层次)
//   新版 (v3.0.29):
//     1. 顶部 hero banner (渐变 + 角色总数 + 重新分析按钮)
//     2. 卡片用 surface 层 (1A1A2E 跟背景对比) + 1px border + sm shadow
//     3. 大头像 (72x72) + 角色色 ring + 状态 dot
//     4. 角色类型用 RoleChip (替代 emoji 🏷)
//     5. 状态用 StatusChip (5 态, 替代 emoji ✏️ 🖼️)
//     6. 文字层级用 text.body (11.6:1 对比度, 替代 text.tertiary)
//     7. 空态用 EmptyState 组件 (圆形渐变 icon + CTA)
//     8. 整体风格: Linear / Notion dark theme

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { listCharactersByNovel, getStylePresets, backfillCharactersApi } from '../api/client';
import { getCharacters as getLocalCharacters, saveCharacters as saveCharactersDb } from '../db/sqlite';
import type { Character, StylePreset } from '@ai-script/shared-types';
import { showToast, CharacterAvatar, RoleChip, StatusChip, StyleChip, EmptyState, LinearGradientView as LinearGradient } from '../components';
import { colors, spacing, radii, typography } from '../theme';
import { surface, text, gradient, getStatusInfo } from '../theme/character';
import { extractDescriptionText, summaryOf } from '../utils/characterUtils'; // v3.0.41 (BUG-105 mobile sync): 走统一 utils, summaryOf 跳 markdown 标题/列表项, 取第一段正文

type RouteParams = { novelId: string };

export function CharacterListScreen(): React.JSX.Element {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { novelId } = route.params as RouteParams;

  const [characters, setCharacters] = useState<Character[]>([]);
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    // 🆕 S72 batch 16 v3.0.45 BUG-115 缓存方案 A.4: 本地优先 + server 同步
    // 1. 优先加载本地数据 (秒开 + 离线可用)
    const local = await getLocalCharacters(novelId).catch(() => []);
    if (local.length > 0) {
      setCharacters(local);
      setLoading(false); // 本地有数据就停止 loading
    }

    // 2. 从服务端同步最新数据
    try {
      const [charRes, styleRes] = await Promise.all([
        listCharactersByNovel(novelId),
        getStylePresets().catch(() => ({ data: { data: { presets: [] } } })),
      ]);
      const serverChars = charRes.data?.data?.characters || [];
      // 🆕 S72 batch 17 v3.0.46 BUG-116 缓存方案 B.4: ETag/304 短路检查
      const fromCache = (charRes as any)?.headers?.['x-cache'] === 'HIT-304';
      if (!fromCache && (serverChars.length > 0 || local.length === 0)) {
        setCharacters(serverChars);
        await saveCharactersDb(serverChars).catch(() => {});
      }
      // else: 304 命中 → skip setState + skip saveDb (server 数据没变)
      setStylePresets(styleRes.data?.data?.presets || []);
    } catch (e) {
      console.warn('Load characters failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [novelId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleBackfill = async () => {
    if (!novelId || backfilling) return;
    setBackfilling(true);
    setBackfillMsg('🎭 正在从小说原文重新分析角色, 请稍候...');
    try {
      const r = await backfillCharactersApi(novelId);
      const d: any = r.data?.data;
      const parts: string[] = [];
      if (d?.created > 0) parts.push(`新建 ${d.created} 个角色`);
      if (d?.descriptionsGenerated !== undefined) {
        parts.push(`描述生成 ${d.descriptionsGenerated}/${d?.total || 0} 个`);
      }
      setBackfillMsg(`✅ ${parts.join('，') || '已启动'}。3 秒后刷新...`);
      setTimeout(load, 3000);
    } catch (err: any) {
      setBackfillMsg(`❌ 失败: ${err?.response?.data?.error?.message || err.message}`);
      showToast({ message: '重新分析失败', variant: 'error' });
    } finally {
      setBackfilling(false);
    }
  };

  const styleNameOf = (sid?: string) => stylePresets.find(s => s.id === sid)?.name || sid || '-';

  // 统计
  const confirmedCount = characters.filter(c => c.confirmed).length;
  const sheetReadyCount = characters.filter(c =>
    (c.imageVariants || []).some((v: any) => v.angle === 'sheet')
  ).length;

  const renderItem = ({ item }: { item: Character }) => {
    const status = getStatusInfo(item);
    const descText = extractDescriptionText(item.description);
    const descSummary = descText ? summaryOf(descText, 100) : '暂无描述, 点击下方"重新分析角色"生成';
    // v3.0.28: 单图三视图 sheet
    const sheetVariant = (item.imageVariants || []).find((v: any) => v.angle === 'sheet');
    const cover = (sheetVariant as any)?.imageData || (sheetVariant as any)?.url;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          if (!descText) {
            navigation.navigate('CharacterDescriptionReview', { characterId: item.id, novelId });
          } else {
            navigation.navigate('CharacterDetail', { characterId: item.id });
          }
        }}
      >
        <View style={styles.card}>
          {/* 左侧: 角色头像 (72x72) */}
          <CharacterAvatar
            name={item.name}
            roleType={item.roleType}
            imageUrl={cover}
            size="md"
            statusColor={status.color}
            pulsing={status.animated}
          />

          {/* 右侧: 名字 + 角色 + 状态 + 描述摘要 */}
          <View style={styles.cardBody}>
            {/* 名字行 */}
            <View style={styles.nameRow}>
              <Text style={styles.charName} numberOfLines={1}>
                {item.name}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={text.subtle} />
            </View>

            {/* chip 行: 角色类型 + 状态 */}
            <View style={styles.chipRow}>
              <RoleChip roleType={item.roleType} />
              <StatusChip statusKey={status.key} />
              {item.styleId && <StyleChip styleId={item.styleId} />}
            </View>

            {/* 描述摘要 (2 行, 弱化文字) */}
            <Text style={styles.descSummary} numberOfLines={2}>
              {descSummary}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Hero header (跟卡片有视觉区分: 渐变背景 + 统计)
  const renderHero = () => (
    <LinearGradient
      colors={gradient.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      {/* 渐变装饰 (右上角光晕) */}
      <LinearGradient
        colors={gradient.heroAccent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGlow}
      />

      <View style={styles.heroContent}>
        <View style={styles.heroIconRow}>
          <Ionicons name="people" size={24} color="#fff" />
          <Text style={styles.heroTitle}>角色库</Text>
        </View>
        <Text style={styles.heroSubtitle}>
          共 {characters.length} 个角色 · 已确认 {confirmedCount} · 已生图 {sheetReadyCount}
        </Text>

        {/* 重新分析按钮 (右上角) */}
        <TouchableOpacity
          onPress={handleBackfill}
          disabled={backfilling}
          activeOpacity={0.8}
          style={[styles.heroBtn, backfilling && { opacity: 0.6 }]}
        >
          {backfilling ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="sparkles" size={14} color="#fff" />
              <Text style={styles.heroBtnText}>重新分析角色</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />
      <FlatList
        data={characters}
        keyExtractor={c => c.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {renderHero()}
            {backfillMsg && (
              <View style={styles.backfillMsg}>
                <Text style={styles.backfillMsgText}>{backfillMsg}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="暂无角色"
            subtitle="上传小说后, AI 会自动分析并生成角色描述。也可以点击下方按钮手动触发。"
            ctaLabel="重新分析角色"
            ctaIcon="sparkles"
            onCta={handleBackfill}
            loading={backfilling}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.primary },
  list: { paddingBottom: 40 },

  // Hero
  hero: {
    position: 'relative',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radii.lg,
    overflow: 'hidden',
    minHeight: 110,
    borderWidth: 1,
    borderColor: surface.cardBorder,
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.35,
  },
  heroContent: {
    padding: spacing.lg,
    gap: 6,
  },
  heroIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '500',
  },
  heroBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: surface.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: surface.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  cardBody: {
    flex: 1,
    marginLeft: spacing.md,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  charName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: text.primary,
    letterSpacing: -0.2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  descSummary: {
    fontSize: 13,
    color: text.muted, // 关键: 11.6:1 对比度, 替代 text.tertiary
    lineHeight: 19,
  },

  // Backfill 消息
  backfillMsg: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: surface.section,
    borderWidth: 1,
    borderColor: surface.sectionBorder,
  },
  backfillMsgText: {
    fontSize: 13,
    color: text.body,
    lineHeight: 18,
  },
});
