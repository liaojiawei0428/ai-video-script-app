import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNovelStore } from '../store/useNovelStore';
import { deleteToken } from '../db/tokenStorage';
import { setAuthToken } from '../api/client';
import { colors, spacing, radii, typography } from '../theme';
import { APP_DISPLAY_NAME } from '../config/version';

interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

export function SettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const logout = useNovelStore(s => s.logout);

  const handleLogout = () => {
    Alert.alert('退出登录', '确定退出当前账号吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出', style: 'destructive',
        onPress: async () => {
          await deleteToken();
          setAuthToken(null);
          logout();
          navigation.navigate('HomeTabs', { screen: 'Home' });
        },
      },
    ]);
  };

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: '法律合规',
      items: [
        {
          icon: 'document-text',
          label: '用户服务协议',
          onPress: () => navigation.navigate('UserAgreement'),
        },
        {
          icon: 'shield-checkmark',
          label: '隐私政策',
          onPress: () => navigation.navigate('PrivacyPolicy'),
        },
      ],
    },
    {
      title: '信息公示',
      items: [
        {
          icon: 'information-circle',
          label: '关于我们',
          onPress: () => navigation.navigate('About'),
        },
        {
          icon: 'shield-checkmark',
          label: '算法备案公示',
          onPress: () => navigation.navigate('About'),
        },
      ],
    },
    {
      title: '帮助与反馈',
      items: [
        {
          icon: 'chatbubble-ellipses',
          label: '意见反馈',
          onPress: () => navigation.navigate('Feedback'),
        },
      ],
    },
    {
      title: '账户',
      items: [
        {
          icon: '🚪',
          label: '退出登录',
          onPress: handleLogout,
          danger: true,
        },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>设置</Text>

      {menuSections.map((section, si) => (
        <View key={si} style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.menuBlock}>
            {section.items.map((item, ii) => (
              <TouchableOpacity
                key={ii}
                style={[
                  styles.menuItem,
                  ii < section.items.length - 1 && styles.menuItemBorder,
                ]}
                onPress={item.onPress}
                activeOpacity={0.6}
              >
                <Ionicons name={item.icon} size={20} color={item.danger ? colors.error : colors.primary} style={styles.menuIcon} />
                <Text style={[styles.menuLabel, item.danger && styles.menuLabelDanger]}>
                  {item.label}
                </Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.versionText}>{APP_DISPLAY_NAME}</Text>
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.md },
  pageTitle: { ...typography.h1, marginBottom: spacing.lg },
  sectionGroup: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.caption, color: colors.text.tertiary, marginBottom: spacing.sm, paddingLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 1 },
  menuBlock: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuIcon: { fontSize: 20, marginRight: spacing.sm },
  menuLabel: { ...typography.body, color: colors.text.primary, flex: 1 },
  menuLabelDanger: { color: colors.error },
  menuArrow: { ...typography.h2, color: colors.text.tertiary },
  versionText: { ...typography.caption, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.xl },
});
