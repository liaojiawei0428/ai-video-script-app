import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import { submitFeedback } from '../api/client';
import { colors, spacing, radii, typography } from '../theme';

export function FeedbackScreen(): React.JSX.Element {
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('提示', '请输入反馈内容');
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback(content.trim(), contact.trim());
      Alert.alert('感谢反馈', '您的意见已收到，我们会认真对待每一条反馈。');
      setContent('');
      setContact('');
    } catch (err: any) {
      Alert.alert('提交失败', err?.response?.data?.error?.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>意见反馈</Text>
      <Text style={styles.subtitle}>
        欢迎您提出宝贵的意见和建议，帮助我们持续改进Deep剧本。
      </Text>

      <View style={styles.section}>
        <Text style={styles.label}>反馈内容 *</Text>
        <TextInput
          style={styles.textArea}
          placeholder="请详细描述您遇到的问题或建议..."
          placeholderTextColor={colors.text.tertiary}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          value={content}
          onChangeText={setContent}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>联系方式（选填）</Text>
        <TextInput
          style={styles.input}
          placeholder="邮箱或微信号，方便我们回复您"
          placeholderTextColor={colors.text.tertiary}
          value={contact}
          onChangeText={setContact}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.text.inverse} />
        ) : (
          <Text style={styles.submitText}>提交反馈</Text>
        )}
      </TouchableOpacity>

      <View style={styles.contactSection}>
        <Text style={styles.contactTitle}>其他联系方式</Text>
        <Text style={styles.contactText}>邮箱：378685504@qq.com</Text>
        <Text style={styles.contactText}>官网：maque.uno</Text>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.md },
  pageTitle: { ...typography.h1, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.text.tertiary, marginBottom: spacing.lg },
  section: { marginBottom: spacing.md },
  label: { ...typography.h3, color: colors.text.secondary, marginBottom: spacing.sm },
  textArea: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text.primary,
    ...typography.body,
    padding: spacing.md,
    minHeight: 140,
  },
  input: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text.primary,
    ...typography.body,
    padding: spacing.md,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { ...typography.h3, color: colors.text.inverse },
  contactSection: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  contactTitle: { ...typography.h3, color: colors.text.secondary, marginBottom: spacing.sm },
  contactText: { ...typography.body, color: colors.text.tertiary },
});
