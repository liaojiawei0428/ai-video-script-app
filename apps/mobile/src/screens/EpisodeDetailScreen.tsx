import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Linking,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getEpisode, updateEpisode, getShots, generateShots as apiGenerateShots, getTaskProgress, regenerateEpisode as apiRegenerateEpisode, exportEpisode as apiExportEpisode } from '../api/client';
import { updateEpisodeSqlite, saveShots } from '../db/sqlite';
import { WS_BASE_URL } from '../config';
import { useNovelStore } from '../store/useNovelStore';
import { GlassCard, GradientButton } from '../components';
import { colors, spacing, radii, typography } from '../theme';
import type { EpisodeDetailRouteProp, NavigationProp } from '../types/navigation';

function EpisodeScriptView({ content }: { content: string }) {
  if (!content) return null;
  const blocks = content.split('\n');
  return (
    <View>
      {blocks.map((line, i) => {
        const isSceneHeader = /【.+】/.test(line);
        const isCharDialogue = /^[^：:]+[：:]/.test(line);
        const isAction = !isSceneHeader && !isCharDialogue && line.trim().length > 0;
        const isEmpty = line.trim().length === 0;

        if (isEmpty) return <View key={i} style={{ height: 8 }} />;
        if (isSceneHeader) {
          const sceneMatch = line.match(/【(.+)】/);
          return (
            <View key={i} style={styles.sceneBlock}>
              <View style={styles.sceneAccent} />
              <Text style={styles.sceneText}>{sceneMatch ? `【${sceneMatch[1]}】` : line}</Text>
            </View>
          );
        }
        if (isCharDialogue) {
          const sep = line.includes('：') ? '：' : ':';
          const idx = line.indexOf(sep);
          const charName = line.slice(0, idx);
          const dialogue = line.slice(idx + 1);
          return (
            <View key={i} style={styles.dialogueBlock}>
              <Text style={styles.charName}>{charName}</Text>
              <Text style={styles.dialogueText}>{dialogue}</Text>
            </View>
          );
        }
        return <Text key={i} style={styles.actionText}>{line}</Text>;
      })}
    </View>
  );
}

