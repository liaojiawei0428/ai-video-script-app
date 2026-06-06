import React, { useEffect, useState } from 'react';
import {
  StatusBar, View, Text, StyleSheet, TouchableOpacity, Linking,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
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
import { CharacterDescriptionReviewScreen } from './src/screens/CharacterDescriptionReviewScreen';
import { CharacterDetailScreen } from './src/screens/CharacterDetailScreen';
import { CharacterListScreen } from './src/screens/CharacterListScreen';
import { OutlineReviewScreen } from './src/screens/OutlineReviewScreen';
import { PlotGraphScreen } from './src/screens/PlotGraphScreen';
import { AssetLibraryScreen } from './src/screens/AssetLibraryScreen';
import { AIAssistantScreen } from './src/screens/AIAssistantScreen';
import { PointsOrderScreen } from './src/screens/PointsOrderScreen';
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
      <Stack.Screen name="CharacterDescriptionReview" component={CharacterDescriptionReviewScreen} options={detailOptions('角色描述确认')} />
      <Stack.Screen name="CharacterDetail" component={CharacterDetailScreen} options={detailOptions('角色详情')} />
      <Stack.Screen name="CharacterList" component={CharacterListScreen} options={detailOptions('角色列表')} />
      <Stack.Screen name="OutlineReview" component={OutlineReviewScreen} options={detailOptions('分集大纲')} />
      <Stack.Screen name="PlotGraph" component={PlotGraphScreen} options={detailOptions('事件图谱')} />
      <Stack.Screen name="AssetLibrary" component={AssetLibraryScreen} options={detailOptions('资产库')} />
      <Stack.Screen name="AIAssistant" component={AIAssistantScreen} options={{ headerShown: true, title: 'AI 助手' }} />
      <Stack.Screen name="PointsOrder" component={PointsOrderScreen} options={detailOptions('积分订单')} />
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
