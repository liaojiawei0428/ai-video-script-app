/**
 * v2.0.0 - AI 助手侧栏
 * 浮层 Modal: 上下文 (novelId/episodeId) + 自由对话
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing, radii, typography } from '../theme';
import { GlassCard } from '../components';
import { apiClient, getAuthToken } from '../api/client';

type RouteParams = {
  novelId?: string;
  episodeId?: string;
  contextTitle?: string;
};

interface Message { role: 'user' | 'assistant' | 'system'; content: string; }

const SUGGESTIONS = [
  '帮我润色当前剧本',
  '给这个角色写一段对白',
  '如何让剧情更有张力?',
  '推荐适合的镜头切换',
];

export function AIAssistantScreen(): React.JSX.Element {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const params = route.params as RouteParams;
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: `你好, 我是 AI 创作助手 ✨\n${params.contextTitle ? `当前上下文: ${params.contextTitle}\n` : ''}告诉我你想做什么吧, 比如润色剧本/生成对白/剧情建议。`,
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'AI 助手' });
  }, [navigation]);

  const send = async (text: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content }]);
    setLoading(true);
    try {
      const token = getAuthToken();
      // v3.0.0: 改用 OpenAI 标准 messages 数组, 端点 /chat (不是 /chat/assistant)
      // mobile 暂时只发当前一条 user 消息 (Phase B 再扩成完整 history)
      const res = await apiClient.post('/chat', {
        messages: [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content },
        ],
        temperature: 0.7,
        max_tokens: 2048,
        enable_thinking: true,
      }, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const reply = res.data?.data?.reply || res.data?.data?.message || '...';
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      const err = e?.response?.data?.error?.message || e?.message || '请求失败';
      setMessages(m => [...m, { role: 'assistant', content: `❌ ${err}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubbleRow, m.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAI]}>
            <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
              {m.role === 'assistant' && (
                <View style={styles.aiHeader}>
                  <Ionicons name="sparkles" size={14} color={colors.accent} />
                  <Text style={styles.aiLabel}>AI</Text>
                </View>
              )}
              <Text style={[styles.bubbleText, m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAI]}>
                {m.content}
              </Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={[styles.bubbleRow, styles.bubbleRowAI]}>
            <View style={[styles.bubble, styles.bubbleAI]}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          </View>
        )}
        {messages.length === 1 && (
          <View style={styles.suggestionRow}>
            {SUGGESTIONS.map((s, i) => (
              <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => send(s)}>
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="向 AI 助手提问..."
          placeholderTextColor={colors.text.tertiary}
          multiline
          maxLength={500}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => send(input)} disabled={loading || !input.trim()}>
          <Ionicons name="send" size={20} color={loading || !input.trim() ? colors.text.tertiary : '#fff'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 20 },
  bubbleRow: { marginBottom: spacing.sm, flexDirection: 'row' },
  bubbleRowAI: { justifyContent: 'flex-start' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: radii.lg, padding: spacing.md },
  bubbleAI: { backgroundColor: colors.bg.secondary, borderTopLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.accent, borderTopRightRadius: 4 },
  bubbleText: { ...typography.body, lineHeight: 20 },
  bubbleTextAI: { color: colors.text.primary },
  bubbleTextUser: { color: '#fff' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  aiLabel: { ...typography.caption, color: colors.accent, fontWeight: '700', marginLeft: 4, fontSize: 12 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  suggestionChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    backgroundColor: colors.bg.secondary, borderRadius: radii.full,
    borderWidth: 1, borderColor: colors.accent,
  },
  suggestionText: { ...typography.caption, color: colors.accent, fontSize: 12 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.bg.primary,
  },
  input: {
    flex: 1, ...typography.body, color: colors.text.primary,
    backgroundColor: colors.bg.secondary, borderRadius: radii.lg,
    paddingHorizontal: spacing.md, paddingVertical: 10, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
});
