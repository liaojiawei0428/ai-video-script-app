/**
 * v2.0.0 - 积分订单
 * 列出用户的充值/消费/退款记录
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors, spacing, radii, typography, shadows } from '../theme';
import { GlassCard } from '../components';
import { apiClient } from '../api/client';

interface Order {
  id: string;
  type: 'recharge' | 'consumption' | 'refund';
  amount: number;
  status: string;
  paymentMethod?: string;
  remark?: string;
  createdAt: number;
  completedAt?: number;
}

const TYPE_META: Record<string, { label: string; color: string; sign: string; icon: string }> = {
  recharge: { label: '充值', color: colors.success, sign: '+', icon: 'add-circle' },
  consumption: { label: '消费', color: colors.error, sign: '-', icon: 'remove-circle' },
  refund: { label: '退款', color: colors.warning, sign: '+', icon: 'refresh-circle' },
};

const STATUS_LABEL: Record<string, string> = {
  pending: '处理中',
  paid: '已支付',
  completed: '已完成',
  failed: '失败',
  refunded: '已退款',
  cancelled: '已取消',
};

export function PointsOrderScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get('/orders/points');
      setOrders(res.data?.data?.orders || []);
    } catch (e) {
      // 后端暂未实现, 用 billing_logs 兜底
      try {
        const res = await apiClient.get('/users/billing-logs');
        const logs = (res.data?.data?.logs || []).map((l: any) => ({
          id: l.id,
          type: l.type,
          amount: l.amount,
          status: 'completed',
          remark: l.description,
          createdAt: l.createdAt,
        }));
        setOrders(logs);
      } catch {}
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    navigation.setOptions({ title: '积分订单' });
  }, [navigation]);

  const renderItem = ({ item }: { item: Order }) => {
    const meta = TYPE_META[item.type] || TYPE_META.consumption;
    return (
      <GlassCard padded={true} style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: meta.color + '20' }]}>
            <Ionicons name={meta.icon as any} size={20} color={meta.color} />
          </View>
          <View style={styles.info}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{meta.label}</Text>
              <Text style={[styles.amount, { color: meta.color }]}>
                {meta.sign}¥{item.amount?.toFixed(2) || '0.00'}
              </Text>
            </View>
            <Text style={styles.meta} numberOfLines={1}>{item.remark || '—'}</Text>
            <View style={styles.statusRow}>
              <Text style={styles.time}>
                {new Date(item.createdAt).toLocaleString('zh-CN')}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: (item.status === 'completed' || item.status === 'paid' ? colors.success : colors.warning) + '20' }]}>
                <Text style={[styles.statusText, { color: item.status === 'completed' || item.status === 'paid' ? colors.success : colors.warning }]}>
                  {STATUS_LABEL[item.status] || item.status}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </GlassCard>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={o => o.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={64} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>暂无订单</Text>
            <Text style={styles.emptySub}>充值和消费记录会在这里展示</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.primary },
  list: { padding: spacing.md, paddingBottom: 40 },
  card: { marginBottom: spacing.sm, ...shadows.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.h3, color: colors.text.primary, fontWeight: '700' },
  amount: { fontSize: 18, fontWeight: '800' },
  meta: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  time: { ...typography.caption, color: colors.text.tertiary, fontSize: 11 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm },
  statusText: { ...typography.caption, fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { ...typography.h2, color: colors.text.secondary, marginTop: spacing.md },
  emptySub: { ...typography.body, color: colors.text.tertiary, marginTop: spacing.xs, textAlign: 'center' },
});
