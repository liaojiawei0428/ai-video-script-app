import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getBillingLogs } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { colors, spacing, radii, typography } from '../theme';

const PRESET_AMOUNTS = [10, 20, 50, 100, 200];

export function BillingScreen(): React.JSX.Element {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState('');
  const { userInfo } = useNovelStore();
  const navigation = useNavigation<any>();

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const r = await getBillingLogs();
      setLogs(r.data?.data?.logs || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  const typeConfig: Record<string, { label: string; color: string; prefix: string }> = {
    charge: { label: '充值', color: '#00CEC9', prefix: '+' },
    consumption: { label: '消费', color: '#E17055', prefix: '-' },
    refund: { label: '退款', color: '#FDCB6E', prefix: '+' },
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.balanceLabel}>账户余额</Text>
        <Text style={styles.balanceAmount}>¥{userInfo?.balance?.toFixed(2) || '0.00'}</Text>
      </View>

      <Text style={styles.sectionTitle}>快捷充值</Text>
      <View style={styles.presets}>
        {PRESET_AMOUNTS.map(a => (
          <TouchableOpacity
            key={a}
            style={styles.presetBtn}
            onPress={() => navigation.navigate('Recharge', { amount: a })}
          >
            <Text style={styles.presetText}>¥{a}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.customRow}>
        <TextInput
          style={styles.customInput}
          placeholder="自定义金额"
          placeholderTextColor={colors.text.tertiary}
          keyboardType="numeric"
          value={customAmount}
          onChangeText={setCustomAmount}
        />
        <TouchableOpacity
          style={styles.customBtn}
          onPress={() => {
            const amt = parseFloat(customAmount);
            if (isNaN(amt) || amt < 1) { Alert.alert('提示', '最低充值 ¥1'); return; }
            navigation.navigate('Recharge', { amount: amt });
          }}
        >
          <Text style={styles.customBtnText}>充值</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>交易记录</Text>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const cfg = typeConfig[item.type] || typeConfig.consumption;
            return (
              <View style={styles.logItem}>
                <View style={styles.logLeft}>
                  <Text style={[styles.logType, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={styles.logDesc}>{item.description}</Text>
                  {item.wordCount > 0 && (
                    <Text style={styles.logWordCount}>{(item.wordCount / 10000).toFixed(2)}万字</Text>
                  )}
                </View>
                <View style={styles.logRight}>
                  <Text style={[styles.logAmount, { color: cfg.color }]}>
                    {cfg.prefix}¥{Math.abs(item.amount).toFixed(2)}
                  </Text>
                  <Text style={styles.logBalance}>余额 ¥{item.balanceAfter?.toFixed(2)}</Text>
                  <Text style={styles.logTime}>{formatTime(item.createdAt)}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>暂无交易记录</Text>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

function formatTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    backgroundColor: colors.accent + '15',
    margin: spacing.md,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  balanceLabel: { ...typography.caption, color: colors.accent, marginBottom: 4 },
  balanceAmount: { fontSize: 36, fontWeight: '800', color: colors.accent },
  sectionTitle: { ...typography.h3, color: colors.text.secondary, marginHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  presetBtn: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  presetText: { ...typography.h3, color: colors.accent },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  customInput: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    borderRadius: radii.md,
    color: colors.text.primary,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    ...typography.h3,
  },
  customBtn: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  customBtnText: { ...typography.h3, color: colors.text.inverse },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  logLeft: { flex: 1, marginRight: spacing.sm },
  logType: { ...typography.caption, fontWeight: '700', marginBottom: 2 },
  logDesc: { ...typography.body, color: colors.text.primary, fontSize: 13 },
  logWordCount: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
  logRight: { alignItems: 'flex-end' },
  logAmount: { ...typography.h3, fontWeight: '700' },
  logBalance: { ...typography.caption, color: colors.text.tertiary },
  logTime: { ...typography.caption, color: colors.text.tertiary, fontSize: 11 },
  emptyText: { ...typography.body, color: colors.text.tertiary, textAlign: 'center', marginTop: 60 },
});
