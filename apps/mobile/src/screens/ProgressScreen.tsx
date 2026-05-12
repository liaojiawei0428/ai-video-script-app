import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { analyzeNovel, generateEpisodes, getTaskProgress } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';

export function ProgressScreen(): React.JSX.Element {
  const route = useRoute();
  const navigation = useNavigation();
  const { novelId, taskType } = route.params as { novelId: string; taskType: string };
  const { currentTask, setCurrentTask } = useNovelStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startTask();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startTask = async () => {
    try {
      let response;
      if (taskType === 'analyze') {
        response = await analyzeNovel(novelId);
      } else if (taskType === 'episode_generate') {
        response = await generateEpisodes(novelId);
      }

      if (response?.data.data) {
        const task = response.data.data;
        setCurrentTask({ id: task.taskId, status: task.status, progress: 0 } as any);
        startPolling(task.taskId);
      }
    } catch (error) {
      console.error('Task start failed', error);
    }
  };

  const startPolling = (taskId: string) => {
    intervalRef.current = setInterval(async () => {
      try {
        const response = await getTaskProgress(taskId);
        const task = response.data.data;
        setCurrentTask(task as any);

        if (task.status === 'completed') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(() => {
            navigation.navigate('Analysis' as never, { novelId } as never);
          }, 1000);
        } else if (task.status === 'failed') {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch (error) {
        console.error('Polling failed', error);
      }
    }, 2000);
  };

  const getStatusText = () => {
    switch (currentTask?.status) {
      case 'queued':
        return '排队中...';
      case 'running':
        return '处理中...';
      case 'completed':
        return '完成！';
      case 'failed':
        return '失败';
      default:
        return '准备中...';
    }
  };

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.statusText}>{getStatusText()}</Text>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${currentTask?.progress || 0}%` },
          ]}
        />
      </View>
      <Text style={styles.progressText}>{currentTask?.progress || 0}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 20,
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: '#ddd',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});
