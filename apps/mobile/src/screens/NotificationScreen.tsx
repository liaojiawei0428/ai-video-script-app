import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api/client';
import { colors, spacing, radii, typography } from '../theme';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: number;
}

const typeConfig: Record<string, { icon: string; color: string }> = {
  feedback_reply: { icon: '💬', color: '#007AFF' },
  announcement: { icon: '📢', color: '#FF9F0A' },
  system: { icon: '🔔', color: '#8E8E93' },
};

export function NotificationScreen({ navigation }: any): React.JSX.Element {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await getNotifications();
      setNotifications(r.data?.data?.notifications || []);
    } catch {} finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const handleMarkAllRead = () => {
    if (notifications.every(n => n.isRead)) return;
    Alert.alert('全部已读', '确定将所有消息标记为已读？', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: async () => {
        try {
          await markAllNotificationsRead();
          setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch {}
      }},
    ]);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>系统消息</Text>
        {notifications.some(n => !n.isRead) && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllBtn}>全部已读</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>暂无消息</Text>
          </View>
        }
        renderItem={({ item }) => {
          const cfg = typeConfig[item.type] || typeConfig.system;
          return (
            <TouchableOpacity
              style={[styles.item, !item.isRead && styles.itemUnread]}
              onPress={() => handleMarkRead(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemIcon}>{cfg.icon}</Text>
                <Text style={[styles.itemTitle, !item.isRead && styles.itemTitleUnread]}>{item.title}</Text>
                {!item.isRead && <View style={styles.dot} />}
              </View>
              <Text style={styles.itemContent} numberOfLines={4}>{item.content}</Text>
              <Text style={styles.itemTime}>{formatTime(item.createdAt)}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h1, color: colors.text.primary },
  markAllBtn: { ...typography.body, color: colors.accent, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { ...typography.body, color: colors.text.tertiary },
  item: {
    backgroundColor: colors.bg.secondary, borderRadius: radii.lg,
    padding: spacing.md, marginHorizontal: spacing.sm, marginVertical: spacing.xs,
  },
  itemUnread: { borderLeftWidth: 3, borderLeftColor: colors.accent },
  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  itemIcon: { fontSize: 18, marginRight: spacing.sm },
  itemTitle: { ...typography.h3, color: colors.text.primary, flex: 1 },
  itemTitleUnread: { fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  itemContent: { ...typography.body, color: colors.text.secondary, lineHeight: 20 },
  itemTime: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.sm },
});
