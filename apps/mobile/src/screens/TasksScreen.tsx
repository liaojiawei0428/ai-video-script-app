// apps/mobile/src/screens/TasksScreen.tsx
// v3.0.0 (S58): 任务进度列表 - 跟 web TasksPage.tsx 1:1 镜像
// 后端: GET /api/novels (返回所有 novel 含 status/progress) + WebSocket 推流
// 流程: 3s 轮询 novels 拿活跃任务 -> 显示进度条 + 阶段 -> 点击跳 ChatScreen

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { getNovels } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { colors, spacing, radii, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';

// TabParamList 中的 Chat 也支持 novelId 路由参数
type AnyNav = NativeStackNavigationProp<RootStackParamList> & {
  navigate: (routeName: string, params?: any) => void;
};

interface ActiveTask {
  id: string;
  title: string;
  status: string;
  progress: number;
  phaseDetail: string;
  totalEpisodes: number;
  currentEpisode: number;
  updatedAt: number;
}

const ACTIVE_STATUSES = ['pending', 'analyzing', 'generating', 'analyzed', 'queued'];

const CHUNK_PHASES = [
  { key: 'chunking', label: '准备' },
  { key: 'analyzing_chunks', label: '分析' },
  { key: 'merging', label: '合并' },
  { key: 'final_analysis', label: '报告' },
];

function getPhaseDetail(task: ActiveTask): string {
  if (task.status === 'analyzing') return 'AI 分析中…';
  if (task.status === 'generating') return task.totalEpisodes > 0
    ? `生成剧集 ${task.currentEpisode}/${task.totalEpisodes}`
    : 'AI 生成中…';
  if (task.status === 'analyzed') return '分析完成';
  if (task.status === 'pending') return '等待中…';
  if (task.status === 'queued') return '排队中…';
  return task.status;
}

export function TasksScreen(): React.JSX.Element {
  const navigation = useNavigation<AnyNav>();
  const isLoggedIn = useNovelStore(s => s.isLoggedIn);

  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const r = await getNovels();
      const all = r.data?.data?.novels || [];
      const active: ActiveTask[] = all
        .filter((n: any) => ACTIVE_STATUSES.includes(n.status))
        .map((n: any) => ({
          id: n.id,
          title: n.title || '未命名',
          status: n.status,
          progress: n.progress || 0,
          phaseDetail: getPhaseDetail({
            id: n.id, title: n.title, status: n.status, progress: n.progress || 0,
            phaseDetail: '', totalEpisodes: n.totalEpisodes || 0,
            currentEpisode: n.currentEpisode || 0, updatedAt: 0,
          }),
          totalEpisodes: n.totalEpisodes || 0,
          currentEpisode: n.currentEpisode || 0,
          updatedAt: Date.now(),
        }));
      setTasks(active);
    } catch {
      // 静默
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    poll();
    pollTimer.current = setInterval(poll, 3000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [poll]);

  const handleRefresh = () => {
    setRefreshing(true);
    poll();
  };

  // 点击任务 -> 跳到 Chat 进度页（用 novelId）
  const handleTaskPress = (task: ActiveTask) => {
    navigation.navigate('Chat', { novelId: task.id, novelTitle: task.title });
  };

  // 跳到 Upload Tab
  const goUpload = () => navigation.navigate('HomeTabs', { screen: 'Upload' });

  const renderStatusDot = (status: string) => {
    if (status === 'analyzing' || status === 'pending' || status === 'queued') {
      return <View style={[styles.dot, styles.dotAccent, { backgroundColor: colors.accent }]} />;
    }
    if (status === 'generating') {
      return <View style={[styles.dot, { backgroundColor: colors.primary }]} />;
    }
    return <View style={[styles.dot, { backgroundColor: colors.success }]} />;
  };

  const renderPhase = (task: ActiveTask) => {
    if (task.status !== 'analyzing' && task.status !== 'pending' && task.status !== 'queued') return null;
    // 根据 progress 推算当前阶段
    let activeIdx = 0;
    if (task.progress > 80) activeIdx = 3;
    else if (task.progress > 50) activeIdx = 2;
    else if (task.progress > 20) activeIdx = 1;
    else if (task.progress > 5) activeIdx = 0;
    return (
      <View style={styles.phaseRow}>
        {CHUNK_PHASES.map((p, i) => (
          <View key={p.key} style={styles.phaseItem}>
            <Ionicons
              name={i <= activeIdx ? 'checkmark-circle' : 'ellipse-outline'}
              size={12}
              color={i <= activeIdx ? colors.success : colors.text.tertiary}
            />
            <Text style={[
              styles.phaseText,
              { color: i === activeIdx ? colors.accent : (i < activeIdx ? colors.success : colors.text.tertiary) },
            ]}>
              {p.label}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={styles.loadingText}>加载中…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sync" size={20} color={colors.accent} />
        <Text style={styles.title}>任务进度</Text>
        {tasks.length > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{tasks.length}</Text>
          </View>
        )}
      </View>

      {tasks.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          <Text style={styles.emptyTitle}>当前没有正在执行的任务</Text>
          <Text style={styles.emptyDesc}>上传小说后会自动在这里显示进度</Text>
          <TouchableOpacity
            style={styles.goUploadBtn}
            onPress={goUpload}
          >
            <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
            <Text style={styles.goUploadText}>去上传</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          {tasks.map(task => {
            const isAnalyzing = ['analyzing', 'pending', 'queued'].includes(task.status);
            const isGenerating = task.status === 'generating';
            const isActive = isAnalyzing || isGenerating;
            const gradColor = isGenerating
              ? [colors.primary, colors.success]
              : [colors.accent, colors.primary];

            return (
              <TouchableOpacity
                key={task.id}
                style={styles.taskCard}
                onPress={() => handleTaskPress(task)}
                activeOpacity={0.7}
              >
                {/* 头部 */}
                <View style={styles.taskHeader}>
                  <View style={styles.taskHeaderLeft}>
                    {renderStatusDot(task.status)}
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text style={styles.taskTitle} numberOfLines={1}>
                        {task.title}
                      </Text>
                      <Text style={styles.taskStatus}>
                        {task.status === 'analyzing' ? '分析中' :
                         task.status === 'generating' ? '生成中' :
                         task.status === 'pending' ? '等待中' :
                         task.status === 'queued' ? '排队中' :
                         task.status === 'analyzed' ? '分析完成' : task.status}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
                </View>

                {/* 进度条 */}
                {isActive && (
                  <View style={styles.progressSection}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${Math.max(task.progress, 2)}%`,
                            backgroundColor: gradColor[0],
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.progressInfo}>
                      <Text style={styles.phaseDetail}>{task.phaseDetail}</Text>
                      <Text style={styles.progressPercent}>{task.progress}%</Text>
                    </View>

                    {/* 阶段 */}
                    {renderPhase(task)}

                    {/* 剧集进度 (生成阶段) */}
                    {isGenerating && task.totalEpisodes > 0 && (
                      <View style={styles.episodeProgress}>
                        <View style={styles.progressBarBg}>
                          <View
                            style={[
                              styles.progressBar,
                              {
                                width: `${(task.currentEpisode / task.totalEpisodes) * 100}%`,
                                backgroundColor: colors.success,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.episodeProgressText}>
                          {task.currentEpisode}/{task.totalEpisodes} 集
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* 完成 */}
                {task.status === 'analyzed' && (
                  <View style={styles.completeRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={styles.completeText}>分析完成 - 可生成剧集</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary },
  loadingText: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    marginLeft: 4,
  },
  countPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    minWidth: 24,
    alignItems: 'center',
  },
  countPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
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
    marginBottom: spacing.md,
  },
  goUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    gap: spacing.xs,
  },
  goUploadText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: spacing.md,
    paddingBottom: 80,
  },
  taskCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotAccent: {},
  taskTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 15,
  },
  taskStatus: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  progressSection: {
    marginTop: spacing.sm,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  phaseDetail: {
    ...typography.caption,
    color: colors.text.tertiary,
    flex: 1,
  },
  progressPercent: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  phaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  phaseText: {
    fontSize: 11,
  },
  episodeProgress: {
    marginTop: spacing.sm,
  },
  episodeProgressText: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 4,
    textAlign: 'right',
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  completeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
});
