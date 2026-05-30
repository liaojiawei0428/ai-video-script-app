import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { apiClient, getAuthToken, estimateFee } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { saveNovel } from '../db/sqlite';
import { API_BASE_URL } from '../config';
import { GradientButton, GlassCard, ToastProvider, useToast } from '../components';
import { colors, spacing, radii, typography, shadows, layout } from '../theme';

export function UploadScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const { addNovel, addActiveTask, isLoggedIn } = useNovelStore();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const toast = useToast();
  const [feeInfo, setFeeInfo] = useState<{ amount: number; unitPrice: number; sufficient: boolean } | null>(null);

  useEffect(() => {
    if (fileInfo && isLoggedIn) {
      // 中文UTF-8每字符约3字节，估算字数
      const estimatedChars = Math.round(fileInfo.size / 3);
      estimateFee(estimatedChars)
        .then(r => {
          const d = r.data?.data;
          if (d) {
            setFeeInfo({
              amount: d.amount ?? d.total ?? 0,
              unitPrice: d.unitPrice ?? 0.012,
              sufficient: d.sufficient ?? ((d.balance || 0) >= (d.total || 0)),
            });
          }
        })
        .catch(() => setFeeInfo(null));
    }
  }, [fileInfo, isLoggedIn]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.plainText],
      });
      const file = result[0];
      if (!file.uri || !file.name) return;
      setFileInfo({ name: file.name, size: file.size || 0 });
      setUri(file.uri);
      setTitle(file.name.replace(/\.txt$/i, ''));
    } catch (err) {
      if (DocumentPicker.isCancel(err)) return;
      Alert.alert('错误', '选择文件失败');
    }
  };

  const startUpload = async () => {
    if (!uri || !fileInfo) return;

    // 检查登录状态
    if (!isLoggedIn) {
      Alert.alert('请先登录', '上传小说需要登录账号', [
        { text: '去登录', onPress: () => navigation.navigate('Home') },
        { text: '取消', style: 'cancel' },
      ]);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const xhr = new XMLHttpRequest();
    const guardTimer = setTimeout(() => {
      try { xhr.abort(); } catch {}
      setUploading(false);
      setFileInfo(null);
      setUri(null);
      setUploadProgress(0);
      Alert.alert('上传超时', '上传时间过长，请重试');
    }, 130000);
    try {
      const progressTimer = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 2, 95));
      }, 2000);

      const result = await new Promise<any>((resolve, reject) => {
        const url = (API_BASE_URL || 'http://159.75.16.110:6000/api') + '/novels/upload';
        xhr.open('POST', url);
        const token = getAuthToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.timeout = 120000;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
            clearInterval(progressTimer);
          }
        };

        xhr.onload = () => {
          clearInterval(progressTimer);
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve({ data: parsed });
            } else {
              reject(new Error(`服务器错误 (${xhr.status}): ${parsed?.error?.message || xhr.responseText?.slice(0, 100)}`));
            }
          } catch {
            reject(new Error(`响应解析失败 (HTTP ${xhr.status}): ${xhr.responseText?.slice(0, 100)}`));
          }
        };

        xhr.onerror = () => { clearInterval(progressTimer); reject(new Error('网络连接失败')); };
        xhr.ontimeout = () => { clearInterval(progressTimer); reject(new Error('上传超时（120秒）')); };

        const formData = new FormData();
        const safeName = fileInfo.name.endsWith('.txt') ? fileInfo.name : fileInfo.name + '.txt';
        formData.append('file', { uri, name: safeName, type: 'text/plain' } as any);
        if (title) formData.append('title', title);
        formData.append('author', 'User');
        xhr.send(formData);
      });

      setUploadProgress(100);
      const body = result.data?.data;
      if (!body || !body.novelId) {
        throw new Error('服务器返回数据异常');
      }
      const { novelId, title: novelTitle, totalChars, taskId } = body;

      const novel = {
        id: novelId,
        title: novelTitle || fileInfo.name.replace('.txt', ''),
        author: 'User',
        totalChars: totalChars || fileInfo.size,
        totalWords: Math.floor((totalChars || fileInfo.size) / 2),
        genre: '', theme: '', style: '', tone: '',
        status: 'analyzing' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveNovel(novel);
      addNovel(novel);

      if (taskId) {
        addActiveTask({
          novelId,
          novelTitle: novel.title,
          genre: '',
          taskId,
          status: 'queued',
          progress: 0,
          phase: 'analyzing',
        });
      }

      toast.show('已提交，正在跳转到进度页...', 'cloud-upload');
      setTimeout(() => {
        navigation.navigate('Chat', { novelId, novelTitle: novel.title });
      }, 800);
    } catch (error) {
      Alert.alert('上传失败', typeof error === 'object' && error !== null ? ((error as any).message || JSON.stringify(error)) : String(error || '未知错误'));
    } finally {
      clearTimeout(guardTimer);
      setUploading(false);
      setFileInfo(null);
      setUri(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>上传小说</Text>
      <Text style={styles.pageSub}>选择 TXT 格式小说文件，AI 将自动分析并生成剧本</Text>

      <Text style={styles.label}>剧本名称（选填）</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="默认使用文件名"
        placeholderTextColor={colors.text.tertiary}
      />

      <TouchableOpacity style={styles.uploadArea} onPress={pickDocument} disabled={uploading}>
        {fileInfo ? (
          <View style={styles.fileSelected}>
            <Ionicons name="document-text" size={40} color={colors.primary} />
            <Text style={styles.fileName}>{fileInfo.name}</Text>
            <Text style={styles.fileSize}>
              {(fileInfo.size / 1024 / 1024).toFixed(1)}MB
            </Text>
          </View>
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={48} color={colors.primary} />
            <Text style={styles.uploadText}>点击选择 TXT 文件</Text>
            <Text style={styles.uploadHint}>支持 .txt 格式文件</Text>
          </>
        )}
      </TouchableOpacity>

      {fileInfo && (
        <>
          {feeInfo && (
            <View style={styles.feeCard}>
              <Text style={styles.feeLabel}>预计费用</Text>
              <Text style={[styles.feeAmount, !feeInfo.sufficient && styles.feeInsufficient]}>
                ¥{feeInfo.amount.toFixed(2)}
              </Text>
              <Text style={styles.feeUnit}>
                ¥{feeInfo.unitPrice}/千字 · {(fileInfo.size / 1000).toFixed(0)}千字
              </Text>
              {!feeInfo.sufficient && (
                <View style={styles.feeWarningRow}>
                  <Ionicons name="warning" size={16} color={colors.error} />
                  <Text style={styles.feeWarning}> 余额不足，请先充值</Text>
                </View>
              )}
            </View>
          )}
          <GradientButton
          title={uploading ? `上传中 ${uploadProgress}%` : '开始上传并分析'}
          onPress={startUpload}
          loading={uploading}
          disabled={uploading}
          style={{ marginBottom: spacing.lg }}
        />
          </>
        )}

      <GlassCard padded={true} style={{ marginBottom: spacing.md }}>
        <Text style={styles.infoTitle}>自动流程</Text>
        <Text style={styles.infoItem}>1. 上传小说 → AI 自动分析角色/剧情</Text>
        <Text style={styles.infoItem}>2. AI 智能划分剧集</Text>
        <Text style={styles.infoItem}>3. 保存到本地书架</Text>
        <Text style={styles.infoItem}>4. 可编辑剧集内容 + AI 生成分镜头</Text>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.md, paddingBottom: 40 },
  pageTitle: { ...typography.h1, marginBottom: spacing.sm },
  pageSub: { ...typography.body, marginBottom: spacing.lg },
  label: { ...typography.h3, color: colors.text.secondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.bg.secondary,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text.primary,
    fontSize: 16,
    marginBottom: spacing.md,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    marginBottom: spacing.lg,
  },
  uploadIcon: { fontSize: 40, marginBottom: spacing.sm },
  uploadText: { ...typography.h3, color: colors.accent, marginBottom: spacing.xs },
  uploadHint: { ...typography.caption, color: colors.text.tertiary },
  fileSelected: { alignItems: 'center' },
  fileIcon: { fontSize: 32, marginBottom: spacing.sm },
  fileName: { ...typography.h3, color: colors.text.primary, marginBottom: spacing.xs },
  fileSize: { ...typography.caption, color: colors.text.tertiary },
  infoTitle: { ...typography.h3, color: colors.text.primary, marginBottom: spacing.sm },
  infoItem: { ...typography.body, lineHeight: 22, marginBottom: spacing.xs },
  feeCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  feeLabel: { ...typography.caption, color: colors.text.tertiary, marginBottom: 4 },
  feeAmount: { fontSize: 28, fontWeight: '800', color: colors.accent },
  feeInsufficient: { color: colors.error },
  feeUnit: { ...typography.caption, color: colors.text.tertiary, marginTop: 4 },
  feeWarning: { ...typography.caption, color: colors.error, marginTop: 6, fontWeight: '600' },
});