export function EpisodeDetailScreen(): React.JSX.Element {
  const route = useRoute<EpisodeDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  // v3.0.86 (BUG-162 跨项目通用铁律): React Navigation v6 route.params 默认 undefined
  //   修前直接解构, 调用方不传 params → undefined.novelId 崩
  //   修法: (route.params ?? {}) 兜底空对象 (跟 BUG-161 AIAssistantScreen 同源修法)
  const { novelId, episodeId, episodeTitle } = (route.params ?? {}) as EpisodeDetailRouteProp['params'];
  const [loading, setLoading] = useState(true);
  const [scriptContent, setScriptContent] = useState('');
  const [shotContent, setShotContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null); // v2.0.0
  const [episodeStatus, setEpisodeStatus] = useState<string>('');
  const [streamText, setStreamText] = useState('');
  const [editing, setEditing] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamScrollRef = useRef<ScrollView>(null);
  const [streamLen, setStreamLen] = useState(0);

  useEffect(() => {
    navigation.setOptions({ title: episodeTitle || '剧集内容' });
    loadEpisode();
    loadShots();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, []);

  useEffect(() => {
    streamScrollRef.current?.scrollToEnd({ animated: true });
  }, [streamLen]);

  const loadEpisode = async () => {
    try {
      const res = await getEpisode(episodeId);
      const ep = res.data.data?.episode;
      setScriptContent(ep?.scriptContent || '');
      setEpisodeStatus(ep?.status || '');
    } catch {}
    setLoading(false);
  };

  const loadShots = async () => {
    try {
      const res = await getShots(episodeId);
      const shots = res.data.data?.shots || [];
      if (shots.length > 0) {
        const isPlainText = !shots[0].cameraAngle;
        if (isPlainText) {
          const text = shots.map((s: any) => s.description || '').join('\n\n---\n\n');
          setShotContent(text);
        } else {
          const text = shots.map((s: any, i: number) =>
            `【镜头${i + 1} | ${s.durationSec || 0}秒】
景别：${s.cameraAngle || '中景'} | 运镜：${s.cameraMove || '固定'} | 灯光：${s.lighting || '自然光'}
画面：${s.description || ''}${s.dialogue ? `\n对白：「${s.dialogue}」` : ''}${s.audioNote ? `\n音效：${s.audioNote}` : ''}`
          ).join('\n\n---\n\n');
          setShotContent(text);
        }
      }
    } catch {}
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setScriptContent('');
    setStreamText('正在重新生成剧本...\n');
    try {
      let streamDone = false;
      const wsUrl = WS_BASE_URL?.replace('http', 'ws') + '/ws';
      if (wsUrl) {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', novelId }));
        let buffer = '';
        let timer: ReturnType<typeof setTimeout> | null = null;
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'llm_update' && data.phase?.startsWith('regenerate_ep')) {
              if (data.stream) {
                buffer += data.content;
                if (!timer) {
                  timer = setTimeout(() => {
                    setStreamText(prev => prev + buffer);
                    buffer = '';
                    timer = null;
                  }, 100);
                }
              } else if (data.content?.includes('完成') || data.content?.includes('失败')) {
                if (timer) { clearTimeout(timer); if (buffer) setStreamText(prev => prev + buffer); }
                setStreamText(prev => prev + '\n' + data.content);
                streamDone = true;
              }
            }
          } catch {}
        };
        ws.onerror = () => { setStreamText(prev => prev + '\n[连接异常，任务仍在后台进行]'); };
        ws.onclose = () => { wsRef.current = null; };
      }
      await apiRegenerateEpisode(episodeId);
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (streamDone) { clearInterval(check); resolve(); }
        }, 200);
        setTimeout(() => { clearInterval(check); resolve(); }, 60000);
      });
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      await loadEpisode();
      setStreamText(prev => prev + '\n重新生成完成');
    } catch (err: any) {
      setStreamText(prev => prev + `\n重新生成失败：${err?.message || '网络错误'}`);
    } finally {
      setRegenerating(false);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateEpisode(episodeId, { scriptContent });
      await updateEpisodeSqlite({ id: episodeId, scriptContent });
      Alert.alert('已保存');
    } catch {
      Alert.alert('保存失败');
    }
    setSaving(false);
  };

  const handleGenerateShots = async () => {
    if (!scriptContent.trim()) {
      Alert.alert('提示', '请先编写剧本内容');
      return;
    }
    setGenerating(true);
    setShotContent('');
    setStreamText('AI 正在分析剧本，生成镜头描述...\n');

    let wsConnected = false;
    try {
      const wsUrl = WS_BASE_URL?.replace('http', 'ws') + '/ws';
      if (!wsUrl) throw new Error('WebSocket URL 配置错误');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => { ws.send(JSON.stringify({ type: 'subscribe', novelId })); wsConnected = true; };
      let shotBuffer = '';
      let shotTimer: ReturnType<typeof setTimeout> | null = null;
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'llm_update' && data.phase === 'shot_gen') {
            if (data.stream) {
              shotBuffer += data.content;
              if (!shotTimer) {
                shotTimer = setTimeout(() => {
                  setStreamText(prev => prev + shotBuffer);
                  setStreamLen(n => n + shotBuffer.length);
                  shotBuffer = '';
                  shotTimer = null;
                }, 100);
              }
            } else if (data.step === 'reasoning') {
              const t = data.content + '\n';
              setStreamText(t);
              setStreamLen(n => n + t.length);
            }
          }
        } catch {}
      };
      ws.onclose = () => {
        if (shotTimer) { clearTimeout(shotTimer); if (shotBuffer) setStreamText(prev => prev + shotBuffer); }
        wsRef.current = null;
      };
      ws.onerror = () => { setStreamText(prev => prev + '\n[连接异常，任务仍在后台进行]'); };
    } catch (wsErr: any) {
      setStreamText(prev => prev + `\n[连接失败：${wsErr.message}]`);
    }

    try {
      const taskRes = await apiGenerateShots(episodeId);
      const taskId = taskRes.data.data?.taskId;
      if (!taskId) throw new Error('启动分镜头任务失败');

      await new Promise<void>((resolve, reject) => {
        pollingRef.current = setInterval(async () => {
          try {
            const pollRes = await getTaskProgress(taskId);
            const t = pollRes.data.data;
            if (t.status === 'completed') { clearInterval(pollingRef.current!); pollingRef.current = null; resolve(); }
            else if (t.status === 'failed') { clearInterval(pollingRef.current!); pollingRef.current = null; reject(new Error(t.errorMsg || 'AI 生成失败')); }
          } catch { clearInterval(pollingRef.current!); pollingRef.current = null; resolve(); }
        }, 2000);
      });

      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      await loadShots();
      setShotContent(prev => prev || streamText || '(AI 返回内容解析失败)');
    } catch (err: any) {
      setShotContent(`生成失败：${err?.message || '请检查网络'}`);
    } finally {
      setGenerating(false);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    }
  };

  // v2.0.0 导出
  const handleExport = async (format: 'pdf' | 'docx') => {
    if (!episodeId) return;
    setExporting(format);
    try {
      const res = await apiExportEpisode(episodeId, format);
      const data = res.data?.data;
      if (!data?.url) throw new Error('未获取到文件 URL');
      const sizeKB = (data.sizeBytes / 1024).toFixed(1);
      Alert.alert(
        '导出成功',
        `文件: ${data.filename}\n大小: ${sizeKB} KB\n有效期: 24 小时\n\n点击"打开"在浏览器中下载`,
        [
          { text: '复制链接', onPress: () => {
            // RN 没有原生 Clipboard 简单实现, 改用 Alert 显示完整链接
            Alert.alert('下载链接', data.url);
          }},
          { text: '打开', onPress: () => Linking.openURL(data.url) },
          { text: '关闭', style: 'cancel' },
        ],
      );
    } catch (e: any) {
      Alert.alert('导出失败', e?.response?.data?.error?.message || e?.message || '请稍后重试');
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <GlassCard padded={true} style={{ marginBottom: spacing.md }}>
          <View style={styles.boxHeader}>
            <View style={styles.boxTitleRow}>
              <Text style={styles.boxTitle}>剧本内容</Text>
              {episodeStatus === 'failed' && (
                <View style={styles.failedBadge}>
                  <Text style={styles.failedBadgeText}>生成失败</Text>
                </View>
              )}
              {episodeStatus === 'completed' && (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              )}
            </View>
            <View style={styles.boxActions}>
              {episodeStatus === 'failed' && (
                <TouchableOpacity style={styles.retryBtn} onPress={handleRegenerate} disabled={regenerating}>
                  {regenerating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.retryBtnText}>重新生成</Text>}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {regenerating && streamText ? (
            <View style={styles.regeneratingBox}>
              <Text style={styles.regeneratingText}>{streamText}</Text>
            </View>
          ) : editing ? (
            <TextInput
              style={styles.editorInput}
              value={scriptContent}
              onChangeText={setScriptContent}
              multiline
              textAlignVertical="top"
              placeholder="输入剧本内容..."
              placeholderTextColor={colors.text.tertiary}
            />
          ) : scriptContent ? (
            <EpisodeScriptView content={scriptContent} />
          ) : (
            <Text style={styles.placeholderText}>暂无剧集内容</Text>
          )}

          <View style={styles.editSaveRow}>
            <TouchableOpacity
              style={[styles.editBtn, editing && styles.editBtnActive]}
              onPress={() => setEditing(!editing)}
            >
              <Text style={[styles.editBtnText, editing && styles.editBtnTextActive]}>
                {editing ? '预览' : '编辑'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Text style={styles.saveBtnText}>保存修改</Text>
              )}
            </TouchableOpacity>
          </View>
        </GlassCard>

        <GradientButton
          title={generating ? '生成中...' : 'AI 生成分镜头'}
          onPress={handleGenerateShots}
          loading={generating}
          disabled={generating}
          style={{ marginBottom: spacing.md }}
        />

        {/* v2.0.0 导出按钮组 */}
        <View style={styles.exportRow}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => handleExport('pdf')}
            disabled={exporting !== null || !scriptContent}
            activeOpacity={0.7}
          >
            {exporting === 'pdf' ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <>
                <Ionicons name="document-text" size={18} color={colors.accent} />
                <Text style={styles.exportBtnText}> 导出 PDF</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => handleExport('docx')}
            disabled={exporting !== null || !scriptContent}
            activeOpacity={0.7}
          >
            {exporting === 'docx' ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <>
                <Ionicons name="document" size={18} color={colors.accent} />
                <Text style={styles.exportBtnText}> 导出 Word</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {shotContent || generating ? (
          <GlassCard padded={true} style={{ marginBottom: spacing.md }}>
            <Text style={styles.boxTitle}>镜头语言</Text>
            {generating ? (
              <ScrollView ref={streamScrollRef} style={styles.shotStreamScroll}>
                <Text style={styles.shotStreamText}>{streamText}</Text>
              </ScrollView>
            ) : (
              <Text style={styles.shotText} selectable>{shotContent}</Text>
            )}
          </GlassCard>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  boxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  boxTitleRow: { flexDirection: 'row', alignItems: 'center' },
  boxTitle: { ...typography.h3, color: colors.text.primary },
  boxActions: { flexDirection: 'row', gap: spacing.sm },
  failedBadge: { backgroundColor: colors.error + '33', borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, marginLeft: spacing.sm },
  failedBadgeText: { ...typography.tag, color: colors.error },
  statusOkIcon: { fontSize: 14, marginLeft: spacing.xs },
  retryBtn: { backgroundColor: colors.warning, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  retryBtnText: { ...typography.tag, color: colors.bg.primary },
  saveBtn: {
    flex: 1, borderRadius: radii.md, borderWidth: 1, borderColor: colors.accent,
    backgroundColor: colors.accent, paddingVertical: spacing.sm + 2, alignItems: 'center',
  },
  saveBtnText: { ...typography.h3, color: colors.text.inverse },
  editSaveRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  editBtn: {
    flex: 1, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.sm + 2, alignItems: 'center',
  },
  editBtnActive: { borderColor: colors.accent, backgroundColor: colors.accent + '20' },
  editBtnText: { ...typography.h3, color: colors.text.secondary },
  editBtnTextActive: { color: colors.accent },
  editorInput: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text.primary,
    ...typography.body,
    lineHeight: 22,
    minHeight: 300,
    maxHeight: 600,
  },
  regeneratingBox: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
    maxHeight: 200,
  },
  regeneratingText: { ...typography.body, color: colors.text.secondary, fontFamily: 'monospace' },
  placeholderText: { ...typography.body, color: colors.text.tertiary, textAlign: 'center', paddingVertical: spacing.xl },

  sceneBlock: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, marginTop: spacing.sm },
  sceneAccent: { width: 3, height: 18, backgroundColor: colors.accent, borderRadius: 2, marginRight: spacing.sm },
  sceneText: { ...typography.h3, color: colors.accent },

  dialogueBlock: { marginBottom: spacing.sm, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border },
  charName: { ...typography.h3, color: colors.success, marginBottom: 2 },
  dialogueText: { ...typography.body, color: colors.text.primary },

  actionText: { ...typography.body, color: colors.text.secondary, lineHeight: 22, marginBottom: 4 },

  shotText: { ...typography.body, color: colors.text.secondary, lineHeight: 22 },
  shotStreamScroll: { maxHeight: 300, minHeight: 100, padding: spacing.sm + 2, backgroundColor: colors.bg.tertiary, borderRadius: radii.md },
  shotStreamText: { ...typography.body, color: colors.text.secondary, fontFamily: 'monospace' },
  // v2.0.0
  exportRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.sm, borderRadius: radii.md,
    backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.accent,
  },
  exportBtnText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
});
