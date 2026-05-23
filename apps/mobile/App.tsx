import React, { useEffect, useRef, useState } from 'react';
import {
  StatusBar, View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/HomeScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { BookshelfScreen } from './src/screens/BookshelfScreen';
import { UploadScreen } from './src/screens/UploadScreen';
import { ScriptDetailScreen } from './src/screens/ScriptDetailScreen';
import { EpisodeDetailScreen } from './src/screens/EpisodeDetailScreen';
import { TaskProgressScreen } from './src/screens/TaskProgressScreen';
import { ToastProvider } from './src/components';
import { useNovelStore } from './src/store/useNovelStore';
import { setAuthToken, getProfile } from './src/api/client';
import { getToken, deleteToken } from './src/db/tokenStorage';
import { colors, spacing, radii, typography } from './src/theme';
import type { TabParamList, RootStackParamList } from './src/types/navigation';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    '书架': '📚',
    '进度': '⏳',
    '上传': '➕',
    '我的': '👤',
  };
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icons[label] || '📄'}</Text>;
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
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: colors.bg.secondary,
          borderTopColor: colors.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
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
  // APP 启动时恢复 token，有 token 就立即登录（不等待网络验证）
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      setAuthToken(token);
      useNovelStore.getState().setLoggedIn(true);
      // getProfile 仅用于加载用户信息，失败不影响登录状态（除非 401）
      try {
        const res = await getProfile();
        if (res.data?.data?.user) {
          useNovelStore.getState().setUserInfo(res.data.data.user);
        }
      } catch (err: any) {
        if (err?.response?.status === 401) {
          await deleteToken();
          setAuthToken(null);
          useNovelStore.getState().setLoggedIn(false);
        }
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />
      <ToastProvider>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg.primary },
            }}
          >
            <Stack.Screen name="HomeTabs" component={HomeTabs} />
            <Stack.Screen
              name="ScriptDetail"
              component={ScriptDetailScreen}
              options={{
                headerShown: true,
                title: '剧本详情',
                headerBackTitle: '返回',
                headerStyle: { backgroundColor: colors.bg.secondary },
                headerTintColor: colors.text.primary,
                headerTitleStyle: { color: colors.text.primary },
              }}
            />
            <Stack.Screen
              name="EpisodeDetail"
              component={EpisodeDetailScreen}
              options={{
                headerShown: true,
                title: '剧集内容',
                headerBackTitle: '返回',
                headerStyle: { backgroundColor: colors.bg.secondary },
                headerTintColor: colors.text.primary,
                headerTitleStyle: { color: colors.text.primary },
              }}
            />
            <Stack.Screen
              name="TaskProgress"
              component={TaskProgressScreen}
              options={{
                headerShown: true,
                title: '任务进度',
                headerBackTitle: '返回',
                headerStyle: { backgroundColor: colors.bg.secondary },
                headerTintColor: colors.text.primary,
                headerTitleStyle: { color: colors.text.primary },
              }}
            />
          </Stack.Navigator>
          <LoginGuard />
        </NavigationContainer>
      </ToastProvider>
    </SafeAreaProvider>
  );
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
