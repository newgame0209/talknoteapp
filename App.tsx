import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { styled } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// 認証関連のインポート
import AuthGuard from './app/components/AuthGuard';
import WelcomeLogin from './app/screens/WelcomeLogin';
import { useAuthStore } from './app/store/authStore';

// ストアのインポート
import { useDatabaseStore } from './app/store/databaseStore';

// 画面のインポート
import RecordScreen from './app/screens/record/RecordScreen';
import ImportScreen from './app/screens/import/ImportScreen';
import ImportProgressScreen from './app/screens/import/ImportProgressScreen';
import DashboardScreen from './app/screens/dashboard/DashboardScreen';
import FilePickerArea from './app/components/import/FilePickerArea';
import CanvasEditor from './app/screens/CanvasEditor';
import { SkiaTest } from './app/components/SkiaTest';
import StartupScreen from './app/components/StartupScreen';
import Settings from './app/screens/Settings';
import PhotoScanScreen from './app/screens/PhotoScanScreen';

// NativeWindの設定
import 'nativewind';

// スタイル付きコンポーネント
const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

// ホーム画面
const HomeScreen = ({ navigation }: any) => (
  <StyledView className="flex-1 items-center justify-center bg-white">
    <StyledText className="text-2xl font-bold text-primary-500">しゃべるノート</StyledText>
    <StyledText className="text-lg text-gray-600 mt-2">機能を選択してください</StyledText>
    
    <StyledView className="w-full px-8 mt-8 space-y-4">
      <StyledTouchableOpacity 
        className="flex-row items-center justify-center bg-indigo-600 py-4 rounded-lg"
        onPress={() => navigation.navigate('Record')}
      >
        <FontAwesome5 name="microphone" size={20} color="white" />
        <StyledText className="text-white font-bold ml-2">音声を録音する</StyledText>
      </StyledTouchableOpacity>
      
      <StyledTouchableOpacity 
        className="flex-row items-center justify-center bg-indigo-600 py-4 rounded-lg"
        onPress={() => navigation.navigate('Import')}
      >
        <FontAwesome5 name="file-import" size={20} color="white" />
        <StyledText className="text-white font-bold ml-2">ファイルをインポートする</StyledText>
      </StyledTouchableOpacity>
      
      {/* Skiaテスト用ボタン */}
      <StyledTouchableOpacity 
        className="flex-row items-center justify-center bg-green-600 py-4 rounded-lg"
        onPress={() => navigation.navigate('SkiaTest')}
      >
        <FontAwesome5 name="paint-brush" size={20} color="white" />
        <StyledText className="text-white font-bold ml-2">Skia描画テスト</StyledText>
      </StyledTouchableOpacity>
    </StyledView>
    
    <StatusBar style="auto" />
  </StyledView>
);

