import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  HomeTabs: undefined;
  ScriptDetail: { novelId: string; novelTitle: string };
  EpisodeDetail: { novelId: string; episodeId: string; episodeTitle: string };
  TaskProgress: { novelId: string; novelTitle?: string };
  Settings: undefined;
  About: undefined;
  PrivacyPolicy: undefined;
  UserAgreement: undefined;
  Feedback: undefined;
  Notifications: undefined;
  Pricing: undefined;
  Billing: undefined;
  Recharge: { amount: number };
  Admin: undefined;
};

export type TabParamList = {
  Home: undefined;
  Chat: { novelId?: string; novelTitle?: string } | undefined;
  Bookshelf: undefined;
  Upload: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export type ScriptDetailRouteProp = RouteProp<RootStackParamList, 'ScriptDetail'>;
export type EpisodeDetailRouteProp = RouteProp<RootStackParamList, 'EpisodeDetail'>;
export type ChatTabRouteProp = RouteProp<TabParamList, 'Chat'>;
