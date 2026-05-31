import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Image, FlatList,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNovelStore, UserInfo } from '../store/useNovelStore';
import {
  login as apiLogin, register as apiRegister,
  getProfile, updateProfile as apiUpdateProfile,
  setAuthToken, getAuthToken, buyVip, getUnreadCount, getUserHistory,
} from '../api/client';
import { saveToken, getToken, deleteToken } from '../db/tokenStorage';
import { colors, spacing, radii, typography } from '../theme';
import { APP_VERSION } from '../config/version';


function AvatarPlaceholder({ name, size }: { name: string; size: number }) {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD', '#F7DC6F', '#F97316', '#22C55E'];
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
  const navigation = useNavigation<any>();
  const store = useNovelStore();
  const { userInfo, isLoggedIn, setUserInfo, setLoggedIn, setAdmin, logout } = store;

  // 登录/注册表单
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // 个人信息编辑
  const [editing, setEditing] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const r = await getUserHistory();
      setHistoryData(r.data?.data?.list || []);
    } catch {} finally {
      setHistoryLoading(false);
    }
  };

  // 获取未读消息数
  const loadUnreadCount = async () => {
    if (!isLoggedIn) return;
    try {
      const r = await getUnreadCount();
      setUnreadCount(r.data?.data?.unreadCount || 0);
    } catch {}
  };

  useFocusEffect(useCallback(() => { loadUnreadCount(); }, [isLoggedIn]));

  // APP 启动时（首次进入"我的"页面）加载用户信息
  useEffect(() => {
    const store = useNovelStore.getState();
    if (!store.isLoggedIn) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        const res = await getProfile();
        const user = res.data?.data?.user;
        if (user) {
          setUserInfo(user);
        } else {
          // API返回异常，清除登录状态
          setLoggedIn(false);
        }
      } catch (err: any) {
        // API调用失败（401过期/网络错误），清除登录状态
        if (err?.response?.status === 401) {
          setAuthToken(null);
          await deleteToken();
          setLoggedIn(false);
        }
      }
    })();
    // 10秒超时保护：如果一直加载不出来，清除登录状态回到登录页
    timeoutId = setTimeout(() => {
      if (!useNovelStore.getState().userInfo && useNovelStore.getState().isLoggedIn) {
        setLoggedIn(false);
      }
    }, 10000);
    return () => clearTimeout(timeoutId);
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
        if (user.role === 'admin') setAdmin(true);
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

  const handleBuyVip = async () => {
    Alert.alert('开通VIP', '¥10 尊享1年VIP会员\n享受 ¥0.01/千字和 ¥0.04/集分镜优惠费率', [
      { text: '取消', style: 'cancel' },
      {
        text: '立即开通',
        onPress: async () => {
          try {
            const res = await buyVip();
            if (res.data?.success) {
              const d = res.data.data;
              setUserInfo({ ...info, balance: d.balance, vipLevel: 1, vipExpiresAt: d.vipExpiresAt });
              Alert.alert('开通成功', 'VIP会员已激活（有效期1年）！');
            } else {
              Alert.alert('开通失败', res.data?.error?.message || '请确保余额充足');
            }
          } catch (e: any) {
            Alert.alert('错误', e?.response?.data?.error?.message || '操作失败');
          }
        },
      },
    ]);
  };

  // ====== 渲染：未登录态 ======
  if (!isLoggedIn) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.loginContent}>
        <View style={styles.brandSection}>
          <Ionicons name="film" size={56} color={colors.primary} style={styles.brandIcon} />
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
  if (!userInfo) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 60 }} />
        <Text style={{ color: colors.text.tertiary, textAlign: 'center', marginTop: 16 }}>加载个人信息中...</Text>
        <TouchableOpacity
          style={{ marginTop: 20, padding: 10 }}
          onPress={() => { setAuthToken(null); deleteToken(); setLoggedIn(false); }}
        >
          <Text style={{ color: colors.text.tertiary, textAlign: 'center', fontSize: 13 }}>加载太慢？点击重新登录</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const info = userInfo;

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
        <TouchableOpacity style={styles.notifButton} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications" size={24} color={colors.text.primary} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.editButton} onPress={() => { setEditNickname(info.nickname); setEditing(true); }}>
          <Text style={styles.editButtonText}>编辑</Text>
        </TouchableOpacity>
      </View>

      {/* 余额卡片 */}
      <TouchableOpacity style={styles.balanceCard} onPress={() => navigation.navigate('Billing')}>
        <Text style={styles.balanceLabel}>账户余额</Text>
        <Text style={styles.balanceAmount}>¥{info.balance.toFixed(2)}</Text>
        <View style={styles.rechargeButton}>
          <Text style={styles.rechargeButtonText}>充值</Text>
        </View>
      </TouchableOpacity>

      {info.vipLevel >= 1 ? (
        <View style={styles.vipCard}>
          <Ionicons name="diamond" size={28} color={colors.gold} style={styles.vipIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.vipTitle}>VIP 会员</Text>
            <Text style={styles.vipSub}>
              ¥0.01/千字 · ¥0.04/集分镜
              {info.vipExpiresAt ? `\n到期时间：${new Date(info.vipExpiresAt).toLocaleDateString('zh-CN')}` : ''}
            </Text>
          </View>
          <Text style={styles.vipBadge}>已激活</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.vipCard} onPress={handleBuyVip}>
          <Ionicons name="diamond-outline" size={28} color={colors.gold} style={styles.vipIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.vipTitle}>开通 VIP 会员</Text>
            <Text style={styles.vipSub}>¥10/年 · 享 7.5 折优惠</Text>
          </View>
          <Text style={styles.vipBuyBtn}>开通 ›</Text>
        </TouchableOpacity>
      )}

      {/* 使用记录 */}
      <View style={styles.menuCard}>
        <TouchableOpacity style={styles.menuItem} onPress={loadHistory}>
          <Ionicons name="bar-chart" size={20} color={colors.primary} style={styles.menuIcon} />
          <Text style={styles.menuText}>累计生成次数</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.menuValue}>{info.totalGenerations} 次</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} style={{ marginLeft: 4 }} />
          </View>
        </TouchableOpacity>
      </View>

      {/* 设置列表 */}
      <View style={styles.menuCard}>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Billing')}>
          <Ionicons name="wallet" size={20} color={colors.primary} style={styles.menuIcon} />
          <Text style={styles.menuText}>充值 / 交易记录</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Pricing')}>
          <Ionicons name="pricetag" size={20} color={colors.primary} style={styles.menuIcon} />
          <Text style={styles.menuText}>收费标准</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-sharp" size={20} color={colors.primary} style={styles.menuIcon} />
          <Text style={styles.menuText}>设置</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Feedback')}>
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} style={styles.menuIcon} />
          <Text style={styles.menuText}>意见反馈</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </TouchableOpacity>
        <View style={styles.menuDivider} />
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('About')}>
          <Ionicons name="information-circle" size={20} color={colors.primary} style={styles.menuIcon} />
          <Text style={styles.menuText}>关于我们</Text>
          <Text style={styles.menuValue}>v{APP_VERSION}</Text>
        </TouchableOpacity>
      </View>

      {/* 退出登录 */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={18} color={colors.error} />
        <Text style={styles.logoutButtonText}>退出登录</Text>
      </TouchableOpacity>

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

      {/* 历史记录modal */}
      {showHistory && (
        <View style={styles.histOverlay}>
          <View style={styles.histModal}>
            <View style={styles.histHeader}>
              <Text style={styles.histTitle}>生成历史记录</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            {historyLoading ? (
              <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: 40 }} />
            ) : historyData.length === 0 ? (
              <Text style={styles.histEmpty}>暂无生成记录</Text>
            ) : (
              <FlatList
                data={historyData}
                keyExtractor={item => item.id}
                style={{ maxHeight: 400 }}
                renderItem={({ item }) => (
                  <View style={styles.histItem}>
                    <View style={styles.histItemHeader}>
                      <Text style={styles.histItemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.histItemCost}>¥{item.totalCost.toFixed(2)}</Text>
                    </View>
                    <View style={styles.histItemMeta}>
                      <Ionicons name="film" size={14} color={colors.text.tertiary} />
                      <Text style={styles.histMetaText}> {item.episodeCount}集</Text>
                      <Ionicons name="time" size={14} color={colors.text.tertiary} style={{ marginLeft: 12 }} />
                      <Text style={styles.histMetaText}> {formatDuration(item.timeSpent)}</Text>
                      <Ionicons name="calendar" size={14} color={colors.text.tertiary} style={{ marginLeft: 12 }} />
                      <Text style={styles.histMetaText}> {formatDate(item.createdAt)}</Text>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '--';
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}时${m}分`;
}

function formatDate(ts: number): string {
  if (!ts) return '--';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  loginContent: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  brandSection: { alignItems: 'center', marginBottom: 32, marginTop: 40 },
  brandIcon: { fontSize: 56, marginBottom: 12 },
  brandTitle: { fontSize: 28, fontWeight: '800', color: colors.text.primary, marginBottom: 8 },
  brandSub: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', lineHeight: 20 },
  formCard: {
    backgroundColor: colors.bg.secondary, borderRadius: radii.lg, padding: 20,
  },
  formTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 20, textAlign: 'center' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: colors.text.secondary, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: colors.bg.tertiary, padding: 14, borderRadius: radii.md, fontSize: 15,
    borderWidth: 1, borderColor: colors.border, color: colors.text.primary,
  },
  primaryButton: {
    backgroundColor: colors.primary, borderRadius: radii.md, padding: 14, alignItems: 'center', marginTop: 20,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 4 },
  buttonDisabled: { backgroundColor: colors.primaryLight },
  switchText: { fontSize: 14, color: colors.primary, textAlign: 'center', marginTop: 16 },

  profileContent: { padding: 16, paddingBottom: 40 },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg, padding: 20, marginBottom: 16,
  },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  profileNameSection: { flex: 1, marginLeft: 16 },
  profileName: { fontSize: 20, fontWeight: '700', color: colors.text.primary },
  profileUsername: { fontSize: 14, color: colors.text.secondary, marginTop: 2 },
  editButton: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.bg.tertiary, borderRadius: 8 },
  editButtonText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  notifButton: { position: 'relative', padding: 8, marginRight: 8 },
  notifIcon: { fontSize: 24 },
  notifBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  notifBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  balanceCard: {
    backgroundColor: colors.primary, borderRadius: radii.lg, padding: 20, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  balanceAmount: { flex: 1, color: '#fff', fontSize: 28, fontWeight: '800', marginLeft: 12 },
  rechargeButton: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  rechargeButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  vipCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gold + '15', borderRadius: radii.lg, padding: spacing.md, marginHorizontal: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.gold + '40' },
  vipIcon: { fontSize: 28, marginRight: spacing.sm },
  vipTitle: { ...typography.h3, color: colors.gold },
  vipSub: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
  vipBadge: { ...typography.caption, color: colors.success, fontWeight: '700', backgroundColor: colors.success + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  vipBuyBtn: { ...typography.caption, color: colors.gold, fontWeight: '700' },

  menuCard: {
    backgroundColor: colors.bg.secondary, borderRadius: radii.lg, marginBottom: spacing.md, overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  menuIcon: { marginRight: spacing.md },
  menuText: { flex: 1, fontSize: 15, color: colors.text.primary },
  menuValue: { fontSize: 14, color: colors.text.secondary },
  menuArrow: { fontSize: 20, color: colors.text.tertiary },
  menuDivider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },

  logoutButton: {
    backgroundColor: colors.bg.secondary, borderRadius: radii.lg, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    marginTop: spacing.sm, borderWidth: 1, borderColor: colors.error + '40',
  },
  logoutButtonText: { color: colors.error, fontSize: 16, fontWeight: '600' },

  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.bg.secondary, borderRadius: radii.lg, padding: 24, marginHorizontal: 32, width: '85%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary, marginBottom: 12, textAlign: 'center' },
  modalButton: {
    backgroundColor: colors.primary, borderRadius: radii.md, padding: 12, alignItems: 'center', marginTop: 8,
  },
  modalButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalActions: { flexDirection: 'row', marginTop: 16, gap: 12 },
  modalCancel: {
    flex: 1, borderRadius: radii.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  modalCancelText: { fontSize: 15, color: colors.text.secondary },
  histOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  histModal: {
    backgroundColor: colors.bg.secondary, borderRadius: radii.lg, padding: spacing.lg,
    width: '90%', maxHeight: '70%',
  },
  histHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md,
  },
  histTitle: { ...typography.h2, color: colors.text.primary },
  histEmpty: { ...typography.body, color: colors.text.tertiary, textAlign: 'center', paddingVertical: 40 },
  histItem: {
    backgroundColor: colors.bg.tertiary, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  histItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  histItemTitle: { ...typography.h3, color: colors.text.primary, flex: 1 },
  histItemCost: { ...typography.h3, color: colors.accentOrange, fontWeight: '700' },
  histItemMeta: { flexDirection: 'row', alignItems: 'center' },
  histMetaText: { ...typography.caption, color: colors.text.tertiary },
});
