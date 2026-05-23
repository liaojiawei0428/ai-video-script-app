import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useNovelStore, UserInfo } from '../store/useNovelStore';
import {
  login as apiLogin, register as apiRegister,
  getProfile, updateProfile as apiUpdateProfile,
  recharge as apiRecharge, getUsage,
  setAuthToken, getAuthToken,
} from '../api/client';
import { saveToken, getToken, deleteToken } from '../db/tokenStorage';


function AvatarPlaceholder({ name, size }: { name: string; size: number }) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD', '#F7DC6F', '#FF9F0A', '#34C759'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const bg = colors[Math.abs(hash) % colors.length];
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{name[0] || '?'}</Text>
    </View>
  );
}

export function HomeScreen(): React.JSX.Element {
  const store = useNovelStore();
  const { userInfo, isLoggedIn, setUserInfo, setLoggedIn, logout } = store;

  // 登录/注册表单
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // 个人信息编辑
  const [editing, setEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeUrl, setRechargeUrl] = useState('');

  // APP 启动时（首次进入"我的"页面）加载用户信息
  useEffect(() => {
    const store = useNovelStore.getState();
    if (!store.isLoggedIn) return;
    (async () => {
      try {
        const res = await getProfile();
        const user = res.data?.data?.user;
        if (user) {
          setUserInfo(user);
          setLoggedIn(true);
        }
      } catch (err: any) {
        // 只有 token 真的过期才清除，网络错误保留登录状态
        if (err?.response?.status === 401) {
          await deleteToken();
          setAuthToken(null);
          logout();
        }
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!formUsername.trim() || !formPassword.trim()) {
      Alert.alert('提示', '请输入用户名和密码');
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await apiLogin(formUsername.trim(), formPassword);
      const { user, token } = res.data?.data || {};
      if (user && token) {
        setAuthToken(token);
        await saveToken(token);
        setUserInfo(user);
        setLoggedIn(true);
        setFormUsername('');
        setFormPassword('');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '登录失败';
      Alert.alert('登录失败', msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!formUsername.trim() || !formPassword.trim()) {
      Alert.alert('提示', '请输入用户名和密码');
      return;
    }
    if (formPassword.length < 6) {
      Alert.alert('提示', '密码长度不能少于6位');
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await apiRegister(formUsername.trim(), formPassword, formEmail.trim() || undefined);
      const { user, token } = res.data?.data || {};
      if (user && token) {
        setAuthToken(token);
        await saveToken(token);
        setUserInfo(user);
        setLoggedIn(true);
        setFormUsername('');
        setFormPassword('');
        setFormEmail('');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '注册失败';
      Alert.alert('注册失败', msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('退出登录', '确定退出当前账号吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出', style: 'destructive',
        onPress: async () => {
          setAuthToken(null);
          await deleteToken();
          logout();
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    try {
      await apiUpdateProfile({ nickname: editNickname });
      const res = await getProfile();
      const user = res.data?.data?.user;
      if (user) setUserInfo(user);
      setEditing(false);
      Alert.alert('成功', '个人信息已更新');
    } catch {
      Alert.alert('失败', '更新失败，请重试');
    }
  };

  const handleRecharge = async () => {
    try {
      const res = await apiRecharge();
      const data = res.data?.data;
      if (data?.payUrl) {
        setRechargeUrl(data.payUrl);
        setShowRecharge(true);
      }
    } catch {
      Alert.alert('失败', '获取充值链接失败');
    }
  };

  // ====== 渲染：未登录态 ======
  if (!isLoggedIn) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loginContent}>
        <View style={styles.brandSection}>
          <Text style={styles.brandIcon}>🎬</Text>
          <Text style={styles.brandTitle}>AI 剧本工坊</Text>
          <Text style={styles.brandSub}>上传小说 · AI 自动分析 · 生成专业剧本</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{mode === 'login' ? '登录' : '注册'}</Text>

          <Text style={styles.inputLabel}>用户名</Text>
          <TextInput
            style={styles.input}
            value={formUsername}
            onChangeText={setFormUsername}
            placeholder="输入用户名"
            placeholderTextColor="#C7C7CC"
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>密码</Text>
          <TextInput
            style={styles.input}
            value={formPassword}
            onChangeText={setFormPassword}
            placeholder="输入密码"
            placeholderTextColor="#C7C7CC"
            secureTextEntry
          />

          {mode === 'register' && (
            <>
              <Text style={styles.inputLabel}>邮箱（选填）</Text>
              <TextInput
                style={styles.input}
                value={formEmail}
                onChangeText={setFormEmail}
                placeholder="example@email.com"
                placeholderTextColor="#C7C7CC"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, formSubmitting && styles.buttonDisabled]}
            onPress={mode === 'login' ? handleLogin : handleRegister}
            disabled={formSubmitting}
          >
            {formSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>{mode === 'login' ? '登 录' : '注 册'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
            <Text style={styles.switchText}>
              {mode === 'login' ? '还没有账号？立即注册' : '已有账号？去登录'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ====== 渲染：已登录态（个人信息页） ======
  const info = userInfo!;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.profileContent}>
      {/* 个人信息头部 */}
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={() => setEditing(true)}>
          {info.avatarUrl ? (
            <Image source={{ uri: info.avatarUrl }} style={styles.avatar} />
          ) : (
            <AvatarPlaceholder name={info.nickname || info.username} size={72} />
          )}
        </TouchableOpacity>
        <View style={styles.profileNameSection}>
          <Text style={styles.profileName}>{info.nickname || info.username}</Text>
          <Text style={styles.profileUsername}>@{info.username}</Text>
        </View>
        <TouchableOpacity style={styles.editButton} onPress={() => { setEditNickname(info.nickname); setEditing(true); }}>
          <Text style={styles.editButtonText}>编辑</Text>
        </TouchableOpacity>
      </View>

      {/* 余额卡片 */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>账户余额</Text>
        <Text style={styles.balanceAmount}>¥{info.balance.toFixed(2)}</Text>
        <TouchableOpacity style={styles.rechargeButton} onPress={handleRecharge}>
          <Text style={styles.rechargeButtonText}>充值</Text>
        </TouchableOpacity>
      </View>

      {/* 使用记录 */}
      <View style={styles.menuCard}>
        <View style={styles.menuItem}>
          <Text style={styles.menuIcon}>📊</Text>
          <Text style={styles.menuText}>累计生成次数</Text>
          <Text style={styles.menuValue}>{info.totalGenerations} 次</Text>
        </View>
      </View>

      {/* 设置列表 */}
      <View style={styles.menuCard}>
        <TouchableOpacity style={styles.menuItem} onPress={handleRecharge}>
          <Text style={styles.menuIcon}>💰</Text>
          <Text style={styles.menuText}>充值</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('提示', '缓存已清理')}>
          <Text style={styles.menuIcon}>🧹</Text>
          <Text style={styles.menuText}>清理缓存</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('意见反馈', '请发送邮件至 feedback@example.com')}>
          <Text style={styles.menuIcon}>💬</Text>
          <Text style={styles.menuText}>意见反馈</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('关于', 'AI 剧本工坊 v1.0.0\nAI 自动分析小说并生成专业剧本')}>
          <Text style={styles.menuIcon}>ℹ️</Text>
          <Text style={styles.menuText}>关于我们</Text>
          <Text style={styles.menuValue}>v1.0.0</Text>
        </TouchableOpacity>
      </View>

      {/* 退出登录 */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>退出登录</Text>
      </TouchableOpacity>

      {/* 充值弹窗 */}
      {showRecharge && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>充值</Text>
            <Text style={styles.modalBalance}>当前余额：¥{info.balance.toFixed(2)}</Text>
            <Text style={styles.modalHint}>请在浏览器中打开以下链接完成支付：</Text>
            <Text style={styles.modalUrl} selectable>{rechargeUrl}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowRecharge(false)}>
              <Text style={styles.modalButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 编辑昵称弹窗 */}
      {editing && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>编辑个人信息</Text>
            <Text style={styles.inputLabel}>昵称</Text>
            <TextInput
              style={styles.input}
              value={editNickname}
              onChangeText={setEditNickname}
              placeholder="输入新昵称"
              placeholderTextColor="#C7C7CC"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditing(false)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleSaveProfile}>
                <Text style={styles.modalButtonText}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  loginContent: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  brandSection: { alignItems: 'center', marginBottom: 32, marginTop: 40 },
  brandIcon: { fontSize: 56, marginBottom: 12 },
  brandTitle: { fontSize: 28, fontWeight: '800', color: '#1C1C1E', marginBottom: 8 },
  brandSub: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 },
  formCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  formTitle: { fontSize: 20, fontWeight: '700', color: '#1C1C1E', marginBottom: 20, textAlign: 'center' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#F8F8FA', padding: 14, borderRadius: 10, fontSize: 15,
    borderWidth: 1, borderColor: '#E8E8ED', color: '#1C1C1E',
  },
  primaryButton: {
    backgroundColor: '#007AFF', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 20,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 4 },
  buttonDisabled: { backgroundColor: '#A2C8FF' },
  switchText: { fontSize: 14, color: '#007AFF', textAlign: 'center', marginTop: 16 },

  profileContent: { padding: 16, paddingBottom: 40 },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  profileNameSection: { flex: 1, marginLeft: 16 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#1C1C1E' },
  profileUsername: { fontSize: 14, color: '#8E8E93', marginTop: 2 },
  editButton: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F2F2F7', borderRadius: 8 },
  editButtonText: { fontSize: 14, fontWeight: '600', color: '#007AFF' },

  balanceCard: {
    backgroundColor: '#007AFF', borderRadius: 16, padding: 20, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  balanceAmount: { flex: 1, color: '#fff', fontSize: 28, fontWeight: '800', marginLeft: 12 },
  rechargeButton: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  rechargeButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  menuCard: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuIcon: { fontSize: 20, marginRight: 12 },
  menuText: { flex: 1, fontSize: 15, color: '#1C1C1E' },
  menuValue: { fontSize: 14, color: '#8E8E93' },
  menuArrow: { fontSize: 20, color: '#C7C7CC' },
  menuDivider: { height: 1, backgroundColor: '#F2F2F7', marginLeft: 52 },

  logoutButton: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8,
    borderWidth: 1, borderColor: '#FF3B30',
  },
  logoutButtonText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },

  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24, marginHorizontal: 32, width: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginBottom: 12, textAlign: 'center' },
  modalBalance: { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 8 },
  modalHint: { fontSize: 13, color: '#8E8E93', marginBottom: 8 },
  modalUrl: { fontSize: 12, color: '#007AFF', marginBottom: 16, padding: 10, backgroundColor: '#F8F8FA', borderRadius: 8 },
  modalButton: {
    backgroundColor: '#007AFF', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8,
  },
  modalButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalActions: { flexDirection: 'row', marginTop: 16, gap: 12 },
  modalCancel: {
    flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#C7C7CC',
  },
  modalCancelText: { fontSize: 15, color: '#555' },
});
