// apps/mobile/src/screens/VipCenterScreen.tsx
// v3.0.0 (S58): VIP 会员中心 - 跟 web VipCenterPage.tsx 1:1 镜像
// 后端: POST /api/users/vip/buy -> {balance, vipExpiresAt, vipLevel}
// 流程: 显示 VIP 状态 + 特权列表 + 购买按钮 -> buyVip -> fetchBalance 刷新

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNovelStore } from '../store/useNovelStore';
import { buyVip, getProfile } from '../api/client';
import { colors, spacing, radii, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';

interface VipBenefit {
  title: string;
  desc: string;
}

const VIP_BENEFITS: VipBenefit[] = [
  { title: '生图无限', desc: '取消每日 30 张限制' },
  { title: '视频 5s + 10s 免费', desc: '（普通用户 5s 免费，10s 收 ¥0.1 元）' },
  { title: '小说分析 ¥0.01/千字', desc: '（普通用户 ¥0.012/千字）' },
  { title: '分镜生成 ¥0.04/集', desc: '（普通用户 ¥0.05/集）' },
  { title: '漫画生成 ¥0.08/页', desc: '（普通用户 ¥0.10/页）' },
];

const VIP_PRICE = 10;
const VIP_DAYS = 365;

export function VipCenterScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userInfo = useNovelStore(s => s.userInfo);
  const setUserInfo = useNovelStore(s => s.setUserInfo);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isVip = (userInfo as any)?.vipLevel >= 1;
  const vipExpiresAt = (userInfo as any)?.vipExpiresAt as number | undefined;
  const balance = userInfo?.balance ?? 0;

  // 拉取最新 user (含 balance / vipLevel / vipExpiresAt)
  const fetchUser = useCallback(async () => {
    setFetching(true);
    try {
      const r = await getProfile();
      const fresh = r.data?.data?.user || r.data?.data;
      if (fresh) setUserInfo(fresh);
    } catch {
      // 静默失败
    } finally {
      setFetching(false);
    }
  }, [setUserInfo]);

  useFocusEffect(
    useCallback(() => {
      fetchUser();
    }, [fetchUser])
  );

  const handleBuyVip = () => {
    if (balance < VIP_PRICE) {
      Alert.alert(
        '余额不足',
        `开通 VIP 需要 ¥${VIP_PRICE}，当前余额 ¥${balance.toFixed(2)}，请先充值`,
        [
          { text: '取消', style: 'cancel' },
          { text: '去充值', onPress: () => navigation.navigate('Recharge', { amount: VIP_PRICE }) },
        ]
      );
      return;
    }

    Alert.alert(
      '开通 VIP 会员',
      `¥${VIP_PRICE} 尊享 ${VIP_DAYS} 天 VIP 会员\n享受生图无限 + 视频 5+10s 免费 + 漫画/分镜/小说 8 折优惠`,
      [
        { text: '取消', style: 'cancel' },
        { text: '立即开通', onPress: doBuyVip },
      ]
    );
  };

  const doBuyVip = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const r: any = await buyVip();
      if (r.data?.success) {
        const d = r.data.data;
        setMsg({
          type: 'success',
          text: `开通成功！VIP 会员已激活（有效期 ${VIP_DAYS} 天），余额 ¥${(d?.balance ?? 0).toFixed(2)}`,
        });
        await fetchUser();
      } else {
        const errCode = r.data?.error?.code;
        if (errCode === 'INSUFFICIENT') {
          setMsg({ type: 'error', text: (r.data.error.message || '余额不足') + '，请先充值' });
          setTimeout(() => navigation.navigate('Recharge', { amount: VIP_PRICE }), 2000);
        } else {
          setMsg({ type: 'error', text: r.data?.error?.message || '开通失败' });
        }
      }
    } catch (e: any) {
      const errCode = e?.response?.data?.error?.code;
      if (errCode === 'INSUFFICIENT') {
        setMsg({ type: 'error', text: (e.response.data.error.message || '余额不足') + '，请先充值' });
        setTimeout(() => navigation.navigate('Recharge', { amount: VIP_PRICE }), 2000);
      } else {
        setMsg({ type: 'error', text: e?.response?.data?.error?.message || e?.message || '操作失败' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 头部 */}
      <View style={styles.header}>
        <Ionicons name="diamond" size={24} color={colors.warning} />
        <Text style={styles.title}>VIP 会员中心</Text>
        {fetching && <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: spacing.sm }} />}
      </View>
      <Text style={styles.subtitle}>解锁全部功能，享优惠费率</Text>

      {/* 当前状态卡 */}
      <View style={[styles.statusCard, isVip && styles.statusCardVip]}>
        {isVip ? (
          <View style={styles.statusRow}>
            <View style={styles.crownBox}>
              <Ionicons name="diamond" size={36} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.activeTagRow}>
                <Text style={styles.activeTagText}>VIP 会员已激活</Text>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>已激活</Text>
                </View>
              </View>
              <Text style={styles.activeDesc}>
                ¥0.01/千字 · ¥0.04/集分镜 · 视频 5+10s 免费
              </Text>
              {vipExpiresAt ? (
                <Text style={styles.activeExpiry}>
                  到期时间: {new Date(vipExpiresAt).toLocaleDateString('zh-CN')}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.statusRow}>
            <View style={[styles.crownBox, { backgroundColor: colors.bg.tertiary }]}>
              <Ionicons name="diamond-outline" size={36} color={colors.text.tertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>开通 VIP 会员</Text>
              <Text style={styles.statusDesc}>¥{VIP_PRICE}/{VIP_DAYS}天 · 全场 8 折优惠费率</Text>
            </View>
          </View>
        )}
      </View>

      {/* 消息提示 */}
      {msg ? (
        <View style={[
          styles.msgBox,
          { borderColor: msg.type === 'success' ? colors.success + '50' : colors.error + '50' },
        ]}>
          <Ionicons
            name={msg.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color={msg.type === 'success' ? colors.success : colors.error}
          />
          <Text style={[
            styles.msgText,
            { color: msg.type === 'success' ? colors.success : colors.error },
          ]}>
            {msg.text}
          </Text>
        </View>
      ) : null}

      {/* 特权列表 */}
      <View style={styles.benefitsCard}>
        <Text style={styles.benefitsTitle}>VIP 会员特权</Text>
        {VIP_BENEFITS.map((b, i) => (
          <View key={i} style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitDesc}>{b.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 价格 */}
      <View style={styles.priceCard}>
        <Text style={styles.priceLabel}>VIP 会员价格</Text>
        <View style={styles.priceRow}>
          {isVip && (
            <Text style={styles.priceOld}>¥{VIP_PRICE}</Text>
          )}
          <Text style={styles.priceMain}>¥{VIP_PRICE}</Text>
          <Text style={styles.priceUnit}>/{VIP_DAYS}天</Text>
        </View>
        <Text style={styles.priceTip}>从余额扣除，{VIP_DAYS} 天有效</Text>

        {!isVip && (
          <TouchableOpacity
            style={[styles.buyBtn, loading && { opacity: 0.6 }]}
            onPress={handleBuyVip}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="diamond" size={18} color="#fff" />
                <Text style={styles.buyBtnText}>立即开通 VIP 会员</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.priceFooter}>
          需要先
          <Text
            style={styles.priceFooterLink}
            onPress={() => navigation.navigate('Recharge', { amount: VIP_PRICE })}
          >  充值  </Text>
          ，确保余额 ≥ ¥{VIP_PRICE}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: { ...typography.h1, color: colors.text.primary, marginLeft: 4 },
  subtitle: { ...typography.body, color: colors.text.tertiary, marginTop: 4, marginBottom: spacing.md },

  statusCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusCardVip: {
    borderColor: colors.warning + '60',
    backgroundColor: colors.warning + '08',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  crownBox: {
    width: 60,
    height: 60,
    borderRadius: radii.lg,
    backgroundColor: colors.warning + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  activeTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeTagText: {
    ...typography.h3,
    color: colors.warning,
    marginRight: spacing.sm,
  },
  activePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.success + '20',
  },
  activePillText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
  activeDesc: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  activeExpiry: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  statusTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 2,
  },
  statusDesc: {
    ...typography.body,
    color: colors.text.secondary,
  },

  msgBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  msgText: {
    flex: 1,
    fontSize: 13,
    marginLeft: spacing.xs,
  },

  benefitsCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  benefitsTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  benefitTitle: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  benefitDesc: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },

  priceCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  priceOld: {
    fontSize: 18,
    color: colors.text.tertiary,
    textDecorationLine: 'line-through',
    marginRight: spacing.sm,
  },
  priceMain: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.accent,
  },
  priceUnit: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 4,
  },
  priceTip: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    width: '100%',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  buyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  priceFooter: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  priceFooterLink: {
    color: colors.accent,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
