// 角色描述确认页 v2.0.0
// 列表展示每个角色的 15 维度, 用户可编辑后确认
// 全部确认后才能进入下一步（分集大纲）

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, ScrollView, RefreshControl, Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getCharacters, extractCharacterDescriptions, confirmCharacter } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { colors, spacing, radii, typography } from '../theme';
import type { Character, CharacterDescription, CharacterExtraDescription } from '@ai-script/shared-types';
import { showToast } from '../components';

const DIMENSIONS: Array<{ key: keyof CharacterDescription; label: string }> = [
  { key: 'name', label: '姓名' },
  { key: 'age', label: '年龄' },
  { key: 'height', label: '身高' },
  { key: 'build', label: '体型' },
  { key: 'face', label: '脸型' },
  { key: 'features', label: '五官' },
  { key: 'hair', label: '发型' },
  { key: 'signature', label: '标志' },
  { key: 'clothes', label: '服装' },
  { key: 'personality', label: '性格' },
  { key: 'aliases', label: '别名' },
];

const EXTRA_DIMENSIONS: Array<{ key: keyof CharacterExtraDescription; label: string }> = [
  { key: 'relationshipsText', label: '关系网络' },
  { key: 'emotionRange', label: '情绪范围' },
  { key: 'actionHabits', label: '动作习惯' },
  { key: 'signatureLines', label: '标志性台词' },
];

export function CharacterDescriptionReviewScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const novelId: string = route.params?.novelId;
  const updateCharacter = useNovelStore(s => s.updateCharacter);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edited, setEdited] = useState<{ desc: CharacterDescription; extra: CharacterExtraDescription } | null>(null);

  const load = useCallback(async () => {
    if (!novelId) return;
    setLoading(true);
    try {
      const res = await getCharacters(novelId);
      setCharacters(res.data?.data?.characters || []);
    } catch (err: any) {
      showToast('加载失败: ' + (err?.response?.data?.error?.message || err?.message || '未知'), 'error');
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => { load(); }, [load]);

  const onExtract = async () => {
    setExtracting(true);
    try {
      await extractCharacterDescriptions(novelId);
      showToast('已启动描述生成, 完成后将自动刷新', 'success');
      // 轮询 3 次, 每次 5s
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const res = await getCharacters(novelId);
        const list = res.data?.data?.characters || [];
        if (list.some((c: Character) => c.description)) {
          setCharacters(list);
          break;
        }
      }
      await load();
    } catch (err: any) {
      showToast('启动失败: ' + (err?.response?.data?.error?.message || err?.message), 'error');
    } finally {
      setExtracting(false);
    }
  };

  const startEdit = (c: Character) => {
    if (!c.description) {
      showToast('该角色尚无描述, 请先点击"提取描述"', 'error');
      return;
    }
    setEditingId(c.id);
    setEdited({
      desc: { ...c.description! },
      extra: { ...(c.extraDescription || { relationshipsText: '', emotionRange: '', actionHabits: '', signatureLines: '' }) },
    });
  };

  const saveEdit = async () => {
    if (!editingId || !edited) return;
    setConfirming(editingId);
    try {
      const res = await confirmCharacter(editingId, edited);
      const updated = res.data?.data;
      if (updated) {
        const newChar = characters.find(c => c.id === editingId);
        if (newChar) {
          updateCharacter({ ...newChar, description: edited.desc, extraDescription: edited.extra, confirmed: true, confirmedAt: updated.confirmedAt });
        }
        setCharacters(prev => prev.map(c => c.id === editingId ? { ...c, description: edited.desc, extraDescription: edited.extra, confirmed: true, confirmedAt: updated.confirmedAt } : c));
      }
      showToast('已确认', 'success');
      setEditingId(null);
      setEdited(null);
    } catch (err: any) {
      showToast('保存失败: ' + (err?.response?.data?.error?.message || err?.message), 'error');
    } finally {
      setConfirming(null);
    }
  };

  const renderCharacter = ({ item }: { item: Character }) => {
    const isEditing = editingId === item.id;
    const desc = isEditing ? edited!.desc : item.description;
    const extra = isEditing ? edited!.extra : item.extraDescription;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName}>{item.name}</Text>
            {item.confirmed ? (
              <View style={styles.confirmedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={styles.confirmedText}>已确认</Text>
              </View>
            ) : desc ? (
              <View style={styles.pendingBadge}>
                <Ionicons name="time-outline" size={14} color="#F59E0B" />
                <Text style={styles.pendingText}>待确认</Text>
              </View>
            ) : null}
          </View>
          {desc && !isEditing && (
            <TouchableOpacity onPress={() => startEdit(item)} style={styles.editBtn}>
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={styles.editBtnText}>编辑</Text>
            </TouchableOpacity>
          )}
        </View>

        {!desc && !isEditing ? (
          <Text style={styles.empty}>尚无描述, 请先提取</Text>
        ) : isEditing && edited ? (
          <ScrollView style={styles.editForm} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>11 维度基础描述</Text>
            {DIMENSIONS.map(d => (
              <View key={d.key} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{d.label}</Text>
                {d.key === 'aliases' ? (
                  <TextInput
                    style={styles.input}
                    value={(edited.desc.aliases || []).join(', ')}
                    onChangeText={t => setEdited({ ...edited, desc: { ...edited.desc, aliases: t.split(/[,，]/).map(s => s.trim()).filter(Boolean) } })}
                    placeholder="多个用逗号分隔"
                    placeholderTextColor={colors.text.tertiary}
                  />
                ) : (
                  <TextInput
                    style={styles.input}
                    value={String((edited.desc as any)[d.key] || '')}
                    onChangeText={t => setEdited({ ...edited, desc: { ...edited.desc, [d.key]: t } })}
                    placeholderTextColor={colors.text.tertiary}
                  />
                )}
              </View>
            ))}
            <Text style={styles.sectionTitle}>4 维度补充描述</Text>
            {EXTRA_DIMENSIONS.map(d => (
              <View key={d.key} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{d.label}</Text>
                <TextInput
                  style={[styles.input, { minHeight: 50 }]}
                  value={String((edited.extra as any)[d.key] || '')}
                  onChangeText={t => setEdited({ ...edited, extra: { ...edited.extra, [d.key]: t } })}
                  multiline
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            ))}
            <View style={styles.editActions}>
              <TouchableOpacity onPress={() => { setEditingId(null); setEdited(null); }} style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnGhostText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit} disabled={confirming === item.id} style={[styles.btn, styles.btnPrimary, confirming === item.id && { opacity: 0.6 }]}>
                {confirming === item.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>确认并保存</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <View>
            {desc && (
              <View style={styles.descBlock}>
                {DIMENSIONS.map(d => (
                  <View key={d.key} style={styles.descRow}>
                    <Text style={styles.descLabel}>{d.label}</Text>
                    <Text style={styles.descValue}>
                      {d.key === 'aliases' ? (desc.aliases || []).join('、') || '—' : (desc as any)[d.key] || '—'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {extra && (
              <View style={styles.descBlock}>
                <Text style={styles.sectionTitle}>补充描述</Text>
                {EXTRA_DIMENSIONS.map(d => (
                  <View key={d.key} style={styles.descRow}>
                    <Text style={styles.descLabel}>{d.label}</Text>
                    <Text style={styles.descValue}>{(extra as any)[d.key] || '—'}</Text>
                  </View>
                ))}
              </View>
            )}
            {item.imageVariants && item.imageVariants.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('CharacterDetail', { characterId: item.id })} style={styles.viewImagesBtn}>
                <Ionicons name="images-outline" size={16} color={colors.primary} />
                <Text style={styles.viewImagesBtnText}>查看变体图 ({item.imageVariants.length}/3)</Text>
              </TouchableOpacity>
            )}
            {!item.confirmed && desc && (
              <TouchableOpacity onPress={() => startEdit(item)} style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}>
                <Text style={styles.btnPrimaryText}>编辑并确认</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const confirmedCount = characters.filter(c => c.confirmed).length;
  const allConfirmed = characters.length > 0 && confirmedCount === characters.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>角色描述确认</Text>
        <Text style={styles.headerSubtitle}>
          {characters.length > 0 ? `${confirmedCount}/${characters.length} 已确认` : '尚无角色'}
        </Text>
      </View>

      <TouchableOpacity
        onPress={onExtract}
        disabled={extracting}
        style={[styles.extractBtn, extracting && { opacity: 0.6 }]}
      >
        {extracting ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={styles.extractBtnText}>提取/重新生成描述</Text>
          </>
        )}
      </TouchableOpacity>

      {allConfirmed && (
        <View style={styles.allConfirmedBanner}>
          <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
          <Text style={styles.allConfirmedText}>所有角色已确认, 可进入下一步</Text>
        </View>
      )}

      <FlatList
        data={characters}
        keyExtractor={c => c.id}
        renderItem={renderCharacter}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>暂无角色, 请先上传小说并等待分析完成</Text>
          </View>
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.md, backgroundColor: colors.bg.secondary },
  headerTitle: { ...typography.h2, color: colors.text.primary },
  headerSubtitle: { ...typography.caption, color: colors.text.secondary, marginTop: 4 },
  extractBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, margin: spacing.md, paddingVertical: 12,
    borderRadius: radii.md, gap: 6,
  },
  extractBtnText: { ...typography.body, color: '#fff', fontWeight: '600' },
  card: { backgroundColor: colors.bg.secondary, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { ...typography.h3, color: colors.text.primary },
  confirmedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.sm },
  confirmedText: { ...typography.caption, color: '#10B981', fontWeight: '600' },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.sm },
  pendingText: { ...typography.caption, color: '#F59E0B', fontWeight: '600' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { ...typography.caption, color: colors.primary },
  empty: { ...typography.caption, color: colors.text.tertiary, fontStyle: 'italic' },
  descBlock: { marginTop: 4 },
  descRow: { flexDirection: 'row', paddingVertical: 4 },
  descLabel: { ...typography.caption, color: colors.text.tertiary, width: 80 },
  descValue: { ...typography.body, color: colors.text.primary, flex: 1 },
  sectionTitle: { ...typography.body, color: colors.text.primary, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  editForm: { maxHeight: 500 },
  fieldRow: { marginBottom: 8 },
  fieldLabel: { ...typography.caption, color: colors.text.secondary, marginBottom: 2 },
  input: {
    backgroundColor: colors.bg.primary, color: colors.text.primary,
    borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 14, borderWidth: 1, borderColor: colors.border,
  },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { ...typography.body, color: '#fff', fontWeight: '600' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btnGhostText: { ...typography.body, color: colors.text.secondary },
  viewImagesBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  viewImagesBtnText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { ...typography.body, color: colors.text.tertiary, textAlign: 'center', paddingHorizontal: 32 },
  allConfirmedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: spacing.md, marginBottom: 8,
    backgroundColor: 'rgba(16,185,129,0.1)', padding: 10, borderRadius: radii.md,
  },
  allConfirmedText: { ...typography.body, color: '#10B981' },
});
