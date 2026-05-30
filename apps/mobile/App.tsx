import React, { useEffect, useRef, useState } from 'react';
import {
  StatusBar, View, Text, StyleSheet, TouchableOpacity, Animated, Linking,
} from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { HomeScreen } from './src/screens/HomeScreen';
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
import { NotificationScreen } from './src/screens/NotificationScreen';
import { ToastProvider } from './src/components';
import { useNovelStore } from './src/store/useNovelStore';
import { setAuthToken, getProfile } from './src/api/client';
import { getToken, deleteToken } from './src/db/tokenStorage';
import { colors, spacing, radii, typography } from './src/theme';
import { checkForUpdate, showUpdateDialog } from './src/utils/updater';
import type { TabParamList, RootStackParamList } from './src/types/navigation';

// v2.0 向量图标映射
const TAB_ICONS: Record<string, { outline: string; filled: string }> = {
  '书架': { outline: 'book-outline', filled: 'book' },
  '进度': { outline: 'time-outline', filled: 'time' },
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

/** 全局登录状态守卫：掉登录时全屏覆盖提醒 */
function LoginGuard() {
  const navigation = useNavigation<any>();
  const isLoggedIn = useNovelStore(s => s.isLoggedIn);
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const wasLoggedIn = useRef(false);

  useEffect(() => {
    if (!wasLoggedIn.current && isLoggedIn) {
      wasLoggedIn.current = true;
    }
    if (wasLoggedIn.current && !isLoggedIn) {
      // 延迟 3 秒触发，过滤启动时瞬态的 isLoggedIn 波动
      const timer = setTimeout(() => {
        setVisible(true);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 3000);
      return () => clearTimeout(timer);
    }
    if (isLoggedIn) {
      setVisible(false);
      fadeAnim.setValue(0);
    }
  }, [isLoggedIn]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={styles.overlayCard}>
        <Text style={styles.overlayIcon}>🔒</Text>
        <Text style={styles.overlayTitle}>登录已过期</Text>
        <Text style={styles.overlaySub}>请重新登录后继续使用</Text>
        <TouchableOpacity
          style={styles.overlayBtn}
          onPress={() => {
            setVisible(false);
            fadeAnim.setValue(0);
            navigation.navigate('HomeTabs', { screen: 'Home' });
          }}
        >
          <Text style={styles.overlayBtnText}>重新登录</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
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
        name="Upload"
        component={UploadScreen}
        options={{ tabBarLabel: '上传', tabBarIcon: ({ focused }) => <TabIcon label="上传" focused={focused} /> }}
      />
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: '我的', tabBarIcon: ({ focused }) => <TabIcon label="我的" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

function App(): React.JSX.Element {
  const isAdmin = useNovelStore(s => s.isAdmin);
  const [needUpdate, setNeedUpdate] = useState(false);
  const [updateVersion, setUpdateVersion] = useState('');
  const [updateUrl, setUpdateUrl] = useState('');

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
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

  // 启动时强制检查APP更新
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const updateInfo = await checkForUpdate();
        if (updateInfo) {
          setNeedUpdate(true);
          setUpdateVersion(updateInfo.version);
          setUpdateUrl(updateInfo.downloadUrl);
          showUpdateDialog(updateInfo);
        }
      } catch {}
    };
    checkUpdate();
  }, []);

  // 强制更新页面
  if (needUpdate) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />
        <View style={updateStyles.container}>
          <Text style={updateStyles.icon}>🔄</Text>
          <Text style={updateStyles.title}>发现新版本 v{updateVersion}</Text>
          <Text style={updateStyles.desc}>请更新到最新版本后继续使用</Text>
          <TouchableOpacity
            style={updateStyles.btn}
            onPress={() => Linking.openURL(updateUrl)}
          >
            <Text style={updateStyles.btnText}>立即更新</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />
      <ToastProvider>
        <NavigationContainer>
          {isAdmin ? <AdminStack /> : <UserStack />}
          <LoginGuard />
        </NavigationContainer>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.primary } }}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ title: '管理后台' }} />
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,13,18,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  overlayCard: {
    backgroundColor: colors.bg.raised,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    width: 300,
  },
  overlayIcon: { fontSize: 48, marginBottom: spacing.md },
  overlayTitle: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.sm },
  overlaySub: { ...typography.body, color: colors.text.tertiary, marginBottom: spacing.lg },
  overlayBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
    width: '100%',
    alignItems: 'center',
  },
  overlayBtnText: { ...typography.h3, color: colors.text.inverse },
});

const updateStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: { fontSize: 64, marginBottom: 24 },
  title: { ...typography.h1, color: colors.text.primary, marginBottom: 12, textAlign: 'center' },
  desc: { ...typography.body, color: colors.text.secondary, marginBottom: 32, textAlign: 'center' },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingHorizontal: 48,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  btnText: { ...typography.h2, color: '#fff' },
});
