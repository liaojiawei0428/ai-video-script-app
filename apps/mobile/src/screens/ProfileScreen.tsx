// apps/mobile/src/screens/ProfileScreen.tsx
// v3.0.0 (S58): 个人中心主页 - 跟 web ProfilePage.tsx 1:1 镜像
// 后端: GET /users/profile + PUT /users/profile (nickname + avatarUrl)
// 菜单项: 账单/收费标准/VIP 中心/修改密码/意见反馈/关于
// 头像策略 v3.0.0: 因没装 react-native-image-picker, 用 8 个 emoji 预设 + URL 输入 (后续 P2 可加 native picker)

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNovelStore } from '../store/useNovelStore';
import { getProfile, updateProfile, setAuthToken } from '../api/client';
import { deleteToken } from '../db/tokenStorage';
import { clearAllLocalData } from '../db/sqlite';
import { colors, spacing, radii, typography } from '../theme';
import { APP_DISPLAY_NAME } from '../config/version';
import type { RootStackParamList } from '../types/navigation';

interface MenuItem {
  icon: string;
  label: string;
  desc?: string;
  to: keyof RootStackParamList;
  danger?: boolean;
  vipOnly?: boolean;
}

// 8 个 emoji 预设头像 (因没装 image-picker, 简化版)
const PRESET_AVATARS = [
  { id: 'emoji-person', icon: 'person', label: '默认' },
  { id: 'emoji-happy', icon: 'happy', label: '笑脸' },
  { id: 'emoji-star', icon: 'star', label: '星星' },
  { id: 'emoji-heart', icon: 'heart', label: '爱心' },
  { id: 'emoji-rocket', icon: 'rocket', label: '火箭' },
  { id: 'emoji-sunny', icon: 'sunny', label: '太阳' },
  { id: 'emoji-flame', icon: 'flame', label: '火焰' },
  { id: 'emoji-diamond', icon: 'diamond', label: '钻石' },
];

function isPresetAvatar(s: string | undefined): boolean {
  if (!s) return false;
  return PRESET_AVATARS.some(a => a.id === s);
}

function renderAvatar(avatarUrl: string | undefined, nickname: string | undefined, size: number) {
  if (!avatarUrl) {
    const initial = (nickname || '?').charAt(0).toUpperCase();
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>{initial}</Text>
      </View>
    );
  }
  if (isPresetAvatar(avatarUrl)) {
    const av = PRESET_AVATARS.find(a => a.id === avatarUrl);
    const bg = PRESET_AVATAR_BG[av!.id] || colors.accent;
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={av!.icon} size={size * 0.5} color="#fff" />
      </View>
    );
  }
  // 远程 URL
  return (
    <Image
      source={{ uri: avatarUrl }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.bg.tertiary }}
    />
  );
}

// 8 个预设头像背景色
const PRESET_AVATAR_BG: Record<string, string> = {
  'emoji-person': '#2563EB',
  'emoji-happy': '#22C55E',
  'emoji-star': '#F97316',
  'emoji-heart': '#EF4444',
  'emoji-rocket': '#8B5CF6',
  'emoji-sunny': '#F59E0B',
  'emoji-flame': '#EF4444',
  'emoji-diamond': '#06B6D4',
};

