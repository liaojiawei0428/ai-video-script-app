import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { getPricing } from '../api/client';
import { colors, spacing, radii, typography } from '../theme';

export function PricingScreen(): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    getPricing()
      .then(r => setData(r.data?.data || r.data || {}))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const p = data || {};
  const examples = p.examples || {};
  const isVip = p.isVip || false;
  const standardPrice = p.standardPrice || 0.012;
  const vipPrice = p.vipPrice || 0.01;
  const shotStandard = p.shotStandard || 0.05;
  const shotVip = p.shotVip || 0.04; 

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>收费标准</Text>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          按小说原文字数计费，单位：千字。分析、剧本生成、分镜生成打包计费。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>当前费率</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>费率类型</Text>
          <Text style={styles.rowValue}>{isVip ? '套餐用户（优享价）' : '普通用户'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>分析/剧本 单价</Text>
          <Text style={styles.rowValueAcct}>¥{isVip ? vipPrice : standardPrice}/千字</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>分镜生成 单价</Text>
          <Text style={styles.rowValue}>¥{isVip ? shotVip : shotStandard}/集</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>最低消费</Text>
          <Text style={styles.rowValue}>¥0.01</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>VIP 费率</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>分析/剧本</Text>
          <Text style={styles.rowValueAcct}>¥{vipPrice}/千字</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>分镜生成</Text>
          <Text style={styles.rowValue}>¥{shotVip}/集</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>普通费率</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>分析/剧本</Text>
          <Text style={styles.rowValue}>¥{standardPrice}/千字</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>分镜生成</Text>
          <Text style={styles.rowValue}>¥{shotStandard}/集</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>费用示例</Text>
        {Object.keys(examples).length > 0 ? Object.entries(examples).map(([label, amount]: [string, any]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValueAcct}>
              {typeof amount === 'object' ? `分析 ¥${amount.analyze} + 分镜 ¥${amount.shot}` : `¥${amount}`}
            </Text>
          </View>
        )) : (
          <Text style={styles.rowValue}>暂无示例数据</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>套餐优惠</Text>
        <View style={styles.vipCard}>
          <Text style={styles.vipTitle}>开通套餐，立省 {Math.round((1 - vipPrice / standardPrice) * 100)}%</Text>
          <Text style={styles.vipDesc}>套餐用户享受 ¥{vipPrice}/千字 优惠费率</Text>
          <Text style={styles.vipDesc}>分镜生成 ¥{shotVip}/集（原价 ¥{shotStandard}/集）</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>余额</Text>
        <Text style={styles.balanceText}>¥{(p.balance || 0).toFixed(2)}</Text>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary },
  pageTitle: { ...typography.h1, marginBottom: spacing.md },
  notice: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  noticeText: { ...typography.body, color: colors.text.secondary, lineHeight: 22 },
  section: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.h2, color: colors.accent, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { ...typography.body, color: colors.text.tertiary },
  rowValue: { ...typography.body, color: colors.text.primary },
  rowValueAcct: { ...typography.body, color: colors.accent, fontWeight: '700' },
  vipCard: {
    backgroundColor: colors.accent + '15',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  vipTitle: { ...typography.h3, color: colors.accent, marginBottom: spacing.xs },
  vipDesc: { ...typography.body, color: colors.text.secondary, marginBottom: 4 },
  balanceText: { ...typography.h2, color: colors.accent, textAlign: 'center', marginTop: spacing.sm },
});
