import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing, radii, typography, shadows } from '../theme';
import { GlassCard } from '../components';
import { listCharactersByNovel, getStylePresets } from '../api/client';
import type { CharacterWithAssets, StylePreset } from '@ai-script/shared-types';

type RouteParams = { novelId: string };

export function CharacterListScreen(): React.JSX.Element {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { novelId } = route.params as RouteParams;

  const [characters, setCharacters] = useState<CharacterWithAssets[]>([]);
  const [styles, setStyles] = useState<StylePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [charRes, styleRes] = await Promise.all([
        listCharactersByNovel(novelId),
        getStylePresets().catch(() => ({ data: { data: [] } })),
      ]);
      // v3.0.5 (S58 P6 BUG-011): server 返 { characters: [...], total: N }, 之前直接拿 data 当数组 → 渲染空
      // server: characterController.listByNovel line 85 return success(res, { characters, total })
      setCharacters(charRes.data?.data?.characters || []);
      // 同样 BUG: listStylePresets 返 { presets: rows }, 不是平铺数组
      setStyles(styleRes.data?.data?.presets || []);
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

  const styleNameOf = (sid: string) => styles.find(s => s.id === sid)?.name || sid;

  const getStatusBadge = (c: CharacterWithAssets) => {
    if (!c.description) return { label: '待生成描述', color: colors.warning, icon: 'hourglass-outline' };
    if (!c.confirmed) return { label: '待确认', color: colors.warning, icon: 'create-outline' };
    if (!c.imageVariants || c.imageVariants.length === 0) return { label: '描述已确认', color: colors.success, icon: 'image-outline' };
    return { label: `已生成 ${c.imageVariants.length} 张变体`, color: colors.success, icon: 'checkmark-circle' };
  };

  const renderItem = ({ item }: { item: CharacterWithAssets }) => {
    const badge = getStatusBadge(item);
    const cover = item.imageVariants?.[0]?.imageData;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          if (!item.description) {
            navigation.navigate('CharacterDescriptionReview', { characterId: item.id, novelId });
          } else {
            navigation.navigate('CharacterDetail', { characterId: item.id });
          }
        }}
      >
        <GlassCard padded={true} style={styles.card}>
          <View style={styles.cardInner}>
            <View style={styles.avatarBox}>
              {cover ? (
                <Image
                  source={{ uri: cover.startsWith('data:') ? cover : `data:image/svg+xml;base64,${cover}` }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="person" size={36} color={colors.text.tertiary} />
              )}
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.charName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.charMeta} numberOfLines={1}>
                {/* v3.0.6 (S58 P7 BUG-013): server 字段是 roleType, 没有 gender/role 字段 */}
                {item.roleType || '?'} · 画风: {styleNameOf(item.styleId)}
              </Text>
              <View style={[styles.badge, { backgroundColor: badge.color + '20' }]}>
                <Ionicons name={badge.icon as any} size={12} color={badge.color} />
                <Text style={[styles.badgeText, { color: badge.color }]}> {badge.label}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={characters}
        keyExtractor={c => c.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={64} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>暂无角色</Text>
            <Text style={styles.emptySub}>上传小说后，AI 会自动分析并生成角色描述</Text>
          </View>
        }
        ListHeaderComponent={
          characters.length > 0 ? (
            <Text style={styles.headerSub}>
              共 {characters.length} 个角色 · 点击查看详情
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.primary },
  list: { padding: spacing.md, paddingBottom: 40 },
  headerSub: { ...typography.caption, color: colors.text.tertiary, marginBottom: spacing.md },
  card: { marginBottom: spacing.md, ...shadows.sm },
  cardInner: { flexDirection: 'row', alignItems: 'center' },
  avatarBox: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.bg.tertiary || colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  avatar: { width: 56, height: 56 },
  cardBody: { flex: 1 },
  charName: { ...typography.h3, color: colors.text.primary, fontWeight: '700', marginBottom: 2 },
  charMeta: { ...typography.caption, color: colors.text.tertiary, marginBottom: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  badgeText: { ...typography.caption, fontWeight: '600', fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { ...typography.h2, color: colors.text.secondary, marginTop: spacing.md },
  emptySub: { ...typography.body, color: colors.text.tertiary, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.xl },
});
