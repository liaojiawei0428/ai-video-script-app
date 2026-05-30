import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { submitRecharge, getRechargeHistory } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { API_BASE_URL } from '../config';
import { colors, spacing, radii, typography } from '../theme';

export function RechargeScreen({ route, navigation }: any): React.JSX.Element {
  const amount = route.params?.amount || 10;
  const [submitting, setSubmitting] = useState(false);
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
      await submitRecharge(amount);
      Alert.alert('已提交', `充值 ¥${amount.toFixed(2)} 申请已提交，管理员确认后余额自动到账。`);
      const rh = await getRechargeHistory();
      if (rh.data?.data?.records) setRecords(rh.data.data.records);
    } catch (err: any) {
      Alert.alert('提交失败', err?.response?.data?.error?.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

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
          <Text style={styles.submitText}>我已付款 ¥{amount.toFixed(2)}，提交审核</Text>
        )}
      </TouchableOpacity>

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
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: '待审核', color: '#FDCB6E' },
    approved: { label: '已到账', color: '#00CEC9' },
    rejected: { label: '已拒绝', color: '#E17055' },
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
