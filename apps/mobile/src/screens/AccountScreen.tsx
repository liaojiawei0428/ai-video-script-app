// apps/mobile/src/screens/AccountScreen.tsx
// v3.0.0 (S58): 账号设置 - 改密页 - 跟 web AccountPage.tsx 1:1 镜像
// 后端: PUT /api/users/password (auth 中间件) -> 修改成功 3s 后 logout 跳 Login

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNovelStore } from '../store/useNovelStore';
import { changePassword, setAuthToken } from '../api/client';
import { deleteToken } from '../db/tokenStorage';
import { clearAllLocalData } from '../db/sqlite';
import { colors, spacing, radii, typography } from '../theme';
import type { RootStackParamList } from '../types/navigation';

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

function calcStrength(pwd: string): { level: StrengthLevel; label: string; color: string } {
  if (!pwd) return { level: 0, label: '', color: colors.border };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { level: 1, label: '弱', color: '#EF4444' };
  if (score === 2) return { level: 2, label: '中等', color: '#F59E0B' };
  if (score === 3) return { level: 3, label: '强', color: '#3B82F6' };
  return { level: 4, label: '很强', color: '#10B981' };
}

export function AccountScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userInfo = useNovelStore(s => s.userInfo);
  const logout = useNovelStore(s => s.logout);
  const clearNovels = useNovelStore(s => s.clearNovels);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  const strength = calcStrength(newPassword);
  const passwordMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const validate = (): string | null => {
    if (!oldPassword) return '请输入旧密码';
    if (!newPassword) return '请输入新密码';
    if (newPassword.length < 6) return '新密码长度不能少于 6 位';
    if (newPassword === oldPassword) return '新密码不能与旧密码相同';
    if (newPassword !== confirmPassword) return '两次输入的新密码不一致';
    return null;
  };

  const handleSubmit = async () => {
    setErr('');
    setSuccess('');
    const validationErr = validate();
    if (validationErr) {
      setErr(validationErr);
      return;
    }

    setSaving(true);
    try {
      await changePassword(oldPassword, newPassword);
      setSuccess('✓ 密码修改成功！3 秒后自动退出，请使用新密码重新登录');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(async () => {
        await deleteToken();
        setAuthToken(null);
        clearNovels();
        logout();
        clearAllLocalData().catch(() => {});
        navigation.reset({ index: 0, routes: [{ name: 'Login' as any }] });
      }, 3000);
    } catch (e: any) {
      const code = e?.response?.data?.error?.code;
      const msg = e?.response?.data?.error?.message;
      if (code === 'AUTH_FAILED') {
        setErr('⚠ 旧密码错误，请重试');
      } else {
        setErr('⚠ ' + (msg || e?.message || '修改失败'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 头部 */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="lock-closed" size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>账号设置</Text>
          <Text style={styles.subtitle}>
            {userInfo?.username || userInfo?.email
              ? `当前账号: ${userInfo.username || userInfo.email}`
              : '登录后修改密码'}
          </Text>
        </View>
      </View>

      {/* 表单卡片 */}
      <View style={styles.card}>
        {/* 旧密码 */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>旧密码</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="输入当前密码"
              placeholderTextColor={colors.text.tertiary}
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry={!showOld}
              autoComplete="current-password"
              editable={!saving}
            />
            <TouchableOpacity onPress={() => setShowOld(!showOld)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons
                name={showOld ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* 新密码 */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>新密码</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="至少 6 位，建议字母+数字+符号混合"
              placeholderTextColor={colors.text.tertiary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
              autoComplete="new-password"
              editable={!saving}
            />
            <TouchableOpacity onPress={() => setShowNew(!showNew)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons
                name={showNew ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          </View>
          {newPassword.length > 0 && (
            <View style={styles.strengthRow}>
              {[1, 2, 3, 4].map(i => (
                <View
                  key={i}
                  style={[
                    styles.strengthBar,
                    { backgroundColor: i <= strength.level ? strength.color : colors.border },
                  ]}
                />
              ))}
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}
        </View>

        {/* 确认密码 */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>确认新密码</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="再输入一次新密码"
              placeholderTextColor={colors.text.tertiary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              autoComplete="new-password"
              editable={!saving}
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          </View>
          {confirmPassword.length > 0 && (
            <Text style={[styles.matchHint, { color: passwordMatch ? colors.success : colors.error }]}>
              {passwordMatch ? '✓ 两次密码一致' : '✗ 两次密码不一致'}
            </Text>
          )}
        </View>

        {/* 错误/成功提示 */}
        {err ? (
          <View style={styles.errBox}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errText}>{err}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        {/* 操作按钮 */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.cancelBtn, saving && { opacity: 0.6 }]}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color="#fff" />
                <Text style={styles.submitText}>修改密码</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 安全提示 */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>💡 密码安全建议</Text>
        <View style={styles.tipsList}>
          <Text style={styles.tipItem}>• 至少 6 位，推荐 10 位以上</Text>
          <Text style={styles.tipItem}>• 大小写字母 + 数字 + 符号混合</Text>
          <Text style={styles.tipItem}>• 不要使用生日/手机号/连续数字 (123456, abcdef)</Text>
          <Text style={styles.tipItem}>• 修改后请记住新密码，我们不支持找回密码</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  title: { ...typography.h2, color: colors.text.primary },
  subtitle: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldGroup: { marginBottom: spacing.md },
  label: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm + 2,
  },
  inputIcon: { marginRight: spacing.xs },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    paddingVertical: spacing.sm + 2,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    marginLeft: spacing.xs,
    fontWeight: '600',
    minWidth: 28,
    textAlign: 'right',
  },
  matchHint: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  errText: {
    color: colors.error,
    fontSize: 13,
    marginLeft: spacing.xs,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  successText: {
    color: colors.success,
    fontSize: 13,
    marginLeft: spacing.xs,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    backgroundColor: colors.bg.tertiary,
  },
  cancelText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    gap: spacing.xs,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tipsCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipsTitle: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  tipsList: { gap: 4 },
  tipItem: {
    ...typography.caption,
    color: colors.text.tertiary,
    lineHeight: 18,
  },
});
