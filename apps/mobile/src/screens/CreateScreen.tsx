import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { uploadFile } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { saveNovel } from '../db/sqlite';
import { colors, spacing, radii, typography } from '../theme';

export function CreateScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const { addNovel, addActiveTask } = useNovelStore();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [uri, setUri] = useState<string | null>(null);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.plainText],
      });
      const file = result[0];
      if (!file.uri || !file.name) return;
      setFileInfo({ name: file.name, size: file.size || 0 });
      setUri(file.uri);
    } catch (err) {
      if (DocumentPicker.isCancel(err)) return;
      Alert.alert('错误', '选择文件失败');
    }
  };

  const startUpload = async () => {
    if (!uri || !fileInfo) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const response = await uploadFile(uri, fileInfo.name, title || undefined, (pct) => {
        setUploadProgress(pct);
      });
      const { novelId, title, taskId, totalChars } = response.data.data;

      const novel = {
        id: novelId,
        title: title || fileInfo.name.replace('.txt', ''),
        author: 'User',
        totalChars: totalChars || fileInfo.size,
        totalWords: Math.floor((totalChars || fileInfo.size) / 2),
        genre: '',
        theme: '',
        style: '',
        tone: '',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveNovel(novel);
      addNovel(novel);

      // Start tracking progress
      if (taskId) {
        addActiveTask({
          novelId,
          novelTitle: novel.title,
          genre: '',
          taskId,
          status: 'running',
          progress: 0,
          phase: 'analyzing',
        });
      }

      Alert.alert('上传成功', '小说已上传，正在分析中...\n可前往首页查看进度', [
        { text: '好的', onPress: () => navigation.navigate('Home') },
      ]);
    } catch (error) {
      Alert.alert('上传失败', error instanceof Error ? error.message : '请检查网络连接');
    } finally {
      setUploading(false);
      setFileInfo(null);
      setUri(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>创建新剧本</Text>
      <Text style={styles.pageSub}>从手机上传TXT格式小说，AI将自动分析并生成专业视频剧本</Text>

      {/* Title Input */}
      <Text style={styles.label}>剧本名称</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="输入剧本名称（选填，默认使用文件名）"
        placeholderTextColor="#C7C7CC"
      />

      {/* Upload Area */}
      <TouchableOpacity style={styles.uploadArea} onPress={pickDocument} disabled={uploading}>
        {fileInfo ? (
          <View style={styles.fileSelected}>
            <Text style={styles.fileIcon}>📄</Text>
            <Text style={styles.fileName}>{fileInfo.name}</Text>
            <Text style={styles.fileSize}>
              {(fileInfo.size / 1024 / 1024).toFixed(1)}MB
              {fileInfo.size > 52428800 ? ' 超过50MB限制' : ''}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.uploadIcon}>📤</Text>
            <Text style={styles.uploadText}>点击选择 TXT 文件</Text>
            <Text style={styles.uploadHint}>支持 .txt 格式，最大 50 万字</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Info Cards */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>处理流程</Text>
        <Text style={styles.infoItem}>1. 上传小说 → 自动分析角色/剧情</Text>
        <Text style={styles.infoItem}>2. 智能划分剧集（每集约120秒）</Text>
        <Text style={styles.infoItem}>3. 生成详细镜头描述（AI可直接使用）</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>费用参考</Text>
        <Text style={styles.infoItem}>每10万字约 ¥0.1（Deepseek V4 API）</Text>
        <Text style={styles.infoItem}>50万字小说全程约 ¥0.5-1.0</Text>
      </View>

      {/* Start Button */}
      {fileInfo && (
        <TouchableOpacity
          style={[styles.startButton, uploading && styles.startButtonDisabled]}
          onPress={startUpload}
          disabled={uploading || (fileInfo?.size || 0) > 52428800}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startButtonText}>开始分析并生成剧本</Text>
          )}
        </TouchableOpacity>
      )}
      {uploading && uploadProgress > 0 && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>上传中 {uploadProgress}%</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 20, paddingBottom: 40 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#1C1C1E', marginBottom: 8, marginTop: 12 },
  pageSub: { fontSize: 14, color: '#94A3B8', lineHeight: 20, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: {
    backgroundColor: '#fff', padding: 14, borderRadius: 12, fontSize: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#E8E8ED', color: '#1C1C1E',
  },
  uploadArea: {
    borderWidth: 2, borderColor: '#C7C7CC', borderStyle: 'dashed', borderRadius: 16,
    padding: 32, alignItems: 'center', backgroundColor: '#fff', marginBottom: 20,
  },
  uploadIcon: { fontSize: 40, marginBottom: 12 },
  uploadText: { fontSize: 16, fontWeight: '600', color: '#2563EB', marginBottom: 4 },
  uploadHint: { fontSize: 13, color: '#94A3B8' },
  fileSelected: { alignItems: 'center' },
  fileIcon: { fontSize: 32, marginBottom: 8 },
  fileName: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', marginBottom: 4 },
  fileSize: { fontSize: 13, color: '#94A3B8' },
  infoCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 10 },
  infoItem: { fontSize: 13, color: '#555', lineHeight: 22 },
  startButton: {
    backgroundColor: '#2563EB', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12,
  },
  startButtonDisabled: { backgroundColor: '#A2C8FF' },
  startButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  progressWrap: { marginTop: 16, alignItems: 'center' },
  progressBg: { width: '100%', height: 6, backgroundColor: '#E8E8ED', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 3 },
  progressText: { fontSize: 12, color: '#94A3B8', marginTop: 6 },
});
