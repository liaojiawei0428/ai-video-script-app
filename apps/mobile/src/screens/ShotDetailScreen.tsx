import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Share,
  TextInput, Modal, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getShots, generateShots as apiGenerateShots, updateShot as apiUpdateShot, getTaskProgress } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { saveShots } from '../db/sqlite';
import { Shot } from '@ai-script/shared-types';
import type { ShotDetailRouteProp, NavigationProp } from '../types/navigation';

export function ShotDetailScreen(): React.JSX.Element {
  const route = useRoute<ShotDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { episodeId, episodeTitle, novelId } = route.params;
  const { currentShots, setCurrentShots, updateShot: updateShotStore } = useNovelStore();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingShot, setEditingShot] = useState<Shot | null>(null);
  const [editModal, setEditModal] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: episodeTitle || '镜头详情' });
    loadShots();
  }, []);

  const loadShots = async () => {
    try {
      const response = await getShots(episodeId);
      const shots = response.data.data.shots;
      if (shots && shots.length > 0) {
        setCurrentShots(shots);
        await saveShots(shots);
      }
    } catch { /* no shots yet */ }
    setLoading(false);
  };

  const handleGenerateShots = async () => {
    setGenerating(true);
    try {
      const response = await apiGenerateShots(episodeId);
      const { taskId } = response.data.data;
      const interval = setInterval(async () => {
        try {
          const res = await getTaskProgress(taskId);
          if (res.data.data.status === 'completed') {
            clearInterval(interval);
            await loadShots();
            setGenerating(false);
          } else if (res.data.data.status === 'failed') {
            clearInterval(interval);
            setGenerating(false);
            Alert.alert('生成失败', '请重试');
          }
        } catch { clearInterval(interval); setGenerating(false); }
      }, 2000);
    } catch {
      setGenerating(false);
      Alert.alert('启动失败', '请检查网络');
    }
  };

  const handleEdit = (shot: Shot) => {
    setEditingShot({ ...shot });
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingShot) return;
    try {
      await apiUpdateShot(editingShot.id, { ...editingShot, episodeId });
      updateShotStore(editingShot as Shot);
      setEditModal(false);
      setEditingShot(null);
    } catch {
      Alert.alert('保存失败');
    }
  };

  const handleCopyShot = (shot: Shot) => {
    const text = `镜头${shot.shotNumber}（${shot.durationSec}秒）
${shot.cameraAngle} · ${shot.cameraMove} · ${shot.lighting}
${shot.description}${shot.dialogue ? `\n对白：${shot.dialogue}` : ''}${shot.audioNote ? `\n音效：${shot.audioNote}` : ''}`;
    Share.share({ message: text });
  };

  const handleCopyAll = () => {
    const text = currentShots.map(s => {
      return `【镜头${s.shotNumber} | ${s.durationSec}秒】
景别：${s.cameraAngle} | 运镜：${s.cameraMove} | 灯光：${s.lighting}
画面：${s.description}${s.dialogue ? `\n对白：「${s.dialogue}」` : ''}${s.audioNote ? `\n音效：${s.audioNote}` : ''}`;
    }).join('\n\n---\n\n');
    Share.share({ message: text, title: episodeTitle });
  };

  const handleExportTxt = async () => {
    const header = `=== ${episodeTitle} ===\n总时长：${currentShots.reduce((s, x) => s + (x.durationSec || 0), 0)}秒\n镜头数：${currentShots.length}\n\n`;
    const body = currentShots.map((s, i) => {
      return `镜头${i + 1}（${s.durationSec || 0}秒）
景别：${s.cameraAngle || '中景'} | 运镜：${s.cameraMove || '固定'} | 灯光：${s.lighting || '自然光'}
【画面描述】${s.description || ''}${s.dialogue ? `\n【对白】${s.dialogue}` : ''}${s.audioNote ? `\n【音效提示】${s.audioNote}` : ''}${s.action ? `\n【动作】${s.action}` : ''}`;
    }).join('\n\n');
    await Share.share({ message: header + body, title: `${episodeTitle}.txt` });
  };

  const totalDuration = currentShots.reduce((sum, s) => sum + (s.durationSec || 0), 0);

  const renderShot = ({ item, index }: { item: Shot; index: number }) => (
    <View style={styles.shotCard}>
      <View style={styles.shotHeader}>
        <View style={styles.shotBadge}>
          <Text style={styles.shotBadgeText}>镜头{index + 1}</Text>
        </View>
        <Text style={styles.shotDuration}>{item.durationSec || 0}秒</Text>
      </View>

      <View style={styles.shotTags}>
        <View style={styles.tag}><Text style={styles.tagText}>{item.cameraAngle || '中景'}</Text></View>
        <View style={styles.tag}><Text style={styles.tagText}>{item.cameraMove || '固定'}</Text></View>
        <View style={styles.tag}><Text style={styles.tagText}>{item.lighting || '自然光'}</Text></View>
        {item.sceneType && <View style={styles.tag}><Text style={styles.tagText}>{item.sceneType}</Text></View>}
      </View>

      <Text style={styles.shotDesc}>{item.description || '暂无画面描述'}</Text>

      {item.dialogue ? (
        <View style={styles.shotDialogue}>
          <Text style={styles.shotDialogueLabel}>🎙️ 对白</Text>
          <Text style={styles.shotDialogueText}>{item.dialogue}</Text>
        </View>
      ) : null}

      {item.audioNote ? (
        <View style={styles.shotAudio}>
          <Text style={styles.shotAudioLabel}>🔊 音效</Text>
          <Text style={styles.shotAudioText}>{item.audioNote}</Text>
        </View>
      ) : null}

      <View style={styles.shotActions}>
        <TouchableOpacity style={styles.shotActionBtn} onPress={() => handleEdit(item)}>
          <Text style={styles.shotActionText}>✏️ 编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shotActionBtn} onPress={() => handleCopyShot(item)}>
          <Text style={styles.shotActionText}>📋 复制</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color="#007AFF" />
      ) : currentShots.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎥</Text>
          <Text style={styles.emptyText}>暂无镜头数据</Text>
          <TouchableOpacity style={styles.genButton} onPress={handleGenerateShots} disabled={generating}>
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.genButtonText}>生成镜头分析</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ListHeaderComponent={
            <View style={styles.summaryBar}>
              <Text style={styles.summaryTitle}>{episodeTitle}</Text>
              <Text style={styles.summaryMeta}>
                🎬 {currentShots.length}个镜头 · ⏱️ {Math.floor(totalDuration / 60)}分{Math.round(totalDuration % 60)}秒
              </Text>
              <View style={styles.summaryActions}>
                <TouchableOpacity style={styles.summaryBtn} onPress={handleCopyAll}>
                  <Text style={styles.summaryBtnText}>📋 复制全部</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.summaryBtn} onPress={handleExportTxt}>
                  <Text style={styles.summaryBtnText}>📤 导出TXT</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          data={currentShots}
          keyExtractor={(item) => item.id}
          renderItem={renderShot}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Edit Modal */}
      <Modal visible={editModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>编辑镜头</Text>
              {editingShot && (
                <>
                  <Text style={styles.label}>时长（秒）</Text>
                  <TextInput
                    style={styles.input}
                    value={String(editingShot.durationSec || '')}
                    onChangeText={t => setEditingShot({ ...editingShot, durationSec: parseFloat(t) || 0 })}
                    keyboardType="numeric"
                  />
                  <Text style={styles.label}>景别</Text>
                  <TextInput style={styles.input} value={editingShot.cameraAngle || ''}
                    onChangeText={t => setEditingShot({ ...editingShot, cameraAngle: t })} />
                  <Text style={styles.label}>运镜</Text>
                  <TextInput style={styles.input} value={editingShot.cameraMove || ''}
                    onChangeText={t => setEditingShot({ ...editingShot, cameraMove: t })} />
                  <Text style={styles.label}>灯光</Text>
                  <TextInput style={styles.input} value={editingShot.lighting || ''}
                    onChangeText={t => setEditingShot({ ...editingShot, lighting: t })} />
                  <Text style={styles.label}>画面描述</Text>
                  <TextInput style={[styles.input, styles.textArea]} value={editingShot.description || ''}
                    onChangeText={t => setEditingShot({ ...editingShot, description: t })} multiline />
                  <Text style={styles.label}>对白</Text>
                  <TextInput style={[styles.input, styles.textArea]} value={editingShot.dialogue || ''}
                    onChangeText={t => setEditingShot({ ...editingShot, dialogue: t })} multiline />
                  <Text style={styles.label}>音效提示</Text>
                  <TextInput style={styles.input} value={editingShot.audioNote || ''}
                    onChangeText={t => setEditingShot({ ...editingShot, audioNote: t })} />
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalCancel} onPress={() => setEditModal(false)}>
                      <Text style={styles.modalCancelText}>取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalSave} onPress={handleSaveEdit}>
                      <Text style={styles.modalSaveText}>保存</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  list: { paddingBottom: 40 },
  summaryBar: { backgroundColor: '#fff', padding: 16, marginBottom: 8 },
  summaryTitle: { fontSize: 20, fontWeight: '800', color: '#1C1C1E', marginBottom: 4 },
  summaryMeta: { fontSize: 14, color: '#8E8E93', marginBottom: 12 },
  summaryActions: { flexDirection: 'row', gap: 12 },
  summaryBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F2F2F7', alignItems: 'center',
  },
  summaryBtnText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },
  shotCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  shotHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  shotBadge: { backgroundColor: '#007AFF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8 },
  shotBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  shotDuration: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  shotTags: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10, gap: 6 },
  tag: { backgroundColor: '#F2F2F7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, color: '#555' },
  shotDesc: { fontSize: 14, lineHeight: 22, color: '#1C1C1E', marginBottom: 8 },
  shotDialogue: { backgroundColor: '#FFF9E6', borderRadius: 8, padding: 10, marginBottom: 8 },
  shotDialogueLabel: { fontSize: 11, fontWeight: '600', color: '#B8860B', marginBottom: 4 },
  shotDialogueText: { fontSize: 13, color: '#333', lineHeight: 20 },
  shotAudio: { backgroundColor: '#E8F4FD', borderRadius: 8, padding: 10, marginBottom: 8 },
  shotAudioLabel: { fontSize: 11, fontWeight: '600', color: '#007AFF', marginBottom: 4 },
  shotAudioText: { fontSize: 13, color: '#333' },
  shotActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  shotActionBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  shotActionText: { fontSize: 13, color: '#007AFF', fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#8E8E93', marginBottom: 24 },
  genButton: { backgroundColor: '#007AFF', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  genButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#1C1C1E' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#FAFAFA' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#F2F2F7' },
  modalCancelText: { fontSize: 16, fontWeight: '600', color: '#555' },
  modalSave: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#007AFF' },
  modalSaveText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
