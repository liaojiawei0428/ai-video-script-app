// apps/mobile/src/screens/AdminLoginScreen.tsx
// v3.0.0 (S58): 管理员登录页 - 跟 web AdminLoginPage.tsx 1:1 镜像
// 后端: POST /api/admin/login -> {token, user}
// 流程: 输入管理员账号+密码 -> adminLogin -> saveToken -> setUserInfo -> setAdmin(true) -> setLoggedIn -> 跳 AdminDashboard

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNovelStore } from '../store/useNovelStore';
import { adminLogin, setAuthToken } from '../api/client';
import { saveToken } from '../db/tokenStorage';
import { colors, spacing, radii, typography } from '../theme';
import { APP_DISPLAY_NAME } from '../config/version';
import type { RootStackParamList } from '../types/navigation';

export function AdminLoginScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isAdmin = useNovelStore(s => s.isAdmin);
  const setUserInfo = useNovelStore(s => s.setUserInfo);
  const setLoggedIn = useNovelStore(s => s.setLoggedIn);
  const setAdmin = useNovelStore(s => s.setAdmin);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // 已登录且是 admin 自动跳到 AdminDashboard
  useEffect(() => {
    if (isAdmin) {
      navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' as any }] });
    }
  }, [isAdmin]);

  const handleLogin = async () => {
    if (!username || !password) {
      setErr('请输入管理员账号和密码');
      return;
    }
    setErr('');
    setLoading(true);
    try {
      const r = await adminLogin(username.trim(), password);
      const data = r.data?.data;
      if (!data?.token || !data?.user) {
        throw new Error('服务器响应缺少 token/user');
      }
      if (data.user.role !== 'admin') {
        setErr('登录失败：非管理员账号');
        return;
      }
      await saveToken(data.token);
      setAuthToken(data.token);
      setUserInfo(data.user);
      setLoggedIn(true);
      setAdmin(true);
      // admin 跳到 AdminDashboard - 用 reset 强制切走
      navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' as any }] });
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || e?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

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
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Ionicons name="shield-checkmark" size={24} color="#fff" />
          </View>
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={styles.title}>管理员登录</Text>
            <Text style={styles.subtitle}>Deep剧本 · 后台管理系统</Text>
          </View>
        </View>

        {/* 错误提示 */}
        {err ? (
          <View style={styles.errBox}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errText}>{err}</Text>
          </View>
        ) : null}

        {/* 表单 */}
        <View style={styles.formCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>管理员账号</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="管理员账号"
                placeholderTextColor={colors.text.tertiary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="next"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>密码</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="密码"
                placeholderTextColor={colors.text.tertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
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
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={16} color="#fff" />
                <Text style={styles.submitText}>{loading ? '登录中…' : '登录后台'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 提示 */}
        <View style={styles.tipBox}>
          <Ionicons name="information-circle-outline" size={14} color={colors.text.tertiary} />
          <Text style={styles.tipText}>仅供管理员使用，普通用户请返回登录普通账号</Text>
        </View>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('Login')}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={16} color={colors.accent} />
          <Text style={styles.backText}>返回用户登录</Text>
        </TouchableOpacity>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
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
  },
  inputIcon: { marginRight: spacing.xs },
  input: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 15,
    paddingVertical: spacing.sm + 2,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  tipText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  backText: {
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
