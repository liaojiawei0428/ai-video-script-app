// 角色详情页 v2.0.0
// 展示 3 张变体图 (正面半身 / 侧面半身 / 全身)
// 支持单独重新生成某张图 (按张扣费)

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Image, Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getCharacter, generateCharacterImages } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { colors, spacing, radii, typography } from '../theme';
import type { Character, ImageVariant } from '@ai-script/shared-types';
import { showToast } from '../components';

const ANGLE_LABELS: Record<ImageVariant['angle'], string> = {
  front_bust: '正面半身',
  side_bust: '侧面半身',
  full_body: '全身',
};
const ANGLE_ICONS: Record<ImageVariant['angle'], string> = {
  front_bust: 'person',
  side_bust: 'person-outline',
  full_body: 'body',
};

const ANGLE_PRICE = 0.3; // ¥0.3/张

export function CharacterDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const characterId: string = route.params?.characterId;
  const updateCharacter = useNovelStore(s => s.updateCharacter);
  const userInfo = useNovelStore(s => s.userInfo);

  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<ImageVariant['angle'] | 'all' | null>(null);

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      const res = await getCharacter(characterId);
      setCharacter(res.data?.data || null);
    } catch (err: any) {
      showToast('加载失败: ' + (err?.response?.data?.error?.message || err?.message), 'error');
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const onGenerate = async (angles?: Array<ImageVariant['angle']>) => {
    if (!userInfo) {
      showToast('请先登录', 'error');
      return;
    }
    const targetAngles = angles || (['front_bust', 'side_bust', 'full_body'] as const);
    const cost = targetAngles.length * ANGLE_PRICE;

    if ((userInfo.balance || 0) < cost) {
      Alert.alert('余额不足', `需要 ¥${cost.toFixed(2)}, 当前余额 ¥${(userInfo.balance || 0).toFixed(2)}`);
      return;
    }

    Alert.alert(
      '生成变体图',
      `将为 ${character?.name} 生成 ${targetAngles.length} 张变体图, 共扣费 ¥${cost.toFixed(2)}`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: async () => {
            setGenerating(angles ? targetAngles[0] : 'all');
            try {
              const res = await generateCharacterImages(characterId, angles);
              const data = res.data?.data;
              if (data?.variants) {
                if (character) {
                  const newChar = { ...character, imageVariants: data.variants, imageGenStatus: data.totalFailed > 0 ? 'partial' : 'completed' };
                  setCharacter(newChar);
                  updateCharacter(newChar);
                }
                showToast(`生成完成, 扣费 ¥${(data.charged || 0).toFixed(2)}`, 'success');
                // 刷新余额
                if (data.charged && userInfo) {
                  useNovelStore.getState().setUserInfo({ ...userInfo, balance: (userInfo.balance || 0) - data.charged });
                }
              }
            } catch (err: any) {
              const msg = err?.response?.data?.error?.message || err?.message;
              if (msg?.includes('余额不足')) {
                Alert.alert('余额不足', msg);
              } else {
                showToast('生成失败: ' + msg, 'error');
              }
            } finally {
              setGenerating(null);
            }
          },
        },
      ],
    );
  };

  if (loading || !character) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const variants = character.imageVariants || [];
  const hasAll = variants.length === 3;
  const missingAngles: Array<ImageVariant['angle']> = (['front_bust', 'side_bust', 'full_body'] as const).filter(a => !variants.find(v => v.angle === a));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>{character.name}</Text>
          {character.confirmed ? (
            <View style={styles.confirmedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={styles.confirmedText}>已确认</Text>
            </View>
          ) : (
            <View style={styles.pendingBadge}>
              <Ionicons name="time-outline" size={14} color="#F59E0B" />
              <Text style={styles.pendingText}>待确认</Text>
            </View>
          )}
        </View>
        {character.styleId && (
          <View style={styles.styleBadge}>
            <Ionicons name="color-palette-outline" size={14} color={colors.primary} />
            <Text style={styles.styleBadgeText}>
              {character.styleId === 'realistic' ? '写实电影风' :
               character.styleId === 'ancient' ? '古风水墨' :
               character.styleId === 'cyber' ? '赛博朋克' :
               character.styleId === 'anime' ? '动漫风' :
               character.styleId === '3d' ? '3D 渲染' : character.styleId}
            </Text>
          </View>
        )}
        {character.imageGenStatus && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>生图状态:</Text>
            <Text style={styles.statusValue}>
              {character.imageGenStatus === 'none' ? '未生成' :
               character.imageGenStatus === 'generating' ? '生成中...' :
               character.imageGenStatus === 'partial' ? `部分完成 (${variants.length}/3)` :
               character.imageGenStatus === 'completed' ? '✅ 已完成' :
               character.imageGenStatus === 'failed' ? '❌ 失败' : character.imageGenStatus}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>变体图 ({variants.length}/3)</Text>
        <Text style={styles.sectionSubtitle}>每张图扣费 ¥{ANGLE_PRICE.toFixed(2)}</Text>

        {variants.length === 0 ? (
          <View style={styles.emptyVariants}>
            <Ionicons name="image-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>尚无变体图</Text>
            {!character.confirmed ? (
              <Text style={styles.emptyHint}>请先确认角色描述</Text>
            ) : (
              <TouchableOpacity onPress={() => onGenerate()} disabled={generating !== null} style={[styles.btnPrimary, generating !== null && { opacity: 0.6 }]}>
                {generating === 'all' ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#fff" />
                    <Text style={styles.btnPrimaryText}>生成 3 张变体图 (¥{(3 * ANGLE_PRICE).toFixed(2)})</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View>
            {(['front_bust', 'side_bust', 'full_body'] as const).map(angle => {
              const variant = variants.find(v => v.angle === angle);
              return (
                <View key={angle} style={styles.variantCard}>
                  <View style={styles.variantHeader}>
                    <View style={styles.variantTitleRow}>
                      <Ionicons name={ANGLE_ICONS[angle]} size={18} color={colors.primary} />
                      <Text style={styles.variantTitle}>{ANGLE_LABELS[angle]}</Text>
                    </View>
                    {variant && (
                      <TouchableOpacity onPress={() => onGenerate([angle])} disabled={generating !== null} style={styles.regenerateBtn}>
                        {generating === angle ? <ActivityIndicator color={colors.primary} size="small" /> : (
                          <>
                            <Ionicons name="refresh" size={14} color={colors.primary} />
                            <Text style={styles.regenerateBtnText}>重新生成 ¥{ANGLE_PRICE.toFixed(2)}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  {variant ? (
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: variant.url }}
                        style={styles.image}
                        resizeMode="contain"
                        onError={() => showToast('图片加载失败', 'error')}
                      />
                    </View>
                  ) : (
                    <View style={styles.missingImage}>
                      <Ionicons name="add-circle-outline" size={32} color={colors.text.tertiary} />
                      <Text style={styles.missingText}>未生成</Text>
                      {character.confirmed && (
                        <TouchableOpacity onPress={() => onGenerate([angle])} disabled={generating !== null} style={[styles.btnPrimary, { marginTop: 8, paddingVertical: 8 }, generating !== null && { opacity: 0.6 }]}>
                          {generating === angle ? <ActivityIndicator color="#fff" size="small" /> : (
                            <Text style={styles.btnPrimaryText}>生成此角度 (¥{ANGLE_PRICE.toFixed(2)})</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {character.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>角色描述</Text>
          {/* v3.0.6 (S58 P7 BUG-013): server 返 description 是字符串 (自由文本), 不是 10 字段对象
              之前 S58 P1 臆造 10 字段结构, 实际 server v2.5.34 后是纯文本 */}
          <Text style={styles.descValue}>{character.description}</Text>
        </View>
      )}

      {character.extraDescription && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>补充描述</Text>
          {/* 同 BUG-013: extraDescription 也是字符串 */}
          <Text style={styles.descValue}>{character.extraDescription}</Text>
        </View>
      )}

      {!hasAll && character.confirmed && missingAngles.length > 0 && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            onPress={() => onGenerate(missingAngles)}
            disabled={generating !== null}
            style={[styles.btnPrimary, { flex: 1 }, generating !== null && { opacity: 0.6 }]}
          >
            {generating === missingAngles[0] ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.btnPrimaryText}>
                生成剩余 {missingAngles.length} 张 (¥{(missingAngles.length * ANGLE_PRICE).toFixed(2)})
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary },
  header: { padding: spacing.lg, backgroundColor: colors.bg.secondary },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...typography.h1, color: colors.text.primary, flex: 1 },
  confirmedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.sm },
  confirmedText: { ...typography.caption, color: '#10B981', fontWeight: '600' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.sm },
  pendingText: { ...typography.caption, color: '#F59E0B', fontWeight: '600' },
  styleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start', backgroundColor: colors.bg.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.sm },
  styleBadgeText: { ...typography.caption, color: colors.primary },
  statusRow: { flexDirection: 'row', marginTop: 8, alignItems: 'center' },
  statusLabel: { ...typography.caption, color: colors.text.secondary, marginRight: 6 },
  statusValue: { ...typography.caption, color: colors.text.primary, fontWeight: '600' },
  section: { padding: spacing.md, backgroundColor: colors.bg.secondary, margin: spacing.md, borderRadius: radii.md },
  sectionTitle: { ...typography.h3, color: colors.text.primary, marginBottom: 4 },
  sectionSubtitle: { ...typography.caption, color: colors.text.tertiary, marginBottom: 12 },
  emptyVariants: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyText: { ...typography.body, color: colors.text.tertiary },
  emptyHint: { ...typography.caption, color: colors.text.tertiary },
  variantCard: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  variantHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  variantTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  variantTitle: { ...typography.body, color: colors.text.primary, fontWeight: '600' },
  regenerateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  regenerateBtnText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  imageContainer: { backgroundColor: colors.bg.primary, borderRadius: radii.md, padding: 8, alignItems: 'center' },
  image: { width: 256, height: 256, backgroundColor: colors.bg.tertiary },
  missingImage: { alignItems: 'center', paddingVertical: 24, backgroundColor: colors.bg.primary, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  missingText: { ...typography.caption, color: colors.text.tertiary, marginTop: 4 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radii.md, gap: 6 },
  btnPrimaryText: { ...typography.body, color: '#fff', fontWeight: '600' },
  descRow: { flexDirection: 'row', paddingVertical: 4 },
  descLabel: { ...typography.caption, color: colors.text.tertiary, width: 60 },
  descValue: { ...typography.body, color: colors.text.primary, flex: 1 },
  actionBar: { flexDirection: 'row', padding: spacing.md, gap: 8 },
});