export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userInfo = useNovelStore(s => s.userInfo);
  const setUserInfo = useNovelStore(s => s.setUserInfo);
  const logout = useNovelStore(s => s.logout);
  const clearNovels = useNovelStore(s => s.clearNovels);

  const [editMode, setEditMode] = useState(false);
  const [editNickname, setEditNickname] = useState(userInfo?.nickname || '');
  const [tempAvatarUrl, setTempAvatarUrl] = useState(userInfo?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUser = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await getProfile();
      const fresh = r.data?.data?.user || r.data?.data;
      if (fresh) setUserInfo(fresh);
    } catch {
      // 静默
    } finally {
      setRefreshing(false);
    }
  }, [setUserInfo]);

  useFocusEffect(
    useCallback(() => {
      if (!editMode) fetchUser();
    }, [editMode, fetchUser])
  );

  const isVip = (userInfo as any)?.vipLevel >= 1;
  const vipExpiresAt = (userInfo as any)?.vipExpiresAt as number | undefined;
  const balance = userInfo?.balance ?? 0;

  // 菜单 - 我的服务
  const serviceMenu: MenuItem[] = [
    { icon: 'receipt-outline', label: '账单明细', desc: '充值 / 消费记录', to: 'Billing' },
    { icon: 'pricetag-outline', label: '收费标准', desc: '透明计费公式', to: 'Pricing' },
    { icon: 'diamond-outline', label: 'VIP 中心', desc: '升级享优惠费率', to: 'VipCenter', vipOnly: false },
  ];

  // 菜单 - 账户与安全
  const accountMenu: MenuItem[] = [
    { icon: 'lock-closed-outline', label: '修改密码', desc: '定期更换更安全', to: 'Account' },
    { icon: 'chatbubble-ellipses-outline', label: '意见反馈', desc: '帮助我们改进', to: 'Feedback' },
    { icon: 'information-circle-outline', label: '关于我们', desc: '版本号 · 法律 · 备案', to: 'About' },
  ];

  const enterEditMode = () => {
    setEditMode(true);
    setEditNickname(userInfo?.nickname || '');
    setTempAvatarUrl(userInfo?.avatarUrl || '');
    setErr('');
    setSuccess('');
  };

  const handleCancel = async () => {
    setEditMode(false);
    setErr('');
    setSuccess('');
    setEditNickname(userInfo?.nickname || '');
    setTempAvatarUrl(userInfo?.avatarUrl || '');
    // 从 server 拉一次最新 user 还原
    try {
      const r = await getProfile();
      const fresh = r.data?.data?.user || r.data?.data;
      if (fresh) setUserInfo(fresh);
    } catch {}
  };

  const handleSave = async () => {
    setErr('');
    setSuccess('');
    setSaving(true);
    try {
      await updateProfile({
        nickname: editNickname.trim() || userInfo?.nickname,
        avatarUrl: tempAvatarUrl,
      });
      setSuccess('✓ 保存成功');
      setEditMode(false);
      // 拉最新 user
      const r = await getProfile();
      const fresh = r.data?.data?.user || r.data?.data;
      if (fresh) setUserInfo(fresh);
      setTimeout(() => setSuccess(''), 2000);
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPreset = (avatarId: string) => {
    setTempAvatarUrl(avatarId);
    setShowAvatarPicker(false);
  };

  const handleSaveUrl = () => {
    if (avatarUrlInput.trim()) {
      setTempAvatarUrl(avatarUrlInput.trim());
    } else {
      setTempAvatarUrl('');
    }
    setShowUrlInput(false);
    setAvatarUrlInput('');
  };

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出登录吗?', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          await deleteToken();
          setAuthToken(null);
          clearNovels();
          logout();
          clearAllLocalData().catch(() => {});
          navigation.reset({ index: 0, routes: [{ name: 'Login' as any }] });
        },
      },
    ]);
  };

  const renderMenuItem = (item: MenuItem) => (
    <TouchableOpacity
      key={item.to + '-' + item.label}
      style={styles.menuItem}
      onPress={() => navigation.navigate(item.to as any)}
      activeOpacity={0.6}
    >
      <View style={styles.menuIconBox}>
        <Ionicons name={item.icon as any} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{item.label}</Text>
        {item.desc && <Text style={styles.menuDesc}>{item.desc}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* 头部 - 头像 + 昵称 + 编辑按钮 */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            {/* 头像 */}
            <View>
              <View style={[
                styles.avatarBox,
                isVip && { borderColor: colors.warning, borderWidth: 2 },
                editMode && { borderColor: colors.accent },
              ]}>
                {renderAvatar(editMode ? tempAvatarUrl : userInfo?.avatarUrl, userInfo?.nickname, 72)}
                {editMode && (
                  <TouchableOpacity
                    style={styles.avatarOverlay}
                    onPress={() => setShowAvatarPicker(true)}
                  >
                    <Ionicons name="camera" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              {isVip && (
                <View style={styles.vipBadge}>
                  <Ionicons name="diamond" size={12} color="#fff" />
                </View>
              )}
            </View>

            {/* 昵称 + 用户名 */}
            <View style={styles.headerInfo}>
              {editMode ? (
                <TextInput
                  style={styles.nicknameInput}
                  value={editNickname}
                  onChangeText={setEditNickname}
                  placeholder="设置昵称"
                  placeholderTextColor={colors.text.tertiary}
                  maxLength={20}
                />
              ) : (
                <Text style={styles.nickname} numberOfLines={1}>
                  {userInfo?.nickname || userInfo?.username || '未设置昵称'}
                </Text>
              )}
              <Text style={styles.username} numberOfLines={1}>
                @{userInfo?.username || userInfo?.email || ''}
              </Text>
              {isVip && vipExpiresAt && (
                <Text style={styles.vipExpiry}>
                  <Ionicons name="diamond" size={11} color={colors.warning} /> VIP 到期: {new Date(vipExpiresAt).toLocaleDateString('zh-CN')}
                </Text>
              )}
            </View>

            {/* 编辑按钮 */}
            <View style={styles.editActions}>
              {editMode ? (
                <>
                  <TouchableOpacity
                    style={[styles.editBtn, styles.editBtnPrimary, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="save-outline" size={14} color="#fff" />
                        <Text style={styles.editBtnPrimaryText}>保存</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editBtn, styles.editBtnGhost]}
                    onPress={handleCancel}
                    disabled={saving}
                  >
                    <Ionicons name="close" size={14} color={colors.text.secondary} />
                    <Text style={styles.editBtnGhostText}>取消</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.editBtn, styles.editBtnGhost]}
                    onPress={enterEditMode}
                  >
                    <Ionicons name="create-outline" size={14} color={colors.text.primary} />
                    <Text style={styles.editBtnGhostText}>编辑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editBtn, styles.editBtnGhost, { paddingHorizontal: spacing.sm }]}
                    onPress={() => navigation.navigate('Notifications')}
                  >
                    <Ionicons name="notifications-outline" size={14} color={colors.text.primary} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* 错误/成功提示 */}
          {err ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={14} color={colors.error} />
              <Text style={styles.errText}>{err}</Text>
            </View>
          ) : null}
          {success ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}
        </View>

        {/* 余额卡 */}
        <TouchableOpacity
          style={styles.balanceCard}
          onPress={() => navigation.navigate('Recharge', { amount: 30 })}
          activeOpacity={0.7}
        >
          <View>
            <Text style={styles.balanceLabel}>
              <Ionicons name="wallet-outline" size={12} /> 账户余额
            </Text>
            <Text style={styles.balanceAmount}>
              ¥<Text style={styles.balanceHighlight}>{balance.toFixed(2)}</Text>
            </Text>
            {isVip ? (
              <Text style={styles.balanceVip}>VIP 享优惠费率</Text>
            ) : (
              <Text style={styles.balanceNormal}>
                开通 VIP 立享 <Text style={styles.balanceVipHighlight}>¥10/年</Text> 优惠
              </Text>
            )}
          </View>
          <View style={styles.balanceAction}>
            <Text style={styles.balanceActionText}>
              {isVip ? '续费 VIP' : '充值'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.accent} />
          </View>
        </TouchableOpacity>

        {/* 我的服务 */}
        <Text style={styles.sectionTitle}>我的服务</Text>
        <View style={styles.menuBlock}>
          {serviceMenu.map(item => (
            <View key={item.to + '-' + item.label}>
              {renderMenuItem(item)}
            </View>
          ))}
        </View>

        {/* 账户与安全 */}
        <Text style={styles.sectionTitle}>账户与安全</Text>
        <View style={styles.menuBlock}>
          {accountMenu.map((item, i) => (
            <View key={item.to + '-' + item.label}>
              {renderMenuItem(item)}
              {i < accountMenu.length - 1 && <View style={styles.menuDivider} />}
            </View>
          ))}
        </View>

        {/* 退出登录 */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.6}
        >
          <Ionicons name="log-out-outline" size={16} color={colors.error} />
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>{APP_DISPLAY_NAME}</Text>
      </ScrollView>

      {/* 头像选择弹窗 */}
      <Modal
        visible={showAvatarPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAvatarPicker(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>选择头像</Text>
            <View style={styles.avatarGrid}>
              {PRESET_AVATARS.map(av => (
                <TouchableOpacity
                  key={av.id}
                  style={[
                    styles.avatarOption,
                    tempAvatarUrl === av.id && styles.avatarOptionSelected,
                  ]}
                  onPress={() => handleSelectPreset(av.id)}
                >
                  <View style={[styles.avatarOptionInner, { backgroundColor: PRESET_AVATAR_BG[av.id] }]}>
                    <Ionicons name={av.icon as any} size={28} color="#fff" />
                  </View>
                  <Text style={styles.avatarOptionLabel}>{av.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.bg.tertiary }]}
                onPress={() => { setTempAvatarUrl(''); setShowAvatarPicker(false); }}
              >
                <Text style={{ color: colors.text.primary, fontWeight: '600' }}>使用默认</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                onPress={() => { setShowAvatarPicker(false); setShowUrlInput(true); }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>URL 输入</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* URL 输入弹窗 */}
      <Modal
        visible={showUrlInput}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUrlInput(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowUrlInput(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>头像 URL</Text>
            <TextInput
              style={styles.urlInput}
              placeholder="https://example.com/avatar.jpg"
              placeholderTextColor={colors.text.tertiary}
              value={avatarUrlInput}
              onChangeText={setAvatarUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.bg.tertiary }]}
                onPress={() => setShowUrlInput(false)}
              >
                <Text style={{ color: colors.text.primary, fontWeight: '600' }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                onPress={handleSaveUrl}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  // 头部
  headerCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarPlaceholder: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: '700',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg.secondary,
  },
  headerInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  nickname: {
    ...typography.h3,
    color: colors.text.primary,
    fontSize: 18,
  },
  nicknameInput: {
    ...typography.h3,
    color: colors.text.primary,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  username: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  vipExpiry: {
    fontSize: 11,
    color: colors.warning,
    marginTop: 4,
    fontWeight: '600',
  },
  editActions: {
    gap: spacing.xs,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    gap: 3,
  },
  editBtnPrimary: {
    backgroundColor: colors.accent,
  },
  editBtnPrimaryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  editBtnGhost: {
    backgroundColor: colors.bg.tertiary,
  },
  editBtnGhostText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  errText: {
    color: colors.error,
    fontSize: 12,
    marginLeft: spacing.xs,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  successText: {
    color: colors.success,
    fontSize: 12,
    marginLeft: spacing.xs,
    flex: 1,
  },

  // 余额卡
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning + '40',
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: 4,
  },
  balanceHighlight: {
    color: colors.warning,
  },
  balanceVip: {
    fontSize: 11,
    color: colors.warning,
    marginTop: 4,
  },
  balanceNormal: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  balanceVipHighlight: {
    color: colors.warning,
    fontWeight: '600',
  },
  balanceAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    gap: 2,
  },
  balanceActionText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },

  // 菜单
  sectionTitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    paddingLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuBlock: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  menuLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  menuDesc: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 36 + spacing.sm,
  },

  // 退出
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.error + '40',
    gap: spacing.xs,
  },
  logoutText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '600',
  },
  versionText: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // 头像选择弹窗
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  avatarOption: {
    width: '23%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarOptionSelected: {
    transform: [{ scale: 1.05 }],
  },
  avatarOptionInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  urlInput: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md,
    color: colors.text.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
});
