// 角色详情页 v3.0.29 (S63 UI redesign)
// 跟 web CharacterDetailPage 1:1 对齐逻辑, UI 全重设计
//
// 设计动机 (user 反馈 S63):
//   旧版 (v3.0.28): 头部太挤 (person icon + name + 3 状态徽章挤一起)
//                    描述 monospace font 跟字面 UI 不协调
//                    编辑模式 textarea 灰色, 看不清输入内容
//                    底部按钮 3 个 sticky 拥挤
//   新版 (v3.0.29):
//     1. Hero header: 大头像 (128x128) + 名字 + 角色 chip + 状态 chip 横排
//     2. 字段改 section card (1A1A2E bg + 1px border) 而非 section
//     3. 描述改 sans-serif + 1.6 line-height, monospace 只在编辑态
//     4. 编辑模式 input/textarea 用 surface.input (rgba 255 5% + 10% border)
//     5. 底部按钮改 gradient primary (替代纯色填充) + ghost
//     6. 三视图预览: 1 张 sheet 大图 + 边框 + 角标
//     7. 整体: Linear dark + 软阴影

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Image, TextInput, Modal, Pressable, StatusBar,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  getCharacter, generateCharacterImages, confirmCharacter, updateCharacterFullApi,
} from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { useCachedMedia } from '../hooks/useCachedMedia';
import { colors, spacing, radii, typography } from '../theme';
import { surface, text, gradient, getStatusInfo, getRoleColor } from '../theme/character';
import type { Character } from '@ai-script/shared-types';
import { showToast, CharacterAvatar, RoleChip, StatusChip, StyleChip, LinearGradientView as LinearGradient, ErrorBoundary } from '../components';
import { ImageWithLoading } from '../components/ui';
import { extractDescriptionText } from '../utils/characterUtils'; // v3.0.41 (BUG-105 mobile sync): 走统一 utils, 4 种格式兼容 (JSON 字符串 / 自由文本 / JSON 对象 / 双层 JSON)

const ROLE_TYPES = [
  { value: 'protagonist', label: '主角 (protagonist)' },
  { value: 'antagonist', label: '反派 (antagonist)' },
  { value: 'supporting', label: '配角 (supporting)' },
  { value: 'minor', label: '次要 (minor)' },
];

// 简单 Markdown 渲染 (跟 web 端保持轻量一致, 不引入 markdown 库)
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    if (line.startsWith('# ')) {
      return <Text key={idx} style={styles.mdH1}>{line.slice(2)}</Text>;
    }
    if (line.startsWith('## ')) {
      return <Text key={idx} style={styles.mdH2}>{line.slice(3)}</Text>;
    }
    if (line.startsWith('- ')) {
      return (
        <View key={idx} style={styles.mdBulletRow}>
          <Text style={styles.mdBullet}>•</Text>
          <Text style={styles.mdBulletText}>{line.slice(2)}</Text>
        </View>
      );
    }
    if (line.trim() === '') {
      return <View key={idx} style={{ height: 6 }} />;
    }
    return <Text key={idx} style={styles.mdText}>{line}</Text>;
  });
}

