import React, { useEffect, useState, useCallback } from 'react';
import {
  StatusBar, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// v3.0.76 (BUG-145 修): 根包 GestureHandlerRootView — gesture-handler v2 硬性要求
//   不包的话 PinchGestureHandler / PanGestureHandler / TapGestureHandler 都不工作
//   (跨项目通用铁律: 任何用 react-native-gesture-handler v2 的 app 根必须包)
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from 'react-native-vector-icons/Ionicons';
// v3.0.88 (S78 BUG-165): 启动必查版本 + 强制升级 + 不一致不允许进主界面
//   删 v3.0.35 (S72 batch 5) BUG-087 24h 抑制 (跟"强制"硬冲突)
//   showUpdateDialog 改成 showForceUpdateDialog (2 按钮: 立即升级/退出APP)
import { checkForUpdate, showForceUpdateDialog, VersionInfo } from './src/utils/updater';
import { APP_VERSION } from './src/config/version';

/**
 * v3.0.88 (BUG-165): 客户端版本对比 (跟 server 端 compareVersions 1:1 镜像)
 * 返 -1 (v1 < v2) / 0 (相等) / 1 (v1 > v2)
 */
function compareVersionsClient(v1: string, v2: string): number {
  const pa = v1.split('.').map(Number);
  const pb = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const a = pa[i] || 0;
    const b = pb[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * v3.0.88 (BUG-165): Gate Screen - 启动时检查版本中 (splash)
 */
function GateCheckingScreen() {
  return (
    <View style={gateStyles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={gateStyles.title}>检查版本中...</Text>
      <Text style={gateStyles.subtitle}>当前版本: v{APP_VERSION}</Text>
    </View>
  );
}

/**
 * v3.0.88 (BUG-165): Gate Screen - 网络错误 (3 次重试后仍失败)
 * 不允许跳过, 必 retry 才能进入主界面
 */
function GateNetworkErrorScreen({ errorMsg, onRetry }: { errorMsg: string; onRetry: () => void }) {
  return (
    <View style={gateStyles.container}>
      <Text style={gateStyles.emoji}>⚠️</Text>
      <Text style={gateStyles.title}>网络错误, 无法连接服务器</Text>
      <Text style={gateStyles.subtitle}>{errorMsg}</Text>
      <Text style={gateStyles.subtitle}>请检查网络后重试</Text>
      <TouchableOpacity
        style={gateStyles.retryBtn}
        onPress={onRetry}
        activeOpacity={0.7}
      >
        <Text style={gateStyles.retryBtnText}>重试</Text>
      </TouchableOpacity>
    </View>
  );
}

const gateStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 8,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 32,
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
import { ChatScreen } from './src/screens/ChatScreen';
import { BookshelfScreen } from './src/screens/BookshelfScreen';
import { UploadScreen } from './src/screens/UploadScreen';
import { ScriptDetailScreen } from './src/screens/ScriptDetailScreen';
import { EpisodeDetailScreen } from './src/screens/EpisodeDetailScreen';
import { TaskProgressScreen } from './src/screens/TaskProgressScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { PrivacyPolicyScreen } from './src/screens/PrivacyPolicyScreen';
import { UserAgreementScreen } from './src/screens/UserAgreementScreen';
import { FeedbackScreen } from './src/screens/FeedbackScreen';
import { PricingScreen } from './src/screens/PricingScreen';
import { BillingScreen } from './src/screens/BillingScreen';
import { RechargeScreen } from './src/screens/RechargeScreen';
import { AdminDashboard } from './src/screens/AdminDashboard';
// v3.0.0 (S58): 8 个新 screen - 跟 web 1:1 镜像
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ImageAgentScreen } from './src/screens/ImageAgentScreen';
import { VideoAgentScreen } from './src/screens/VideoAgentScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { AdminLoginScreen } from './src/screens/AdminLoginScreen';
import { OutlineScreen } from './src/screens/OutlineScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { VipCenterScreen } from './src/screens/VipCenterScreen';
import { NotificationScreen } from './src/screens/NotificationScreen';
import { CharacterDescriptionReviewScreen } from './src/screens/CharacterDescriptionReviewScreen';
import { CharacterDetailScreen, CharacterDetailScreenWithBoundary } from './src/screens/CharacterDetailScreen';
import { CharacterListScreen } from './src/screens/CharacterListScreen';
import { OutlineReviewScreen } from './src/screens/OutlineReviewScreen';
import { PlotGraphScreen } from './src/screens/PlotGraphScreen';
import { AssetLibraryScreen } from './src/screens/AssetLibraryScreen';
import { AIAssistantScreen } from './src/screens/AIAssistantScreen';
import { PointsOrderScreen } from './src/screens/PointsOrderScreen';
import { ToastProvider } from './src/components';
import { DialogHost } from './src/hooks/useDialog';
import { ToastHost } from './src/components/Toast';
import { useNovelStore } from './src/store/useNovelStore';
import { setAuthToken, getProfile } from './src/api/client';
import { getToken, deleteToken } from './src/db/tokenStorage';
import { colors, spacing } from './src/theme';
// v3.0.88 (BUG-165): checkForUpdate 加重试 (1s/2s/4s) + showForceUpdateDialog 强制 modal
//   旧 showUpdateDialog 仍 export 作为 alias (兼容外部引用), 但内部已转 showForceUpdateDialog
import { UpdateProgressModal } from './src/utils/updater';
// v3.0.89 (S78 BUG-166): 强制升级全屏 modal (修 v3.0.88 dismissable=true 逃逸)
//   跟 UpdateProgressModal 同位置渲染, 但走全屏 RN Modal 不是 shipin-APP Dialog
import { ForceUpdateModal } from './src/utils/updater';
import type { TabParamList, RootStackParamList } from './src/types/navigation';

// v2.0 向量图标映射 (v3.0.0: 加生图 + 视频)
const TAB_ICONS: Record<string, { outline: string; filled: string }> = {
  '书架': { outline: 'book-outline', filled: 'book' },
  '进度': { outline: 'time-outline', filled: 'time' },
  '生图': { outline: 'image-outline', filled: 'image' },
  '视频': { outline: 'videocam-outline', filled: 'videocam' },
  '上传': { outline: 'add-circle-outline', filled: 'add-circle' },
  '我的': { outline: 'person-outline', filled: 'person' },
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const iconConfig = TAB_ICONS[label] || { outline: 'ellipse-outline', filled: 'ellipse' };
  const iconName = focused ? iconConfig.filled : iconConfig.outline;
  return (
    <Ionicons
      name={iconName}
      size={24}
      color={focused ? colors.primary : colors.text.tertiary}
    />
  );
}

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: colors.bg.secondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Bookshelf"
        component={BookshelfScreen}
        options={{ tabBarLabel: '书架', tabBarIcon: ({ focused }) => <TabIcon label="书架" focused={focused} /> }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarLabel: '进度', tabBarIcon: ({ focused }) => <TabIcon label="进度" focused={focused} /> }}
      />
      <Tab.Screen
        name="ImageAgent"
        component={ImageAgentScreen}
        options={{ tabBarLabel: '生图', tabBarIcon: ({ focused }) => <TabIcon label="生图" focused={focused} /> }}
      />
      <Tab.Screen
        name="VideoAgent"
        component={VideoAgentScreen}
        options={{ tabBarLabel: '视频', tabBarIcon: ({ focused }) => <TabIcon label="视频" focused={focused} /> }}
      />
      <Tab.Screen
        name="Upload"
        component={UploadScreen}
        options={{ tabBarLabel: '上传', tabBarIcon: ({ focused }) => <TabIcon label="上传" focused={focused} /> }}
      />
      <Tab.Screen
        name="Home"
        component={ProfileScreen}
        options={{ tabBarLabel: '我的', tabBarIcon: ({ focused }) => <TabIcon label="我的" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

// v3.0.88 (S78 BUG-165): 启动 gate 类型
//   - 'checking': 启动 splash, 跑 checkForUpdate (3 次重试)
//   - 'network-error': 3 次重试后仍失败, 渲染"网络错误请重试"页 (不允许进入主界面)
//   - 'update-required': 拿到 updateInfo 但 version 不一致, 渲染强制升级 modal (不渲染 navigation)
//   - 'ok': 跟 server 一致, 渲染主界面
type GateState = 'checking' | 'network-error' | 'update-required' | 'ok';

function App(): React.JSX.Element {
  const isLoggedIn = useNovelStore(s => s.isLoggedIn);
  const isAdmin = useNovelStore(s => s.isAdmin);

  // v3.0.88 (BUG-165): startup gate 强制升级, 不一致不允许进入主界面
  const [gateState, setGateState] = useState<GateState>('checking');
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [gateErrorMsg, setGateErrorMsg] = useState<string>('');

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        // v3.0.0 (S58): 没 token 直接确认未登录
        useNovelStore.getState().setLoggedIn(false);
        useNovelStore.getState().setAdmin(false);
        return;
      }
      setAuthToken(token);
      useNovelStore.getState().setLoggedIn(true);
      try {
        const res = await getProfile();
        if (res.data?.data?.user) {
          const user = res.data.data.user;
          useNovelStore.getState().setUserInfo(user);
          if (user.role === 'admin') {
            useNovelStore.getState().setAdmin(true);
          }
        }
      } catch (err: any) {
        if (err?.response?.status === 401) {
          await deleteToken();
          setAuthToken(null);
          useNovelStore.getState().setLoggedIn(false);
          useNovelStore.getState().setAdmin(false);
        }
      }
    })();
  }, []);

  // v3.0.88 (S78 BUG-165): 启动必查版本, 不一致不允许进入主界面
  // 修前 (v3.0.87): checkForUpdate 静默吞错 + 弹 modal 跟 navigation 并行渲染 → 用户能"先用后弹"
  // 修后: 4 状态机 (checking / network-error / update-required / ok), 不通过 = 不渲染 navigation
  const runGate = useCallback(async () => {
    setGateState('checking');
    setGateErrorMsg('');
    try {
      const info = await checkForUpdate(APP_VERSION, 3);
      console.log('[App] checkForUpdate success', { version: info.version });
      // v3.0.88: 任何不一致都强制升级 (appForceUpdate 永远 true), client 跟 server 对比
      const clientVer = APP_VERSION;
      const serverVer = info.version;
      const isMatch = compareVersionsClient(clientVer, serverVer) === 0;
      if (isMatch) {
        // 一致 → 进主界面
        setUpdateInfo(null);
        setGateState('ok');
      } else {
        // 不一致 → 强制升级, 不允许 dismiss
        setUpdateInfo(info);
        setGateState('update-required');
        showForceUpdateDialog(info);
      }
    } catch (e: any) {
      // 3 次重试后仍失败 → 拒绝启动 (跟"启动必查"硬指标一致, 不允许进主界面)
      console.error('[App] checkForUpdate 3 retries failed', e);
      setGateErrorMsg(e?.message || '网络错误, 请重试');
      setGateState('network-error');
    }
  }, []);

  useEffect(() => {
    runGate();
  }, [runGate]);

  // v3.0.88: 不通过 = 渲染 GateScreen 不渲染 NavigationContainer
  if (gateState === 'update-required' || gateState === 'checking' || gateState === 'network-error') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />
          {gateState === 'checking' ? (
            <GateCheckingScreen />
          ) : gateState === 'network-error' ? (
            <GateNetworkErrorScreen errorMsg={gateErrorMsg} onRetry={runGate} />
          ) : (
            // update-required: 渲染空白背景, 强制 modal 已经在 showForceUpdateDialog 弹出
            <View style={{ flex: 1, backgroundColor: colors.bg.primary }} />
          )}
          {/* 全局 Dialog + Toast 仍要渲染, 否则 modal 不能弹 */}
          <DialogHost />
          <ToastHost />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // gateState === 'ok' → 正常渲染主界面

  return (
    // v3.0.76 (BUG-145 修): GestureHandlerRootView 包整个 app, gesture-handler v2 硬性要求
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />
        <ToastProvider>
        <NavigationContainer>
          {isAdmin ? (
            <AdminStack />
          ) : isLoggedIn ? (
            <UserStack />
          ) : (
            <AuthStack />
          )}
        </NavigationContainer>
        {/* v3.0.5 (S58 P6 BUG-010): 在线升级进度条 Modal — 替换 S58 P4 的 Alert 弹窗 */}
        <UpdateProgressModal />
        {/* v3.0.89 (BUG-166): 强制升级全屏 modal — 必渲染, 走 module-level state 控制 visible */}
        <ForceUpdateModal />
        {/* v3.0.24 (S60 P1): 全局 Dialog + Toast 组件 - 替代 React Native Modal + Alert.alert */}
        <DialogHost />
        <ToastHost />
      </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.primary } }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ title: '管理后台' }} />
    </Stack.Navigator>
  );
}

