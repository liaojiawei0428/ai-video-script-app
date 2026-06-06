/**
 * v2.0.0 - 资产库
 * 显示已确认 + 已生图的角色 (3 张变体图网格)
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing, radii, typography, shadows } from '../theme';
import { GlassCard } from '../components';
import { listAssets } from '../api/client';
import type { CharacterWithAssets } from '@ai-script/shared-types';

type RouteParams = { novelId: string };

export function AssetLibraryScreen(): React.JSX.Element {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { novelId } = route.params as RouteParams;

  const [assets, setAssets] = useState<CharacterWithAssets[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listAssets(novelId);
      setAssets(res.data?.data?.assets || []);
    } catch (e) {
      console.warn('Load assets failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [novelId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const renderAsset = ({ item }: { item: CharacterWithAssets }) => {
    const variants = item.imageVariants || [];
    return (
      <TouchableOpacity
        style={styles.assetCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('CharacterDetail', { characterId: item.id })}
      >
        <View style={styles.variantsRow}>
          {variants.slice(0, 3).map((v, i) => (
            <View key={i} style={styles.variantBox}>
              {v.imageData ? (
                <Image
                  source={{ uri: v.imageData.startsWith('data:') ? v.imageData : `data:image/svg+xml;base64,${v.imageData}` }}
                  style={styles.variantImg}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons name="image-outline" size={24} color={colors.text.tertiary} />
              )}
            </View>
          ))}
        </View>
        <View style={styles.assetInfo}>
          <Text style={styles.assetName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.assetMeta}>{item.gender || '?'} · {variants.length} 张变体</Text>
        </View>
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
        data={assets}
        keyExtractor={a => a.id}
        renderItem={renderAsset}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={64} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>资产库为空</Text>
            <Text style={styles.emptySub}>完成角色描述确认 + 变体图生成后, 资产会在这里展示</Text>
          </View>
        }
        ListHeaderComponent={
          assets.length > 0 ? (
            <Text style={styles.headerSub}>
              共 {assets.length} 个资产 · 每个角色 3 张变体
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
  headerSub: { ...typography.caption, color: colors.text.tertiary, marginBottom: spacing.md, width: '100%' },
  row: { gap: spacing.md, marginBottom: spacing.md },
  assetCard: {
    flex: 1, backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg, padding: spacing.sm, ...shadows.sm,
  },
  variantsRow: { flexDirection: 'row', gap: 4, marginBottom: spacing.sm },
  variantBox: {
    flex: 1, aspectRatio: 1, backgroundColor: colors.bg.tertiary || colors.bg.primary,
    borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  variantImg: { width: '100%', height: '100%' },
  assetInfo: { paddingHorizontal: 4 },
  assetName: { ...typography.h3, color: colors.text.primary, fontWeight: '700', marginBottom: 2 },
  assetMeta: { ...typography.caption, color: colors.text.tertiary, fontSize: 11 },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { ...typography.h2, color: colors.text.secondary, marginTop: spacing.md },
  emptySub: { ...typography.body, color: colors.text.tertiary, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.xl },
});
