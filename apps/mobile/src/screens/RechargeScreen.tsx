import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { submitRecharge, getRechargeHistory, notifyRechargePaid } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { API_BASE_URL } from '../config';
import { colors, spacing, radii, typography } from '../theme';

export function RechargeScreen({ route, navigation }: any): React.JSX.Element {
  const amount = route.params?.amount || 10;
  const [submitting, setSubmitting] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [currentStatus, setCurrentStatus] = useState<'pending' | 'user_notified' | 'approved' | 'rejected'>('pending');
  const [records, setRecords] = useState<any[]>([]);
  const { isLoggedIn } = useNovelStore();
  const qrImageUrl = `${API_BASE_URL}/recharge/qr-image?t=${Date.now()}`;

  useEffect(() => {
    if (!isLoggedIn) {
      Alert.alert('请先登录', '充值需要登录账号', [{ text: '确定', onPress: () => navigation.goBack() }]);
      return;
    }
    getRechargeHistory().then(r => {
      if (r.data?.data?.records) setRecords(r.data.data.records);
    }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const r = await submitRecharge(amount);
      // v3.0.37 (S72 batch 7 BUG-097): 拆 2 步 — 提交充值 + 用户点"我已付款"通知 admin (跟 web BUG-092 配套, 铁律 4++ 跨项目通用同步)
      const orderId = r.data?.data?.id || '';
      setCurrentOrderId(orderId);
      setCurrentStatus('pending');
      const rh = await getRechargeHistory();
      if (rh.data?.data?.records) setRecords(rh.data.data.records);
    } catch (err: any) {
      Alert.alert('提交失败', err?.response?.data?.error?.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // v3.0.37 (S72 batch 7 BUG-097): 用户点"我已付款" — 调 notifyRechargePaid (跟 web BUG-092 配套)
  const handleNotifyPaid = async () => {
    if (!currentOrderId) {
      Alert.alert('提示', '请先提交充值');
      return;
    }
    setNotifying(true);
    try {
      await notifyRechargePaid(currentOrderId);
      setCurrentStatus('user_notified');
      Alert.alert('已通知', '已通知管理员审核中, 通常 5 分钟内到账');
    } catch (err: any) {
      Alert.alert('通知失败', err?.response?.data?.error?.message || '请稍后重试');
    } finally {
      setNotifying(false);
    }
  };

  // v3.0.37 (S72 batch 7 BUG-097): 5s 轮询订单状态 (跟 BUG-089 教训一致, 只刷 status 不 reload 整个记录)
  useEffect(() => {
    if (!currentOrderId || currentStatus !== 'user_notified') return;
    const timer = setInterval(async () => {
      try {
        const r = await getRechargeHistory();
        const recs = r.data?.data?.records || [];
        const cur = recs.find((x: any) => x.id === currentOrderId);
        if (cur && cur.status !== currentStatus) {
          setCurrentStatus(cur.status as any);
          if (cur.status === 'approved') {
            const rh = await getRechargeHistory();
            if (rh.data?.data?.records) setRecords(rh.data.data.records);
          } else if (cur.status === 'rejected') {
            const rh = await getRechargeHistory();
            if (rh.data?.data?.records) setRecords(rh.data.data.records);
          }
        }
      } catch {}
    }, 5000);
    return () => clearInterval(timer);
  }, [currentOrderId, currentStatus]);

  const openAlipay = async () => {
    const supported = await Linking.canOpenURL('alipays://');
    if (supported) {
      Linking.openURL('alipays://platformapi/startapp?appId=20000056');
    } else {
      Alert.alert('提示', '请保存收款码图片，打开支付宝扫一扫 → 相册 → 选择收款码完成支付');
    }
  };

  const handleLongPress = () => {
    Alert.alert('保存收款码', '将收款码图片保存到手机相册？', [
      { text: '取消', style: 'cancel' },
      {
        text: '保存',
        onPress: async () => {
          try {
            const dest = Platform.OS === 'android'
              ? `${RNFS.PicturesDirectoryPath}/deepjuben_qr_pay.jpg`
              : `${RNFS.DocumentDirectoryPath}/deepjuben_qr_pay.jpg`;
            const { statusCode } = await RNFS.downloadFile({ fromUrl: qrImageUrl, toFile: dest }).promise;
            if (statusCode === 200) {
              try { RNFS.scanFile(dest); } catch {}
              Alert.alert('已保存', '收款码已保存到手机相册\n打开支付宝扫一扫 → 相册 → 选择图片付款');
            } else {
              Alert.alert('保存失败', '请检查网络后重试');
            }
          } catch {
            Alert.alert('保存失败', '请检查网络后重试');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.amount}>¥{amount.toFixed(2)}</Text>
        <Text style={styles.hint}>支付宝扫码支付此金额后，点击下方按钮提交审核</Text>
      </View>

      {qrImageUrl ? (
        <View style={styles.qrWrap}>
          <TouchableOpacity onLongPress={handleLongPress} delayLongPress={500}>
            <Image source={{ uri: qrImageUrl }} style={styles.qrImage} resizeMode="contain" />
          </TouchableOpacity>
          <Text style={styles.qrHint}>长按图片可保存到相册</Text>
        </View>
      ) : (
        <View style={styles.qrWrap}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.qrHint}>加载收款码...</Text>
        </View>
      )}

      <TouchableOpacity style={styles.alipayBtn} onPress={openAlipay}>
        <Text style={styles.alipayText}>📱 打开支付宝扫码</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={colors.text.inverse} />
        ) : (
          <Text style={styles.submitText}>提交充值 ¥{amount.toFixed(2)}</Text>
        )}
      </TouchableOpacity>

      {/* v3.0.37 (S72 batch 7 BUG-097): "我已付款" 按钮 — 修 web 端 BUG-092 同款, 拆 2 步 (提交 + 通知) */}
      {currentOrderId && currentStatus === 'pending' && (
        <TouchableOpacity style={styles.notifyBtn} onPress={handleNotifyPaid} disabled={notifying}>
          {notifying ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.submitText}>✓ 我已付款</Text>
          )}
        </TouchableOpacity>
      )}

      {/* v3.0.37 (S72 batch 7 BUG-097): 4 态 UI 跟 web RechargePage 1:1 对齐 */}
      {currentOrderId && currentStatus === 'user_notified' && (
        <View style={styles.notifiedBox}>
          <Text style={styles.notifiedText}>⏳ 已通知管理员审核中... 请耐心等待 (通常 5 分钟内到账)</Text>
        </View>
      )}

      {records.length > 0 && (
        <View style={styles.recordsSection}>
          <Text style={styles.recordsTitle}>我的充值记录</Text>
          {records.slice(0, 5).map((r: any) => (
            <View key={r.id} style={styles.recordItem}>
              <View>
                <Text style={styles.recordAmount}>¥{r.amount.toFixed(2)}</Text>
                <Text style={styles.recordTime}>{formatTime(r.createdAt)}</Text>
              </View>
              <StatusBadge status={r.status} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  // v3.0.37 (S72 batch 7 BUG-097): 4 态 UI 跟 web RechargePage 1:1 对齐 (user_notified 4 态机)
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: '待支付', color: '#F97316' },
    user_notified: { label: '待审核', color: '#F59E0B' },
    approved: { label: '已到账', color: '#22C55E' },
    rejected: { label: '已拒绝', color: '#EF4444' },
  };
  const cfg = map[status] || map.pending;
  return <Text style={[styles.badge, { color: cfg.color }]}>{cfg.label}</Text>;
}

function formatTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md },
  header: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  amount: { fontSize: 40, fontWeight: '800', color: colors.accent },
  hint: { ...typography.caption, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.sm },
  qrWrap: {
    backgroundColor: '#fff', borderRadius: radii.xl, padding: spacing.lg,
    alignItems: 'center', marginBottom: spacing.lg,
  },
  qrImage: { width: 220, height: 220, borderRadius: radii.md },
  qrHint: { ...typography.caption, color: '#666', marginTop: spacing.sm },
  alipayBtn: {
    backgroundColor: colors.bg.secondary, borderRadius: radii.md,
    padding: spacing.sm + 2, alignItems: 'center', marginBottom: spacing.md,
  },
  alipayText: { ...typography.body, color: colors.accent, fontWeight: '600' },
  submitBtn: {
    backgroundColor: colors.accent, borderRadius: radii.lg,
    padding: spacing.md, alignItems: 'center',
  },
  // v3.0.37 (S72 batch 7 BUG-097): "我已付款" 按钮 + 审核中提示框
  notifyBtn: {
    backgroundColor: '#22C55E', borderRadius: radii.lg,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.sm,
  },
  notifiedBox: {
    backgroundColor: '#FEF3C7', borderRadius: radii.md,
    padding: spacing.md, marginTop: spacing.sm,
    borderWidth: 1, borderColor: '#F59E0B',
  },
  notifiedText: { ...typography.body, color: '#92400E', textAlign: 'center' },
  submitText: { ...typography.h3, color: colors.text.inverse },
  recordsSection: { marginTop: spacing.lg },
  recordsTitle: { ...typography.h3, color: colors.text.secondary, marginBottom: spacing.sm },
  recordItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  recordAmount: { ...typography.h3, color: colors.text.primary },
  recordTime: { ...typography.caption, color: colors.text.tertiary },
  badge: { ...typography.caption, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
});