// v3.0.0 (S58): Auth gate - 未登录走 AuthStack, 登录后走 UserStack
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.primary } }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} options={detailOptions('注册')} />
      <Stack.Screen name="AdminLogin" component={AdminLoginScreen} options={detailOptions('管理员登录')} />
    </Stack.Navigator>
  );
}

function UserStack() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.primary } }}
    >
      <Stack.Screen name="HomeTabs" component={HomeTabs} />
      <Stack.Screen name="ScriptDetail" component={ScriptDetailScreen} options={detailOptions('剧本详情')} />
      <Stack.Screen name="EpisodeDetail" component={EpisodeDetailScreen} options={detailOptions('剧集内容')} />
      <Stack.Screen name="TaskProgress" component={TaskProgressScreen} options={detailOptions('任务进度')} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={detailOptions('设置')} />
      <Stack.Screen name="About" component={AboutScreen} options={detailOptions('关于')} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={detailOptions('隐私政策')} />
      <Stack.Screen name="UserAgreement" component={UserAgreementScreen} options={detailOptions('协议')} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} options={detailOptions('反馈')} />
      <Stack.Screen name="Notifications" component={NotificationScreen} options={detailOptions('系统消息')} />
      <Stack.Screen name="Pricing" component={PricingScreen} options={detailOptions('收费标准')} />
      <Stack.Screen name="Billing" component={BillingScreen} options={detailOptions('交易记录')} />
      <Stack.Screen name="Recharge" component={RechargeScreen} options={detailOptions('充值')} />
      <Stack.Screen name="CharacterDescriptionReview" component={CharacterDescriptionReviewScreen} options={detailOptions('角色描述确认')} />
      <Stack.Screen name="CharacterDetail" component={CharacterDetailScreenWithBoundary} options={detailOptions('角色详情')} />
      <Stack.Screen name="CharacterList" component={CharacterListScreen} options={detailOptions('角色列表')} />
      <Stack.Screen name="OutlineReview" component={OutlineReviewScreen} options={detailOptions('分集大纲')} />
      <Stack.Screen name="PlotGraph" component={PlotGraphScreen} options={detailOptions('事件图谱')} />
      <Stack.Screen name="AssetLibrary" component={AssetLibraryScreen} options={detailOptions('资产库')} />
      <Stack.Screen name="AIAssistant" component={AIAssistantScreen} options={{ headerShown: true, title: 'AI 助手' }} />
      <Stack.Screen name="PointsOrder" component={PointsOrderScreen} options={detailOptions('积分订单')} />
      {/* v3.0.0 (S58): 8 个新 screen - 跟 web 1:1 镜像 */}
      <Stack.Screen name="Profile" component={ProfileScreen} options={detailOptions('个人中心')} />
      <Stack.Screen name="Account" component={AccountScreen} options={detailOptions('账号设置')} />
      <Stack.Screen name="Outline" component={OutlineScreen} options={detailOptions('分集大纲')} />
      <Stack.Screen name="Tasks" component={TasksScreen} options={detailOptions('任务进度')} />
      <Stack.Screen name="VipCenter" component={VipCenterScreen} options={detailOptions('VIP 中心')} />
      {/* Login/Register/AdminLogin 在 AuthStack 中 */}
    </Stack.Navigator>
  );
}

function detailOptions(title: string) {
  return {
    headerShown: true,
    title,
    headerBackTitle: '返回',
    headerStyle: { backgroundColor: colors.bg.secondary },
    headerTintColor: colors.text.primary,
    headerTitleStyle: { color: colors.text.primary },
  };
}

export default App;

const styles = StyleSheet.create({
});
