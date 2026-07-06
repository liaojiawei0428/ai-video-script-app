import React, { useEffect } from 'react';
import {
  StatusBar, View, Text, StyleSheet, TouchableOpacity,
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
import { checkForUpdate, showUpdateDialog, UpdateProgressModal } from './src/utils/updater';
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

function App(): React.JSX.Element {
  const isLoggedIn = useNovelStore(s => s.isLoggedIn);
  const isAdmin = useNovelStore(s => s.isAdmin);

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

  // 启动时检查APP更新 (v3.0.17 S58 P10 BUG-026: 删 S58 P7 全屏升级页, 改用 showUpdateDialog 弹窗 + UpdateProgressModal)
  // 删 setNeedUpdate/setUpdateVersion/setUpdateUrl 3 个 state + 强制更新页 (App.tsx:140-142, 191-209)
  // 删 updateStyles 样式 (App.tsx:305)
  // 修 BUG-014 (S58 P7): 删全屏"立即更新"页, 让 React 渲染继续走, showUpdateDialog 弹窗能正常显示
  // v3.0.35 (S72 batch 5): BUG-087 修法 - showUpdateDialog 内部 24h 抑制 (避免"无限发现新版本")
  //   - 取消按钮 → 写 .update_memory (24h 不再弹同版本)
  //   - forceUpdate=true → 强制弹, 不抑制
  //   - 下载按钮 (APP 内/浏览器) → 不抑制 (让用户真去下载)
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const updateInfo = await checkForUpdate();
        if (updateInfo) {
          console.log('[App] update available', { version: updateInfo.version, forceUpdate: updateInfo.forceUpdate });
          await showUpdateDialog(updateInfo);
        } else {
          console.log('[App] no update needed (clientVersion >= serverVersion)');
        }
      } catch (e) {
        console.warn('[App] checkUpdate failed', e);
      }
    };
    checkUpdate();
  }, []);

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
