// apps/mobile/src/screens/RegisterScreen.tsx
// v3.0.0 (S58): 注册页 - 跟 web RegisterPage.tsx 1:1 镜像
// 后端: POST /api/users/register -> {token, user} (自动登录)
// 流程: 输入 username + password + confirm -> register -> saveToken -> 跳 HomeTabs

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNovelStore } from '../store/useNovelStore';
import { register, setAuthToken } from '../api/client';
import { saveToken } from '../db/tokenStorage';
import { colors, spacing, radii, typography } from '../theme';
import { APP_DISPLAY_NAME } from '../config/version';
import type { RootStackParamList } from '../types/navigation';

export function RegisterScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isLoggedIn = useNovelStore(s => s.isLoggedIn);
  const setUserInfo = useNovelStore(s => s.setUserInfo);
  const setLoggedIn = useNovelStore(s => s.setLoggedIn);
  const setAdmin = useNovelStore(s => s.setAdmin);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [focusedField, setFocusedField] = useState<'username' | 'password' | 'confirm' | null>(null);

  useEffect(() => {
    if (isLoggedIn) {
      navigation.navigate('HomeTabs', { screen: 'Home' } as any);
    }
  }, [isLoggedIn]);

  const validate = (): string | null => {
    if (username.length < 2) return '用户名至少 2 个字符';
    if (username.length > 50) return '用户名不能超过 50 个字符';
    if (password.length < 6) return '密码至少 6 位';
    if (password !== confirm) return '两次密码不一致';
    return null;
  };

  const handleRegister = async () => {
    setErr('');
    const validationErr = validate();
    if (validationErr) {
      setErr(validationErr);
      return;
    }
    setLoading(true);
    try {
      const r = await register(username.trim(), password);
      const data = r.data?.data;
      if (!data?.token || !data?.user) {
        throw new Error('服务器响应缺少 token/user');
      }
      await saveToken(data.token);
      setAuthToken(data.token);
      setUserInfo(data.user);
      setLoggedIn(true);
      if (data.user.role === 'admin') {
        setAdmin(true);
      }
      navigation.navigate('HomeTabs', { screen: 'Home' } as any);
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || e?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (pwd: string): { level: 0 | 1 | 2 | 3 | 4; label: string; color: string } => {
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
  };
  const pwdStrength = passwordStrength(password);
  const passwordMatch = confirm.length > 0 && password === confirm;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="sparkles" size={32} color="#fff" />
          </View>
          <Text style={styles.appName}>注册账号</Text>
          <Text style={styles.subtitle}>创建账号，开启 AI 创作之旅</Text>
        </View>

        {/* 表单 */}
        <View style={styles.formCard}>
          {/* 用户名 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>用户名 (2-50 字符)</Text>
            <View style={[
              styles.inputRow,
              focusedField === 'username' && styles.inputRowFocused,
            ]}>
              <Ionicons name="person-outline" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="请输入用户名"
                placeholderTextColor={colors.text.tertiary}
                value={username}
                onChangeText={setUsername}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={50}
                returnKeyType="next"
                editable={!loading}
              />
            </View>
          </View>

          {/* 密码 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>密码 (至少 6 位)</Text>
            <View style={[
              styles.inputRow,
              focusedField === 'password' && styles.inputRowFocused,
            ]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="请输入密码"
                placeholderTextColor={colors.text.tertiary}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.text.tertiary}
                />
              </TouchableOpacity>
            </View>
            {/* 强度条 */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3, 4].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      { backgroundColor: i <= pwdStrength.level ? pwdStrength.color : colors.border },
                    ]}
                  />
                ))}
                <Text style={[styles.strengthLabel, { color: pwdStrength.color }]}>
                  {pwdStrength.label}
                </Text>
              </View>
            )}
          </View>

          {/* 确认密码 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>确认密码</Text>
            <View style={[
              styles.inputRow,
              focusedField === 'confirm' && styles.inputRowFocused,
            ]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="再次输入密码"
                placeholderTextColor={colors.text.tertiary}
                value={confirm}
                onChangeText={setConfirm}
                onFocus={() => setFocusedField('confirm')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showPassword}
                returnKeyType="go"
                onSubmitEditing={handleRegister}
                editable={!loading}
              />
            </View>
            {confirm.length > 0 && (
              <Text style={[styles.matchHint, { color: passwordMatch ? colors.success : colors.error }]}>
                {passwordMatch ? '✓ 两次密码一致' : '✗ 两次密码不一致'}
              </Text>
            )}
          </View>

          {err ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errText}>{err}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>注 册</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>已有账号? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
            >
              <Text style={styles.footerLink}>立即登录</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.appVersion}>{APP_DISPLAY_NAME}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.md,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  appName: {
    ...typography.h1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  formCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xl,
    padding: spacing.lg,
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputRowFocused: { borderColor: colors.accent },
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
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footerText: {
    ...typography.body,
    color: colors.text.tertiary,
  },
  footerLink: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  appVersion: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