// ナビゲーションスタックの型定義
type RootStackParamList = {
  WelcomeLogin: undefined;
  Home: undefined;
  Dashboard: undefined;
  Record: undefined;
  Import: undefined;
  ImportProgress: {
    file: {
      name: string;
      uri: string;
      type: string;
      size: number;
    };
  };
  FileImportSheet: undefined;
  CanvasEditor: { noteId?: string };
  PhotoScan: undefined;
  SkiaTest: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  // 認証状態管理
  const { user, isLoading: authLoading } = useAuthStore();
  
  // データベース初期化状態管理
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // データベースストアから初期化関数を取得
  const initializeDatabase = useDatabaseStore(state => state.initializeDatabase);
  
  // アプリ起動時にデータベースを初期化
  useEffect(() => {
    // 一時的に初期化をスキップして強制的に成功させる
    console.log('データベース初期化をスキップしています');
    setIsDbReady(true);
    
    /* 本来のコード - 一時的にコメントアウト
    const setupDatabase = async () => {
      try {
        await initializeDatabase();
        setIsDbReady(true);
      } catch (error) {
        console.error('Database initialization error:', error);
        setDbError(error instanceof Error ? error.message : 'データベースの初期化に失敗しました');
      }
    };
    
    setupDatabase();
    */
  }, []);

  // 認証状態のデバッグログ
  useEffect(() => {
    if (__DEV__) {
      console.log('🔍 App.tsx 認証状態:', {
        user: user ? `認証済み(${user.uid.slice(0, 8)}...)` : '未認証',
        authLoading,
        initialRoute: user ? 'Dashboard' : 'WelcomeLogin'
      });
    }
  }, [user, authLoading]);
  
  // 認証確認中またはデータベース初期化中はローディング表示
  if (authLoading || (!isDbReady && !dbError)) {
    return (
      <>
        <StartupScreen />
        {__DEV__ && (
          <GestureHandlerRootView style={{ position: 'absolute', bottom: 40, alignSelf: 'center' }}>
            <StyledText className="text-xs text-white bg-black/50 px-3 py-1 rounded-full">
              🔧 Debug: {authLoading ? 'Auth loading' : 'DB init'}
            </StyledText>
          </GestureHandlerRootView>
        )}
      </>
    );
  }
  
  // データベースエラー時はエラー表示
  if (dbError) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StyledView className="flex-1 items-center justify-center bg-white">
          <FontAwesome5 name="exclamation-circle" size={50} color="#EF4444" />
          <StyledText className="mt-4 text-xl font-bold text-red-500">エラーが発生しました</StyledText>
          <StyledText className="mt-2 text-center px-6 text-gray-600">{dbError}</StyledText>
        </StyledView>
      </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }
  
  // 初期化完了後、認証状態に基づいてナビゲーションを表示
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={user ? "Dashboard" : "WelcomeLogin"}>
          {/* 認証画面 */}
          <Stack.Screen 
            name="WelcomeLogin" 
            component={WelcomeLogin} 
            options={{ 
              headerShown: false,
            }} 
          />
          
          {/* 保護されたコンテンツ - 認証が必要 */}
          <Stack.Screen 
            name="Dashboard" 
            options={{ headerShown: false }}
          >
            {(props) => (
              <AuthGuard fallback={<WelcomeLogin />}>
                <DashboardScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          
          <Stack.Screen 
            name="Record" 
            options={{ headerShown: false }}
          >
            {(props) => (
              <AuthGuard fallback={<WelcomeLogin />}>
                <RecordScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          
          <Stack.Screen 
            name="CanvasEditor" 
            options={{ headerShown: false }}
          >
            {(props) => (
              <AuthGuard fallback={<WelcomeLogin />}>
                <CanvasEditor />
              </AuthGuard>
            )}
          </Stack.Screen>
          
          <Stack.Screen 
            name="PhotoScan" 
            options={{ headerShown: false }}
          >
            {(props) => (
              <AuthGuard fallback={<WelcomeLogin />}>
                <PhotoScanScreen />
              </AuthGuard>
            )}
          </Stack.Screen>
          
          {/* 以下は認証不要または開発用画面 */}
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ 
              title: 'しゃべるノート',
              headerStyle: {
                backgroundColor: '#f6f7fb',
              },
              headerTintColor: '#000',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }} 
          />
          
          <Stack.Screen 
            name="Import" 
            component={ImportScreen} 
            options={{ 
              title: 'ファイルインポート',
              headerStyle: {
                backgroundColor: '#4F46E5',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }} 
          />
          
          <Stack.Screen 
            name="ImportProgress" 
            component={ImportProgressScreen} 
            options={{ 
              headerShown: false,
            }} 
          />
          
          <Stack.Screen 
            name="FileImportSheet" 
            component={FilePickerArea} 
            options={{ 
              presentation: 'modal',
              title: 'ファイルインポート',
              headerStyle: {
                backgroundColor: '#4F46E5',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }} 
          />
          
          <Stack.Screen 
            name="SkiaTest" 
            component={SkiaTest} 
            options={{ 
              headerShown: false
            }} 
          />
          
          <Stack.Screen 
            name="Settings" 
            options={{ headerShown: false }}
          >
            {(props) => (
              <AuthGuard fallback={<WelcomeLogin />}>
                <Settings />
              </AuthGuard>
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
