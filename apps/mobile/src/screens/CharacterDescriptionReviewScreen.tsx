// 角色描述确认页 v3.0.29 (S63 UI redesign)
// 跟 web CharacterListPage 1:1 对齐逻辑, UI 全重设计
//
// 设计动机 (user 反馈 S63):
//   旧版 (v3.0.28): 顶部只是简单文字 + 按钮, 视觉权重弱
//                    卡片用 emoji + 旧版 colors (tertiary 太黑)
//                    编辑表单字段平铺, 缺 section 视觉分组
//   新版 (v3.0.29):
//     1. 顶部 progress (大渐变 banner + 进度条 + 已确认 N/M)
//     2. "提取/重新生成" 按钮放 hero 内 (右上), 改 gradient primary
//     3. 角色卡片用 CharacterAvatar (大头像) + RoleChip + StatusChip
//     4. 编辑模式: 跟 detail 一致 (surface.input + 圆角输入框 + 字符计数)
//     5. 整体: 商业化 dark theme

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, RefreshControl, Modal, Pressable, ScrollView, StatusBar,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getCharacters, extractCharacterDescriptions, confirmCharacter } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { colors, spacing, radii, typography } from '../theme';
import { surface, text, gradient, getStatusInfo, getRoleColor } from '../theme/character';
import type { Character } from '@ai-script/shared-types';
import { showToast, CharacterAvatar, RoleChip, StatusChip, StyleChip, EmptyState, LinearGradientView as LinearGradient } from '../components';
import { extractDescriptionText } from '../utils/characterUtils'; // v3.0.41 (BUG-105 mobile sync): 走统一 utils, 4 种格式兼容

const ROLE_TYPES = [
  { value: 'protagonist', label: '主角 (protagonist)' },
  { value: 'antagonist', label: '反派 (antagonist)' },
  { value: 'supporting', label: '配角 (supporting)' },
  { value: 'minor', label: '次要 (minor)' },
];

// 简单 Markdown 渲染
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    if (line.startsWith('# ')) {
      return <Text key={idx} style={styles.mdH1}>{line.slice(2)}</Text>;
    }
    if (line.startsWith('- ')) {
      return (
        <View key={idx} style={styles.mdBulletRow}>
          <Text style={styles.mdBullet}>•</Text>
          <Text style={styles.mdBulletText}>{line.slice(2)}</Text>
        </View>
      );
    }
    if (line.trim() === '') return <View key={idx} style={{ height: 6 }} />;
    return <Text key={idx} style={styles.mdText}>{line}</Text>;
  });
}

export function CharacterDescriptionReviewScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const novelId: string = route.params?.novelId;
  const updateCharacter = useNovelStore(s => s.updateCharacter);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);

  // 编辑模式
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [aliasesDraft, setAliasesDraft] = useState('');
  const [roleTypeDraft, setRoleTypeDraft] = useState<string>('supporting');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [extraDescriptionDraft, setExtraDescriptionDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [roleTypeModal, setRoleTypeModal] = useState(false);

  const load = useCallback(async () => {
    if (!novelId) return;
    setLoading(true);
    try {
      const res = await getCharacters(novelId);
      setCharacters(res.data?.data?.characters || []);
    } catch (err: any) {
      showToast({ message: '加载失败: ' + (err?.response?.data?.error?.message || err?.message || '未知'), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => { load(); }, [load]);

  const onExtract = async () => {
    setExtracting(true);
    try {
      await extractCharacterDescriptions(novelId);
      showToast({ message: '已启动描述生成, 完成后将自动刷新', variant: 'success' });
      for (let i = 0; i < 6; i++) {
        await new Promise<void>(r => setTimeout(() => r(), 5000));
        const res = await getCharacters(novelId);
        const list = res.data?.data?.characters || [];
        if (list.some((c: Character) => extractDescriptionText(c.description))) {
          setCharacters(list);
          break;
        }
      }
      await load();
    } catch (err: any) {
      showToast({ message: '启动失败: ' + (err?.response?.data?.error?.message || err?.message), variant: 'error' });
    } finally {
      setExtracting(false);
    }
  };

  const startEdit = (c: Character) => {
    if (!extractDescriptionText(c.description)) {
      showToast({ message: '该角色尚无描述, 请先点击"提取/重新生成描述"', variant: 'error' });
      return;
    }
    setEditingId(c.id);
    setNameDraft(c.name);
    setAliasesDraft((c.aliases || []).join(', '));
    setRoleTypeDraft(c.roleType || 'supporting');
    setDescriptionDraft(extractDescriptionText(c.description));
    setExtraDescriptionDraft(extractDescriptionText(c.extraDescription));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await confirmCharacter(editingId, {
        description: descriptionDraft as any,
        extraDescription: extraDescriptionDraft as any,
      });
      const newChar = characters.find(c => c.id === editingId);
      if (newChar) {
        const updated = { ...newChar, description: descriptionDraft as any, extraDescription: extraDescriptionDraft as any, confirmed: true };
        updateCharacter(updated);
        setCharacters(prev => prev.map(c => c.id === editingId ? updated : c));
      }
      showToast({ message: '✅ 已确认', variant: 'success' });
      setEditingId(null);
    } catch (err: any) {
      showToast({ message: '保存失败: ' + (err?.response?.data?.error?.message || err?.message), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => setEditingId(null);

  const confirmedCount = characters.filter(c => c.confirmed).length;
  const progress = characters.length > 0 ? confirmedCount / characters.length : 0;
  const allConfirmed = characters.length > 0 && confirmedCount === characters.length;

  // Hero header (跟 list 一致风格)
  const renderHero = () => (
    <LinearGradient
      colors={gradient.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <LinearGradient
        colors={gradient.heroAccent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGlow}
      />

      <View style={styles.heroTop}>
        <View style={styles.heroLeft}>
          <Ionicons name="document-text" size={22} color="#fff" />
          <Text style={styles.heroTitle}>角色描述确认</Text>
        </View>
        <TouchableOpacity
          onPress={onExtract}
          disabled={extracting}
          activeOpacity={0.8}
          style={[styles.heroBtn, extracting && { opacity: 0.6 }]}
        >
          {extracting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="sparkles" size={14} color="#fff" />
              <Text style={styles.heroBtnText}>提取/重新生成</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* 进度 */}
      <View style={styles.progressBlock}>
        <View style={styles.progressTextRow}>
          <Text style={styles.progressText}>
            {confirmedCount}/{characters.length} 已确认
          </Text>
          <Text style={styles.progressPercent}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={allConfirmed ? gradient.success : gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${progress * 100}%` }]}
          />
        </View>
      </View>
    </LinearGradient>
  );

  const renderCharacter = ({ item }: { item: Character }) => {
    const isEditing = editingId === item.id;
    const desc = isEditing ? descriptionDraft : extractDescriptionText(item.description);
    const extra = isEditing ? extraDescriptionDraft : extractDescriptionText(item.extraDescription);
    const sheetVariant = (item.imageVariants || []).find((v: any) => v.angle === 'sheet');
    const cover = (sheetVariant as any)?.imageData || (sheetVariant as any)?.url;
    const status = getStatusInfo(item);

    return (
      <View style={styles.card}>
        {/* === 卡片 header: 头像 + 名字 + chip + 编辑按钮 === */}
        <View style={styles.cardHeader}>
          <CharacterAvatar
            name={item.name}
            roleType={item.roleType}
            imageUrl={cover}
            size="md"
            statusColor={status.color}
            pulsing={status.animated}
          />
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.cardChipRow}>
              <RoleChip roleType={item.roleType} />
              <StatusChip statusKey={status.key} />
            </View>
          </View>
          {desc && !isEditing && !item.confirmed && (
            <TouchableOpacity onPress={() => startEdit(item)} style={styles.editBtn}>
              <Ionicons name="create-outline" size={14} color={text.muted} />
              <Text style={styles.editBtnText}>编辑</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* === 内容 === */}
        {!desc && !isEditing ? (
          <Text style={styles.empty}>尚无描述, 请先点击右上"提取/重新生成描述"</Text>
        ) : isEditing ? (
          <ScrollView style={styles.editForm} keyboardShouldPersistTaps="handled">
            {/* 角色类型 */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>角色类型</Text>
              <TouchableOpacity style={styles.fieldInput} onPress={() => setRoleTypeModal(true)}>
                <Text style={styles.fieldInputText}>
                  {ROLE_TYPES.find(r => r.value === roleTypeDraft)?.label || roleTypeDraft}
                </Text>
                <Ionicons name="chevron-down" size={14} color={text.muted} />
              </TouchableOpacity>
            </View>
            {/* 别名 */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>别名</Text>
              <TextInput
                value={aliasesDraft}
                onChangeText={setAliasesDraft}
                style={styles.fieldInput}
                placeholder="别名1, 别名2"
                placeholderTextColor={text.subtle}
              />
            </View>
            {/* 角色名 */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>角色名</Text>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                style={styles.fieldInput}
                placeholderTextColor={text.subtle}
              />
            </View>
            {/* 主描述 textarea */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>角色描述</Text>
                <Text style={styles.fieldCounter}>{descriptionDraft.length} 字符</Text>
              </View>
              <TextInput
                value={descriptionDraft}
                onChangeText={setDescriptionDraft}
                style={styles.textareaLarge}
                multiline
                placeholder="角色的完整描述 (Markdown 格式)..."
                placeholderTextColor={text.subtle}
                textAlignVertical="top"
              />
            </View>
            {/* 补充描述 textarea */}
            <View style={styles.fieldRow}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>补充描述</Text>
                <Text style={styles.fieldCounter}>{extraDescriptionDraft.length} 字符</Text>
              </View>
              <TextInput
                value={extraDescriptionDraft}
                onChangeText={setExtraDescriptionDraft}
                style={styles.textareaSmall}
                multiline
                placeholder="角色与其他角色的关系 / 情绪范围 / 名言..."
                placeholderTextColor={text.subtle}
                textAlignVertical="top"
              />
            </View>
            {/* 操作按钮 */}
            <View style={styles.editActions}>
              <TouchableOpacity onPress={cancelEdit} style={[styles.btn, styles.btnGhost]}>
                <Ionicons name="close" size={14} color={text.body} />
                <Text style={styles.btnGhostText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit} disabled={saving} activeOpacity={0.8} style={[styles.btn, saving && { opacity: 0.6 }]}>
                <LinearGradient
                  colors={gradient.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.btnGradient}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> :
                    <><Ionicons name="checkmark-circle" size={14} color="#fff" /><Text style={styles.btnPrimaryText}>确认并保存</Text></>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Modal */}
            <Modal visible={roleTypeModal} transparent animationType="fade" onRequestClose={() => setRoleTypeModal(false)}>
              <Pressable style={styles.modalMask} onPress={() => setRoleTypeModal(false)}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>选择角色类型</Text>
                  {ROLE_TYPES.map(r => {
                    const r2 = getRoleColor(r.value);
                    return (
                      <TouchableOpacity
                        key={r.value}
                        style={[styles.modalOption, roleTypeDraft === r.value && styles.modalOptionActive]}
                        onPress={() => { setRoleTypeDraft(r.value); setRoleTypeModal(false); }}
                      >
                        <View style={[styles.modalOptionIcon, { backgroundColor: r2.primaryAlpha }]}>
                          <Ionicons name={r2.icon as any} size={16} color={r2.primary} />
                        </View>
                        <Text style={[styles.modalOptionText, roleTypeDraft === r.value && styles.modalOptionTextActive]}>
                          {r.label}
                        </Text>
                        {roleTypeDraft === r.value && <Ionicons name="checkmark-circle" size={18} color={r2.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Pressable>
            </Modal>
          </ScrollView>
        ) : (
          <View style={styles.viewMode}>
            {/* 主描述 */}
            {desc && (
              <View style={styles.descBlock}>
                <View style={styles.mdLabel}>
                  <Ionicons name="book-outline" size={12} color={text.muted} />
                  <Text style={styles.mdLabelText}>角色描述</Text>
                </View>
                <View style={styles.mdBox}>{renderMarkdown(desc)}</View>
              </View>
            )}
            {/* 补充描述 */}
            {extra ? (
              <View style={styles.descBlock}>
                <View style={styles.mdLabel}>
                  <Ionicons name="sparkles-outline" size={12} color={text.muted} />
                  <Text style={styles.mdLabelText}>补充描述</Text>
                </View>
                <View style={styles.mdBox}>{renderMarkdown(extra)}</View>
              </View>
            ) : null}
            {/* 操作按钮 */}
            {!item.confirmed && (
              <TouchableOpacity
                onPress={() => startEdit(item)}
                activeOpacity={0.8}
                style={[styles.editCta, { marginTop: 12 }]}
              >
                <LinearGradient
                  colors={gradient.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.editCtaGradient}
                >
                  <Ionicons name="create-outline" size={14} color="#fff" />
                  <Text style={styles.editCtaText}>编辑并确认</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            {sheetVariant && (
              <TouchableOpacity
                onPress={() => navigation.navigate('CharacterDetail', { characterId: item.id })}
                style={styles.viewImagesBtn}
              >
                <Ionicons name="images-outline" size={14} color={text.body} />
                <Text style={styles.viewImagesBtnText}>查看三视图</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />
      <FlatList
        data={characters}
        keyExtractor={c => c.id}
        renderItem={renderCharacter}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            {renderHero()}
            {allConfirmed && (
              <View style={styles.allConfirmedBanner}>
                <Ionicons name="checkmark-done-circle" size={18} color="#10B981" />
                <Text style={styles.allConfirmedText}>所有角色已确认, 可进入下一步</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={!loading ? (
          <EmptyState
            icon="people-outline"
            title="暂无角色"
            subtitle="请先上传小说并等待分析完成。也可以手动触发角色提取。"
            ctaLabel="提取/重新生成描述"
            ctaIcon="sparkles"
            onCta={onExtract}
            loading={extracting}
          />
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },

  // Hero
  hero: {
    position: 'relative',
    marginBottom: spacing.lg,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: surface.cardBorder,
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.35,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingBottom: 0,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  heroBtn: {
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
  progressBlock: {
    padding: spacing.md,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Banner
  allConfirmedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  allConfirmedText: { fontSize: 13, color: '#10B981', fontWeight: '600' },

  // Card
  card: {
    backgroundColor: surface.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: surface.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: 12,
  },
  cardHeaderText: {
    flex: 1,
    gap: 6,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: text.primary,
  },
  cardChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: surface.section,
    borderWidth: 1,
    borderColor: surface.cardBorder,
  },
  editBtnText: {
    fontSize: 12,
    color: text.muted,
    fontWeight: '600',
  },

  // View mode
  viewMode: {},
  descBlock: {
    marginTop: 8,
  },
  mdLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  mdLabelText: {
    fontSize: 11,
    color: text.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mdBox: {
    backgroundColor: surface.section,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: surface.sectionBorder,
  },
  mdH1: {
    fontSize: 15,
    fontWeight: '700',
    color: text.primary,
    marginTop: 2,
    marginBottom: 2,
  },
  mdText: {
    fontSize: 13,
    color: text.body,
    lineHeight: 20,
  },
  mdBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 6,
  },
  mdBullet: {
    fontSize: 13,
    color: text.muted,
    marginRight: 6,
    lineHeight: 20,
  },
  mdBulletText: {
    flex: 1,
    fontSize: 13,
    color: text.body,
    lineHeight: 20,
  },
  empty: { fontSize: 13, color: text.muted, fontStyle: 'italic' },

  // Edit form
  editForm: { maxHeight: 720 },
  fieldRow: { marginBottom: 12 },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  fieldLabel: { fontSize: 12, color: text.muted, marginBottom: 4, fontWeight: '500' },
  fieldCounter: { fontSize: 11, color: text.subtle },
  fieldInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: surface.input,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: surface.inputBorder,
  },
  fieldInputText: { fontSize: 14, color: text.primary, flex: 1 },
  textareaLarge: {
    backgroundColor: surface.input,
    borderRadius: radii.md,
    padding: 12,
    minHeight: 200,
    fontFamily: 'monospace',
    fontSize: 13,
    color: text.body,
    lineHeight: 20,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: surface.inputBorder,
  },
  textareaSmall: {
    backgroundColor: surface.input,
    borderRadius: radii.md,
    padding: 12,
    minHeight: 110,
    fontFamily: 'monospace',
    fontSize: 13,
    color: text.body,
    lineHeight: 20,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: surface.inputBorder,
  },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { flex: 1, borderRadius: radii.md, overflow: 'hidden' },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: surface.cardBorder,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  btnGhostText: { fontSize: 13, color: text.body, fontWeight: '600' },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  btnPrimaryText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // Edit CTA (view mode)
  editCta: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  editCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  editCtaText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  viewImagesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: surface.section,
    borderWidth: 1,
    borderColor: surface.cardBorder,
  },
  viewImagesBtnText: {
    fontSize: 12,
    color: text.body,
    fontWeight: '600',
  },

  // Modal
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: surface.card, borderRadius: radii.lg, padding: spacing.md, gap: 4, borderWidth: 1, borderColor: surface.cardBorder },
  modalTitle: { fontSize: 16, fontWeight: '700', color: text.primary, marginBottom: 12 },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: radii.md },
  modalOptionActive: { backgroundColor: 'rgba(99, 102, 241, 0.15)' },
  modalOptionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalOptionText: { flex: 1, fontSize: 14, color: text.body },
  modalOptionTextActive: { color: text.primary, fontWeight: '600' },
});