export function CharacterDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const characterId: string = route.params?.characterId;
  const updateCharacter = useNovelStore(s => s.updateCharacter);
  const userInfo = useNovelStore(s => s.userInfo);

  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);

  // 编辑模式
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [aliasesDraft, setAliasesDraft] = useState('');
  const [roleTypeDraft, setRoleTypeDraft] = useState<string>('supporting');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [extraDescriptionDraft, setExtraDescriptionDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // 操作 state
  const [confirming, setConfirming] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [roleTypeModal, setRoleTypeModal] = useState(false);

  // v3.0.44 BUG-113 修法: useCachedMedia 必须在 early return (line 206) 之前调用
  // (loading=true 时 hook count = 11, loading=false 时 hook count = 12 → "Rendered more hooks than during the previous render" → React unmount)
  // 跨端铁律 4++ 修法: 跟其他 11 个 useState 一起无条件调用, hook count 稳定 = 12
  // useCachedMedia 内部已 try/catch 兜底 (BUG-112 三层防御), 即使 SQLite 抛错也不会让 screen unmount
  // 计算 sheetImgUrl (character 可能为 null, 所以用可选链 + fallback 到 undefined)
  const _sheetImgUrl = (character as any)?.imageVariants?.find?.((v: any) => v.angle === 'sheet')?.imageData
    ?? (character as any)?.imageVariants?.find?.((v: any) => v.angle === 'sheet')?.url;
  const sheetImgCached = useCachedMedia(_sheetImgUrl);

  const load = useCallback(async () => {
    if (!characterId) return;
    setLoading(true);
    try {
      // BUG-112 防御: 3 秒超时, 避免 SQLite/RNFS native module 卡住导致 ActivityIndicator 永远转 (白屏)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('加载超时 (3 秒), 请检查网络')), 3000)
      );
      const res: any = await Promise.race([
        getCharacter(characterId),
        timeoutPromise,
      ]);
      const c: any = res.data?.data || null;
      setCharacter(c);
      setNameDraft(c?.name || '');
      setAliasesDraft((c?.aliases || []).join(', '));
      setRoleTypeDraft(c?.roleType || 'supporting');
      setDescriptionDraft(extractDescriptionText(c?.description));
      setExtraDescriptionDraft(extractDescriptionText(c?.extraDescription));
    } catch (err: any) {
      showToast({ message: '加载失败: ' + (err?.response?.data?.error?.message || err?.message || '未知错误'), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!characterId) return;
    setSaving(true);
    try {
      await updateCharacterFullApi(characterId, {
        name: nameDraft.trim() || character?.name,
        aliases: aliasesDraft.split(/[,，]/).map(s => s.trim()).filter(Boolean),
        roleType: roleTypeDraft,
        description: descriptionDraft,
        extraDescription: extraDescriptionDraft,
      });
      setCharacter((prev: any) => prev ? {
        ...prev,
        name: nameDraft.trim() || prev.name,
        aliases: aliasesDraft.split(/[,，]/).map(s => s.trim()).filter(Boolean),
        roleType: roleTypeDraft,
        description: descriptionDraft,
        extraDescription: extraDescriptionDraft,
      } : prev);
      if (character) {
        updateCharacter({
          ...character,
          name: nameDraft.trim() || character.name,
          aliases: aliasesDraft.split(/[,，]/).map(s => s.trim()).filter(Boolean),
          roleType: roleTypeDraft as any,
          description: descriptionDraft as any,
          extraDescription: extraDescriptionDraft as any,
        });
      }
      showToast({ message: '✅ 已保存', variant: 'success' });
      setEditing(false);
    } catch (e: any) {
      showToast({ message: '❌ 保存失败: ' + (e?.response?.data?.error?.message || e?.message || '未知错误'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNameDraft(character?.name || '');
    setAliasesDraft((character?.aliases || []).join(', '));
    setRoleTypeDraft(character?.roleType || 'supporting');
    setDescriptionDraft(extractDescriptionText(character?.description));
    setExtraDescriptionDraft(extractDescriptionText(character?.extraDescription));
    setEditing(false);
  };

  const handleConfirm = async () => {
    if (!characterId) return;
    setConfirming(true);
    try {
      await confirmCharacter(characterId, { description: {} as any, extraDescription: {} as any });
      setCharacter((prev: any) => prev ? { ...prev, confirmed: true } : prev);
      showToast({ message: '✅ 已确认描述', variant: 'success' });
    } catch (e: any) {
      showToast({ message: '❌ 确认失败: ' + (e?.response?.data?.error?.message || e?.message || '未知错误'), variant: 'error' });
    } finally {
      setConfirming(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!characterId) return;
    setGenerating(true);
    try {
      const res = await generateCharacterImages(characterId);
      const data: any = res.data?.data;
      if (data?.variants && character) {
        const newChar = { ...character, imageVariants: data.variants, imageGenStatus: (data.totalFailed > 0 ? 'partial' : 'completed') as any };
        setCharacter(newChar);
        updateCharacter(newChar);
        showToast({ message: `✅ 已生成三视图, 扣费 ¥${(data.charged || 0).toFixed(2)}`, variant: 'success' });
        if (data.charged && userInfo) {
          useNovelStore.getState().setUserInfo({ ...userInfo, balance: (userInfo.balance || 0) - data.charged });
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message;
      showToast({ message: '❌ 生成失败: ' + msg, variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  if (loading || !character) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const descText = extractDescriptionText(character.description);
  const extraText = extractDescriptionText(character.extraDescription);
  const sheetVariant = (character.imageVariants || []).find((v: any) => v.angle === 'sheet');
  const sheetImgUrl = (sheetVariant as any)?.imageData || (sheetVariant as any)?.url;
  const hasSheet = !!sheetImgUrl;
  const status = getStatusInfo(character);
  const role = getRoleColor(character.roleType);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>

        {/* === Hero Header (跟列表卡片区分, 用渐变背景) === */}
        <LinearGradient
          colors={gradient.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <LinearGradient
            colors={role.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroGlow, { opacity: 0.3 }]}
          />

          {/* 返回按钮 (左上角) */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.heroContent}>
            {/* 大头像 (xl=128) */}
            <CharacterAvatar
              name={character.name}
              roleType={character.roleType}
              imageUrl={sheetImgUrl}
              size="xl"
              statusColor={status.color}
              pulsing={status.animated}
            />

            <View style={styles.heroTextBlock}>
              {editing ? (
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  style={styles.nameInput}
                  placeholder="角色名"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
              ) : (
                <Text style={styles.heroName} numberOfLines={1}>{character.name}</Text>
              )}
              {((character.aliases || []).length > 0 || (character as any).gender) && (
                <Text style={styles.heroMeta} numberOfLines={1}>
                  {((character.aliases || []).join(' · ') || '')}
                  {((character.aliases || []).length > 0 && (character as any).gender) ? ' · ' : ''}
                  {(character as any).gender || ''}
                </Text>
              )}
            </View>

            {/* 状态 chip 行 */}
            <View style={styles.heroChipRow}>
              <RoleChip roleType={character.roleType} size="md" />
              <StatusChip statusKey={status.key} size="md" />
              {character.styleId && <StyleChip styleId={character.styleId} />}
            </View>
          </View>
        </LinearGradient>

        {/* === 基本信息 (field grid 改 vertical list, 更易读) === */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={16} color={text.muted} />
            <Text style={styles.sectionTitle}>基本信息</Text>
          </View>

          {/* 角色类型 */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>角色类型</Text>
            {editing ? (
              <TouchableOpacity style={styles.fieldInput} onPress={() => setRoleTypeModal(true)}>
                <Text style={styles.fieldInputText}>{roleLabelOf(roleTypeDraft)}</Text>
                <Ionicons name="chevron-down" size={14} color={text.muted} />
              </TouchableOpacity>
            ) : (
              <View style={styles.fieldValueRow}>
                <RoleChip roleType={character.roleType} size="md" />
              </View>
            )}
          </View>

          {/* 别名 */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>别名</Text>
            {editing ? (
              <TextInput
                value={aliasesDraft}
                onChangeText={setAliasesDraft}
                style={styles.fieldInput}
                placeholder="别名1, 别名2"
                placeholderTextColor={text.subtle}
              />
            ) : (
              <Text style={styles.fieldValue}>
                {(character.aliases || []).join(', ') || '未设置'}
              </Text>
            )}
          </View>

          {/* 性别 */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>性别</Text>
            <Text style={styles.fieldValue}>{(character as any).gender || '未设置'}</Text>
          </View>
        </View>

        {/* === 角色描述 (主) === */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="book-outline" size={16} color={text.muted} />
            <Text style={styles.sectionTitle}>角色描述</Text>
            <Text style={styles.sectionCounter}>
              {editing ? descriptionDraft.length : descText.length} 字符
            </Text>
          </View>
          {editing ? (
            <TextInput
              value={descriptionDraft}
              onChangeText={setDescriptionDraft}
              style={styles.textareaLarge}
              multiline
              placeholder="角色的完整描述 (Markdown 格式)..."
              placeholderTextColor={text.subtle}
              textAlignVertical="top"
            />
          ) : descText ? (
            <View style={styles.markdownBox}>
              {renderMarkdown(descText)}
            </View>
          ) : (
            <Text style={styles.emptyHint}>暂无描述. 点击底部"编辑"按钮添加.</Text>
          )}
        </View>

        {/* === 补充描述 === */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles-outline" size={16} color={text.muted} />
            <Text style={styles.sectionTitle}>补充描述</Text>
            <Text style={styles.sectionCounter}>
              {editing ? extraDescriptionDraft.length : extraText.length} 字符
            </Text>
          </View>
          {editing ? (
            <TextInput
              value={extraDescriptionDraft}
              onChangeText={setExtraDescriptionDraft}
              style={styles.textareaSmall}
              multiline
              placeholder="角色与其他角色的关系 / 情绪范围 / 名言 / 标志性动作..."
              placeholderTextColor={text.subtle}
              textAlignVertical="top"
            />
          ) : extraText ? (
            <View style={styles.markdownBox}>
              {renderMarkdown(extraText)}
            </View>
          ) : (
            <Text style={styles.emptyHint}>无补充描述</Text>
          )}
        </View>

        {/* === 三视图预览 === */}
        {hasSheet && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="image-outline" size={16} color={text.muted} />
              <Text style={styles.sectionTitle}>三视图</Text>
            </View>
            <View style={styles.sheetContainer}>
              <ImageWithLoading
                src={sheetImgCached.source || sheetImgUrl}
                alt="角色三视图"
                width="100%"
                height={300}
                containerStyle={styles.sheetImage}
                style={{ width: '100%', height: '100%' }}
              />
              {/* 角标: 三视图标签 */}
              <View style={styles.sheetBadge}>
                <Ionicons name="cube" size={12} color="#fff" />
                <Text style={styles.sheetBadgeText}>CHARACTER SHEET</Text>
              </View>
            </View>
          </View>
        )}

        {/* === 角色类型下拉 Modal === */}
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

      {/* === 底部操作栏 (sticky, gradient bg) === */}
      <LinearGradient
        colors={['rgba(10, 10, 20, 0.95)', colors.bg.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.actionBar}
      >
        {editing ? (
          <>
            <TouchableOpacity
              onPress={handleCancel}
              disabled={saving}
              style={[styles.actionBtn, styles.actionBtnGhost]}
            >
              <Ionicons name="close" size={16} color={text.body} />
              <Text style={styles.actionBtnGhostText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
              style={[styles.actionBtn, saving && { opacity: 0.6 }]}
            >
              <LinearGradient
                colors={gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionBtnGradient}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name="save" size={16} color="#fff" />
                    <Text style={styles.actionBtnPrimaryText}>保存修改</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => setEditing(true)}
              style={[styles.actionBtn, styles.actionBtnGhost]}
            >
              <Ionicons name="create-outline" size={16} color={text.body} />
              <Text style={styles.actionBtnGhostText}>编辑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={confirming || character.confirmed}
              activeOpacity={0.8}
              style={[styles.actionBtn, (confirming || character.confirmed) && { opacity: 0.5 }]}
            >
              <View style={[styles.actionBtnGradient, { backgroundColor: character.confirmed ? '#10B981' : 'transparent' }]}>
                {character.confirmed ? (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.actionBtnPrimaryText}>已确认</Text>
                  </>
                ) : confirming ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.actionBtnPrimaryText}>确认描述</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleGenerateImages}
              disabled={generating || !character.confirmed || character.imageGenStatus === 'generating'}
              activeOpacity={0.8}
              style={[styles.actionBtn, (generating || !character.confirmed) && { opacity: 0.5 }]}
            >
              <LinearGradient
                colors={gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionBtnGradient}
              >
                {generating ? <ActivityIndicator color="#fff" size="small" /> :
                 character.imageGenStatus === 'completed' ?
                   <><Ionicons name="refresh" size={16} color="#fff" /><Text style={styles.actionBtnPrimaryText}>重新生图</Text></> :
                   <><Ionicons name="sparkles" size={16} color="#fff" /><Text style={styles.actionBtnPrimaryText}>生成三视图</Text></>
                }
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}
      </LinearGradient>
    </View>
  );
}

function roleLabelOf(v: string) {
  return ROLE_TYPES.find(r => r.value === v)?.label || v || '配角';
}

/**
 * v3.0.44 BUG-112 防御: ErrorBoundary wrap 版, 任何 throw 不再让 component tree unmount → 白屏
 * 用法: App.tsx <Stack.Screen component={CharacterDetailScreenWithBoundary} ... />
 */
export function CharacterDetailScreenWithBoundary(props: any) {
  return (
    <ErrorBoundary
      onReset={() => {
        try {
          props?.navigation?.goBack?.();
        } catch {
          // ignore
        }
      }}
    >
      <CharacterDetailScreen />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary },

  // Hero
  hero: {
    position: 'relative',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
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
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  backBtn: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  heroContent: {
    padding: spacing.lg,
    paddingTop: 56,
    alignItems: 'center',
    gap: 12,
  },
  heroTextBlock: {
    alignItems: 'center',
    gap: 4,
  },
  heroName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  nameInput: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 200,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroMeta: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '500',
  },
  heroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },

  // Section
  section: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: surface.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: surface.cardBorder,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: text.primary,
  },
  sectionCounter: {
    fontSize: 11,
    color: text.muted,
  },

  // Field
  fieldRow: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: text.muted,
    fontWeight: '500',
    marginBottom: 6,
  },
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
  fieldInputText: {
    fontSize: 14,
    color: text.primary,
  },
  fieldValueRow: {
    flexDirection: 'row',
  },
  fieldValue: {
    fontSize: 14,
    color: text.body,
  },

  // Textarea
  textareaLarge: {
    backgroundColor: surface.input,
    borderRadius: radii.md,
    padding: 12,
    minHeight: 220,
    fontSize: 13,
    color: text.body,
    lineHeight: 20,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: surface.inputBorder,
    fontFamily: 'monospace',
  },
  textareaSmall: {
    backgroundColor: surface.input,
    borderRadius: radii.md,
    padding: 12,
    minHeight: 120,
    fontSize: 13,
    color: text.body,
    lineHeight: 20,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: surface.inputBorder,
    fontFamily: 'monospace',
  },
  emptyHint: {
    fontSize: 13,
    color: text.muted,
    fontStyle: 'italic',
  },

  // Markdown 渲染
  markdownBox: {
    gap: 4,
  },
  mdH1: {
    fontSize: 16,
    fontWeight: '700',
    color: text.primary,
    marginTop: 4,
    marginBottom: 4,
  },
  mdH2: {
    fontSize: 14,
    fontWeight: '600',
    color: text.primary,
    marginTop: 2,
  },
  mdText: {
    fontSize: 14,
    color: text.body,
    lineHeight: 22,
  },
  mdBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 8,
  },
  mdBullet: {
    fontSize: 14,
    color: text.muted,
    marginRight: 6,
    lineHeight: 22,
  },
  mdBulletText: {
    flex: 1,
    fontSize: 14,
    color: text.body,
    lineHeight: 22,
  },

  // 三视图
  sheetContainer: {
    backgroundColor: surface.input,
    borderRadius: radii.md,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: surface.cardBorder,
    position: 'relative',
  },
  sheetImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.sm,
  },
  sheetBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sheetBadgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 1,
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

  // Bottom action bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: surface.cardBorder,
  },
  actionBtn: {
    flex: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  actionBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: surface.cardBorder,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionBtnGhostText: {
    fontSize: 14,
    color: text.body,
    fontWeight: '600',
  },
  actionBtnGradient: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnPrimaryText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
