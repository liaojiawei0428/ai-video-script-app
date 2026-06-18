import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Alert, TextInput, Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { adminDashboard, adminOrders, adminApprove, adminReject, sendAnnouncement, adminUsers, adminUsersDetail, adminSendUserMsg, adminFeedbacks, adminReadFeedback, adminReplyFeedback } from '../api/client';
import { useNovelStore } from '../store/useNovelStore';
import { deleteToken } from '../db/tokenStorage';
import { clearAllLocalData } from '../db/sqlite';
import { setAuthToken } from '../api/client';
import { colors, spacing, radii, typography } from '../theme';

export function AdminDashboard(): React.JSX.Element {
  const [tab, setTab] = useState<'dashboard' | 'orders' | 'feedback' | 'users'>('dashboard');
  const [data, setData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderStatus, setOrderStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const { logout, setAdmin, clearNovels } = useNovelStore();

  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annSending, setAnnSending] = useState(false);

  // 用户管理
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userMsgModal, setUserMsgModal] = useState(false);
  const [msgTargetUser, setMsgTargetUser] = useState<any>(null);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgContent, setMsgContent] = useState('');
  const [msgSending, setMsgSending] = useState(false);

  const handleLogout = async () => {
    await deleteToken();
    setAuthToken(null);
    clearNovels();
    setAdmin(false);
    logout();
    clearAllLocalData().catch(() => {});
  };

  const handleSendAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim()) {
      Alert.alert('提示', '请输入标题和内容');
      return;
    }
    setAnnSending(true);
    try {
      const r = await sendAnnouncement(annTitle.trim(), annContent.trim());
      Alert.alert('成功', r.data?.data?.message || '公告已发送');
      setShowAnnouncement(false);
      setAnnTitle('');
      setAnnContent('');
    } catch (e: any) {
      Alert.alert('失败', e?.response?.data?.error?.message || '发送失败');
    } finally {
      setAnnSending(false);
    }
  };

  useEffect(() => {
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'orders') loadOrders('pending');
    if (tab === 'users') loadUsers();
  }, [tab]);

  const loadDashboard = async () => {
    setLoading(true);
    try { const r = await adminDashboard(); setData(r.data?.data); } catch {} finally { setLoading(false); }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try { const r = await adminUsersDetail(); setUsers(r.data?.data?.users || []); } catch {} finally { setUsersLoading(false); }
  };

  const handleSendUserMsg = async () => {
    if (!msgTitle.trim() || !msgContent.trim()) { Alert.alert('提示', '请填写标题和内容'); return; }
    setMsgSending(true);
    try {
      await adminSendUserMsg(msgTargetUser.id, msgTitle.trim(), msgContent.trim());
      Alert.alert('成功', `已发送消息给 ${msgTargetUser?.nickname || msgTargetUser?.username}`);
      setUserMsgModal(false); setMsgTitle(''); setMsgContent(''); setMsgTargetUser(null);
    } catch (e: any) { Alert.alert('失败', e?.response?.data?.error?.message || '发送失败'); }
    finally { setMsgSending(false); }
  };

  const loadOrders = async (status: string) => {
    setLoading(true);
    setOrderStatus(status);
    try { const r = await adminOrders(status); setOrders(r.data?.data?.orders || []); } catch {} finally { setLoading(false); }
  };

  const handleApprove = (id: string) => {
    Alert.alert('确认到账', '确定此充值申请已收到款项？', [
      { text: '取消' },
      { text: '确认到账', onPress: async () => {
        try { await adminApprove(id); loadOrders(orderStatus); } catch (e: any) { Alert.alert('错误', e?.response?.data?.error?.message || '操作失败'); }
      }},
    ]);
  };

  const handleReject = (id: string) => {
    if (Platform.OS === 'ios') {
      Alert.prompt('拒绝原因', '输入拒绝理由', async (remark: string) => {
        try { await adminReject(id, remark); loadOrders(orderStatus); } catch (e: any) { Alert.alert('错误', e?.message || '操作失败'); }
      });
    } else {
      Alert.alert('拒绝', '确定拒绝此申请？', [
        { text: '取消' },
        { text: '拒绝', style: 'destructive', onPress: async () => {
          try { await adminReject(id, '管理员拒绝'); loadOrders(orderStatus); } catch (e: any) { Alert.alert('错误', e?.message || '操作失败'); }
        }},
      ]);
    }
  };

  if (loading && !data) {
    return <View style={styles.centered}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>管理后台</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutBtn}>退出</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.tabs}>
        {([['dashboard', 'stats-chart', '仪表盘'], ['orders', 'receipt', '订单'], ['feedback', 'chatbubble-ellipses', '反馈'], ['users', 'people', '用户']] as const).map(([t, icon, label]) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Ionicons name={icon} size={18} color={tab === t ? colors.primary : colors.text.tertiary} />
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}> {label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'dashboard' && data && (
        <View style={styles.dashboard}>
          <StatCard icon="people" label="总用户" value={data.totalUsers} />
          <StatCard icon="person-add" label="今日注册" value={data.todayUsers} />
          <StatCard icon="time" label="待审核" value={data.pendingOrders} />
          <StatCard icon="calendar" label="今日申请" value={data.todayOrders} />
          <TouchableOpacity style={styles.announcementBtn} onPress={() => setShowAnnouncement(true)}>
            <Ionicons name="megaphone" size={20} color={colors.warning} />
            <Text style={styles.announcementText}>发送公告</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 公告弹窗 */}
      {showAnnouncement && (
        <View style={styles.annOverlay}>
          <View style={styles.annModal}>
            <Text style={styles.annTitle}>发送公告</Text>
            <TextInput
              style={styles.annInput}
              placeholder="公告标题"
              placeholderTextColor={colors.text.tertiary}
              value={annTitle}
              onChangeText={setAnnTitle}
            />
            <TextInput
              style={[styles.annInput, styles.annTextArea]}
              placeholder="公告内容..."
              placeholderTextColor={colors.text.tertiary}
              value={annContent}
              onChangeText={setAnnContent}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.annActions}>
              <TouchableOpacity style={styles.annCancelBtn} onPress={() => { setShowAnnouncement(false); setAnnTitle(''); setAnnContent(''); }}>
                <Text style={styles.annCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.annSubmitBtn} onPress={handleSendAnnouncement} disabled={annSending}>
                {annSending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.annSubmitText}>发送</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {tab === 'orders' && (
        <View style={{ flex: 1 }}>
          <View style={styles.orderFilters}>
            {[{ k: 'pending', v: '待审核' }, { k: 'approved', v: '已通过' }, { k: 'rejected', v: '已拒绝' }, { k: 'all', v: '全部' }].map(f => (
              <TouchableOpacity key={f.k} style={[styles.filter, orderStatus === f.k && styles.filterActive]} onPress={() => loadOrders(f.k)}>
                <Text style={styles.filterText}>{f.v}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FlatList
            data={orders}
            keyExtractor={item => item.id}
            renderItem={({ item }: any) => (
              <View style={styles.orderItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderUser}>{item.username}</Text>
                  <Text style={styles.orderAmt}>¥{item.amount.toFixed(2)}</Text>
                  <Text style={styles.orderMeta}>{item.ipLocation || item.ip} · {formatTs(item.createdAt)}</Text>
                  {item.status === 'pending' && (
                    <View style={styles.orderActions}>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item.id)}>
                        <Text style={styles.approveText}>✓ 确认到账</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
                        <Text style={styles.rejectText}>✗ 拒绝</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {item.status !== 'pending' && <Text style={styles.orderStatus}>{item.status === 'approved' ? '已到账' : '已拒绝'}</Text>}
                </View>
              </View>
            )}
          />
        </View>
      )}

      {tab === 'feedback' && <AdminFeedbacks />}

      {tab === 'users' && (
        usersLoading ? (
          <View style={styles.centered}><ActivityIndicator color={colors.accent} size="large" /></View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={{ padding: spacing.sm }}
            renderItem={({ item }: { item: any }) => (
              <View style={styles.userCard}>
                <View style={styles.userHeader}>
                  <Text style={styles.userName}>{item.nickname || item.username}</Text>
                  <Text style={styles.userMeta}>@{item.username}</Text>
                </View>
                <View style={styles.userStats}>
                  <View style={styles.userStat}>
                    <Text style={styles.userStatVal}>{item.novelCount}</Text>
                    <Text style={styles.userStatLabel}>书架</Text>
                  </View>
                  <View style={styles.userStat}>
                    <Text style={styles.userStatVal}>¥{item.totalRecharge.toFixed(2)}</Text>
                    <Text style={styles.userStatLabel}>充值</Text>
                  </View>
                  <View style={styles.userStat}>
                    <Text style={styles.userStatVal}>¥{item.totalConsumption.toFixed(2)}</Text>
                    <Text style={styles.userStatLabel}>消费</Text>
                  </View>
                  <View style={styles.userStat}>
                    <Text style={[styles.userStatVal, { color: item.balance <= 0 ? colors.error : colors.success }]}>¥{item.balance.toFixed(2)}</Text>
                    <Text style={styles.userStatLabel}>余额</Text>
                  </View>
                </View>
                <View style={styles.userFooter}>
                  <Text style={styles.userIp}>{item.ipLocation || '未知'} ({item.lastIp || '?'})</Text>
                  <TouchableOpacity
                    style={styles.userMsgBtn}
                    onPress={() => { setMsgTargetUser(item); setMsgTitle(''); setMsgContent(''); setUserMsgModal(true); }}
                  >
                    <Ionicons name="mail-outline" size={14} color={colors.primary} />
                    <Text style={styles.userMsgBtnText}>发消息</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )
      )}

      {/* 发送用户消息弹窗 */}
      {userMsgModal && msgTargetUser && (
        <View style={styles.annOverlay}>
          <View style={styles.annModal}>
            <Text style={styles.annTitle}>发送消息</Text>
            <Text style={{ ...typography.caption, color: colors.text.secondary, marginBottom: spacing.md }}>收件人: {msgTargetUser.nickname || msgTargetUser.username}</Text>
            <TextInput style={styles.annInput} placeholder="标题" value={msgTitle} onChangeText={setMsgTitle} />
            <TextInput style={[styles.annInput, styles.annTextArea]} placeholder="内容" value={msgContent} onChangeText={setMsgContent} multiline numberOfLines={3} textAlignVertical="top" />
            <View style={styles.annActions}>
              <TouchableOpacity style={styles.annCancelBtn} onPress={() => { setUserMsgModal(false); setMsgTargetUser(null); }}>
                <Text style={styles.annCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.annSubmitBtn, msgSending && { opacity: 0.5 }]} onPress={handleSendUserMsg} disabled={msgSending}>
                <Text style={styles.annSubmitText}>{msgSending ? '发送中...' : '发送'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function StatCard({ icon, label, value }: any) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={28} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => { adminUsers().then(r => setUsers(r.data?.data?.users || [])); }, []);
  return (
    <FlatList
      data={users}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <View style={styles.userItem}>
          <Text style={styles.userName}>{item.nickname || item.username}</Text>
          <Text style={styles.userMeta}>余额: ¥{item.balance?.toFixed(2)} · 生成: {item.totalGenerations}次</Text>
          <Text style={styles.userMeta}>ID: {item.id?.slice(0, 16)}</Text>
        </View>
      )}
    />
  );
}

function AdminFeedbacks() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const load = async (status?: string) => {
    setLoading(true);
    try {
      const r = await adminFeedbacks(status);
      setFeedbacks(r.data?.data?.feedbacks || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await adminReadFeedback(id);
      load();
    } catch {}
  };

  const handleReply = async (id: string) => {
    if (!replyText.trim()) return;
    try {
      await adminReplyFeedback(id, replyText.trim());
      setReplyId(null);
      setReplyText('');
      load();
      Alert.alert('成功', '回复已发送');
    } catch (e: any) {
      Alert.alert('错误', e?.response?.data?.error?.message || '回复失败');
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.orderFilters}>
        {[{ k: undefined, v: '全部' }, { k: 'pending', v: '待处理' }, { k: 'read', v: '已读' }, { k: 'replied', v: '已回复' }].map(f => (
          <TouchableOpacity key={f.k || 'all'} style={[styles.filter]} onPress={() => load(f.k)}>
            <Text style={styles.filterText}>{f.v}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={feedbacks}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.feedbackItem}>
            <View style={styles.feedbackHeader}>
              <Text style={styles.feedbackUser}>{item.username || '匿名'}</Text>
              <Text style={styles.feedbackTime}>{formatTs(item.createdAt)}</Text>
            </View>
            <Text style={styles.feedbackContent}>{item.content}</Text>
            {item.contact ? <Text style={styles.feedbackContact}>联系方式: {item.contact}</Text> : null}
            {item.adminReply ? (
              <View style={styles.feedbackReply}>
                <Text style={styles.feedbackReplyLabel}>管理员回复:</Text>
                <Text style={styles.feedbackReplyText}>{item.adminReply}</Text>
              </View>
            ) : null}
            <View style={styles.feedbackActions}>
              {item.status === 'pending' && (
                <TouchableOpacity style={styles.markReadBtn} onPress={() => handleMarkRead(item.id)}>
                  <Text style={styles.markReadText}>标记已读</Text>
                </TouchableOpacity>
              )}
              {item.status !== 'replied' && (
                <TouchableOpacity style={styles.replyBtn} onPress={() => { setReplyId(item.id); setReplyText(''); }}>
                  <Text style={styles.replyText}>回复</Text>
                </TouchableOpacity>
              )}
            </View>
            {replyId === item.id && (
              <View style={styles.replyBox}>
                <TextInput
                  style={styles.replyInput}
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="输入回复内容..."
                  placeholderTextColor={colors.text.tertiary}
                  multiline
                />
                <View style={styles.replyActions}>
                  <TouchableOpacity style={styles.replyCancelBtn} onPress={() => setReplyId(null)}>
                    <Text style={styles.replyCancelText}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.replySubmitBtn} onPress={() => handleReply(item.id)}>
                    <Text style={styles.replySubmitText}>发送</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

function formatTs(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingTop: spacing.lg },
  headerTitle: { ...typography.h1, color: colors.text.primary },
  logoutBtn: { ...typography.body, color: colors.error, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary },
  tabs: { flexDirection: 'row', padding: spacing.sm },
  tab: { flex: 1, padding: spacing.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.bg.secondary, borderRadius: radii.md },
  tabText: { ...typography.caption, color: colors.text.tertiary },
  tabTextActive: { color: colors.accent, fontWeight: '700' },
  dashboard: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.sm, gap: spacing.sm },
  announcementBtn: {
    width: '100%', backgroundColor: '#F97316' + '20', borderRadius: radii.lg,
    padding: spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  announcementIcon: { fontSize: 20, marginRight: spacing.sm },
  announcementText: { ...typography.h3, color: '#F97316' },
  statCard: {
    width: '47%', backgroundColor: colors.bg.secondary, borderRadius: radii.lg,
    padding: spacing.md, alignItems: 'center',
  },
  statIcon: { fontSize: 28, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.accent },
  statLabel: { ...typography.caption, color: colors.text.tertiary },
  orderFilters: { flexDirection: 'row', padding: spacing.sm, gap: spacing.xs },
  filter: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.bg.secondary },
  filterActive: { backgroundColor: colors.accent + '30' },
  filterText: { ...typography.caption, color: colors.text.secondary },
  orderItem: {
    backgroundColor: colors.bg.secondary, borderRadius: radii.lg, padding: spacing.md,
    marginHorizontal: spacing.sm, marginVertical: spacing.xs,
  },
  orderUser: { ...typography.h3, color: colors.text.primary },
  orderAmt: { ...typography.h2, color: colors.accent, marginTop: 2 },
  orderMeta: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
  orderActions: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.sm },
  approveBtn: { backgroundColor: '#22C55E' + '30', paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.md },
  approveText: { ...typography.caption, color: '#22C55E', fontWeight: '700' },
  rejectBtn: { backgroundColor: '#EF4444' + '30', paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.md },
  rejectText: { ...typography.caption, color: '#EF4444', fontWeight: '700' },
  orderStatus: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.sm },
  userItem: {
    backgroundColor: colors.bg.secondary, borderRadius: radii.lg,
    padding: spacing.md, marginHorizontal: spacing.sm, marginVertical: spacing.xs,
  },
  userName: { ...typography.h3, color: colors.text.primary },
  userMeta: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
  feedbackItem: {
    backgroundColor: colors.bg.secondary, borderRadius: radii.lg,
    padding: spacing.md, marginHorizontal: spacing.sm, marginVertical: spacing.xs,
  },
  feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  feedbackUser: { ...typography.h3, color: colors.text.primary },
  feedbackTime: { ...typography.caption, color: colors.text.tertiary },
  feedbackContent: { ...typography.body, color: colors.text.secondary, lineHeight: 20 },
  feedbackContact: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.xs },
  feedbackReply: { backgroundColor: colors.bg.tertiary, borderRadius: radii.md, padding: spacing.sm, marginTop: spacing.sm },
  feedbackReplyLabel: { ...typography.caption, color: colors.accent, fontWeight: '600', marginBottom: 2 },
  feedbackReplyText: { ...typography.body, color: colors.text.secondary },
  feedbackActions: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.sm },
  markReadBtn: { backgroundColor: colors.accent + '20', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.md },
  markReadText: { ...typography.caption, color: colors.accent, fontWeight: '600' },
  replyBtn: { backgroundColor: '#22C55E' + '20', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.md },
  replyText: { ...typography.caption, color: '#22C55E', fontWeight: '600' },
  replyBox: { marginTop: spacing.sm, backgroundColor: colors.bg.tertiary, borderRadius: radii.md, padding: spacing.sm },
  replyInput: { ...typography.body, color: colors.text.primary, minHeight: 60, textAlignVertical: 'top' },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm, gap: spacing.sm },
  replyCancelBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  replyCancelText: { ...typography.caption, color: colors.text.tertiary },
  replySubmitBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.md },
  replySubmitText: { ...typography.caption, color: '#fff', fontWeight: '600' },
  annOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  annModal: {
    backgroundColor: colors.bg.secondary, borderRadius: radii.lg, padding: spacing.lg,
    width: '85%', maxWidth: 400,
  },
  annTitle: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.md, textAlign: 'center' },
  annInput: {
    backgroundColor: colors.bg.tertiary, borderRadius: radii.md, padding: spacing.md,
    color: colors.text.primary, ...typography.body, marginBottom: spacing.sm,
  },
  annTextArea: { minHeight: 120, textAlignVertical: 'top' },
  annActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.md, gap: spacing.sm },
  annCancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  annCancelText: { ...typography.body, color: colors.text.tertiary },
  annSubmitBtn: { backgroundColor: '#F97316', paddingHorizontal: 20, paddingVertical: 10, borderRadius: radii.md },
  annSubmitText: { ...typography.body, color: '#fff', fontWeight: '700' },
  userCard: { backgroundColor: colors.bg.secondary, borderRadius: radii.lg, padding: spacing.md, marginBottom: spacing.sm },
  userHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.sm, gap: spacing.sm },
  userName: { ...typography.h3, color: colors.text.primary },
  userMeta: { ...typography.caption, color: colors.text.tertiary },
  userStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  userStat: { alignItems: 'center' },
  userStatVal: { ...typography.h3, color: colors.text.primary },
  userStatLabel: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
  userFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  userIp: { ...typography.caption, color: colors.text.tertiary },
  userMsgBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '15', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.sm },
  userMsgBtnText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
