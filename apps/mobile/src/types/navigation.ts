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
  AdminDashboard: undefined;
  // v3.0.0 新增：跟 web 1:1 镜像
  Profile: undefined;             // 个人资料 (web: ProfilePage)
  Login: { redirect?: string } | undefined;   // 登录 (web: LoginPage)
  Register: undefined;            // 注册 (web: RegisterPage)
  Account: undefined;             // 账户中心 (web: AccountPage)
  AdminLogin: undefined;          // 管理员登录 (web: AdminLoginPage)
  Outline: { novelId: string; novelTitle?: string } | undefined; // 任务进度/大纲 (web: OutlinePage)
  Tasks: undefined;               // 任务列表 (web: TasksPage)
  VipCenter: undefined;           // VIP 中心 (web: VipCenterPage)
  // v3.0.0.30 (S58) 新增 screen
  ImageAgent: undefined;          // 生图 tab
  VideoAgent: undefined;          // 视频 tab
  CharacterDescriptionReview: { novelId: string; characterId: string } | undefined;
  CharacterDetail: { characterId: string } | undefined;
  CharacterList: { novelId: string } | undefined;
  OutlineReview: { novelId: string } | undefined;
  PlotGraph: { novelId: string } | undefined;
  AssetLibrary: undefined;
  AIAssistant: undefined;
  PointsOrder: undefined;
};

export type TabParamList = {
  Home: undefined;
  Chat: { novelId?: string; novelTitle?: string } | undefined;
  Bookshelf: undefined;
  Upload: undefined;
  // v3.0.0.30 (S58) 新增 tab
  ImageAgent: undefined;
  VideoAgent: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export type ScriptDetailRouteProp = RouteProp<RootStackParamList, 'ScriptDetail'>;
export type EpisodeDetailRouteProp = RouteProp<RootStackParamList, 'EpisodeDetail'>;
export type ChatTabRouteProp = RouteProp<TabParamList, 'Chat'>;
