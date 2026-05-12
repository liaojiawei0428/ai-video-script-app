import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { UploadScreen } from './src/screens/UploadScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { AnalysisScreen } from './src/screens/AnalysisScreen';
import { EpisodeListScreen } from './src/screens/EpisodeListScreen';
import { ScriptDetailScreen } from './src/screens/ScriptDetailScreen';

const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'AI剧本生成' }} />
          <Stack.Screen name="Upload" component={UploadScreen} options={{ title: '上传小说' }} />
          <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: '处理进度' }} />
          <Stack.Screen name="Analysis" component={AnalysisScreen} options={{ title: '分析结果' }} />
          <Stack.Screen name="Episodes" component={EpisodeListScreen} options={{ title: '剧集列表' }} />
          <Stack.Screen name="ScriptDetail" component={ScriptDetailScreen} options={{ title: '剧本详情' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
