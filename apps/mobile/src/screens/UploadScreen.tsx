import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DocumentPicker from 'react-native-document-picker';
import { uploadFile } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { saveNovel } from '../db/sqlite';

export function UploadScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { addNovel } = useNovelStore();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [
          DocumentPicker.types.plainText,
          'application/epub+zip',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
      });

      if (result.length > 0) {
        await uploadNovel(result[0].uri, result[0].name);
      }
    } catch (err) {
      if (DocumentPicker.isCancel(err)) return;
      Alert.alert('错误', '选择文件失败');
    }
  };

  const uploadNovel = async (fileUri: string, fileName: string) => {
    setUploading(true);
    try {
      const response = await uploadFile(
        fileUri,
        fileName,
        title || undefined
      );

      const novel = response.data.data;
      await saveNovel(novel);
      addNovel(novel);

      Alert.alert('上传成功', '小说已上传，开始分析？', [
        { text: '稍后', onPress: () => navigation.goBack() },
        {
          text: '开始分析',
          onPress: () =>
            navigation.navigate('Progress' as never, {
              novelId: novel.novelId,
              taskType: 'analyze',
            } as never),
        },
      ]);
    } catch (error) {
      Alert.alert('上传失败', error instanceof Error ? error.message : '未知错误');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>小说标题（可选）</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="输入小说标题"
      />

      <Text style={styles.label}>作者（可选）</Text>
      <TextInput
        style={styles.input}
        value={author}
        onChangeText={setAuthor}
        placeholder="输入作者名"
      />

      <TouchableOpacity
        style={[styles.uploadButton, uploading && styles.uploadingButton]}
        onPress={pickDocument}
        disabled={uploading}
      >
        <Text style={styles.uploadButtonText}>
          {uploading ? '上传中...' : '选择文件并上传'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.hint}>支持格式：TXT、EPUB、DOCX</Text>
      <Text style={styles.hint}>最大文件大小：50MB</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  uploadingButton: {
    backgroundColor: '#999',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    textAlign: 'center',
    color: '#999',
    marginTop: 12,
    fontSize: 14,
  },
});
