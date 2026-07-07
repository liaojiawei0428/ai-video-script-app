// apps/mobile/src/screens/LoginScreen.tsx
// v3.0.0 (S58): 登录页 - 跟 web LoginPage.tsx 1:1 镜像
// 后端: POST /api/users/login -> {token, user}
// 流程: 输入用户名+密码 -> 调 login -> saveToken -> setUserInfo -> setLoggedIn -> 跳 HomeTabs

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, ScrollView, Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNovelStore } from '../store/useNovelStore';
import { login, getProfile, setAuthToken } from '../api/client';
import { saveToken } from '../db/tokenStorage';
import { colors, spacing, radii, typography } from '../theme';
import { APP_DISPLAY_NAME } from '../config/version';
import type { RootStackParamList } from '../types/navigation';

export function LoginScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const isLoggedIn = useNovelStore(s => s.isLoggedIn);
  const setUserInfo = useNovelStore(s => s.setUserInfo);
  const setLoggedIn = useNovelStore(s => s.setLoggedIn);
  const setAdmin = useNovelStore(s => s.setAdmin);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);

  // 已登录自动返回
  useEffect(() => {
    if (isLoggedIn) {
      const redirect = (route.params as any)?.redirect;
      if (redirect) {
        navigation.navigate(redirect as any);
      } else {
        navigation.navigate('HomeTabs', { screen: 'Home' } as any);
      }
    }
  }, [isLoggedIn]);

  const handleLogin = async () => {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    if (!trimmedUsername || !trimmedPassword) {
      setErr('用户名和密码不能为空');
      return;
    }
    setErr('');
    setLoading(true);
    try {
      const r = await login(trimmedUsername, trimmedPassword);
      const data = r.data?.data;
      if (!data?.token || !data?.user) {
        throw new Error('服务器响应缺少 token/user');
      }
      // 1. 存 token 到本地
      await saveToken(data.token);
      setAuthToken(data.token);
      // 2. 写 store
      setUserInfo(data.user);
      setLoggedIn(true);
      if (data.user.role === 'admin') {
        setAdmin(true);
      }
      // 3. 跳目标页
      const redirect = (route.params as any)?.redirect;
      if (redirect) {
        navigation.navigate(redirect as any);
      } else {
        navigation.navigate('HomeTabs', { screen: 'Home' } as any);
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || '登录失败';
      setErr(msg);
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
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="sparkles" size={32} color="#fff" />
          </View>
          <Text style={styles.appName}>Deep剧本</Text>
          {/* v3.0.103 BUG-180: 登录页乱码修法 — 解锁替代开启 (GB2312 一级字, 100% 国产 ROM 兼容) */}
          <Text style={styles.subtitle}>登录解锁 AI 视频剧本创作</Text>
        </View>

        {/* 表单 */}
        <View style={styles.formCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>用户名</Text>
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
                returnKeyType="next"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>密码</Text>
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

          {err ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errText}>{err}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>登 录</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            {/* v3.0.103 BUG-180: 乱码修法 — '账'(U+8D26) 是 GB2312 二级字, 换成 '注册'(一级字) */}
            <Text style={styles.footerText}>还未注册账号? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              disabled={loading}
            >
              <Text style={styles.footerLink}>立即注册</Text>
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
  fieldGroup: {
    marginBottom: spacing.md,
  },
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
  inputRowFocused: {
    borderColor: colors.accent,
  },
  inputIcon: {
    marginRight: spacing.xs,
  },
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
