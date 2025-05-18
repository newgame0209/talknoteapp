import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { styled } from 'nativewind';

// ストアのインポート
import { useDatabaseStore } from './app/store/databaseStore';

// 画面のインポート
import RecordScreen from './app/screens/record/RecordScreen';
import ImportScreen from './app/screens/import/ImportScreen';
// Skiaのインポートを修正
// import { Canvas } from '@shopify/react-native-skia';

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
    </StyledView>
    
    <StatusBar style="auto" />
  </StyledView>
);

// ナビゲーションスタックの型定義
type RootStackParamList = {
  Home: undefined;
  Record: undefined;
  Import: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  // データベース初期化状態管理
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // データベースストアから初期化関数を取得
  const initializeDatabase = useDatabaseStore(state => state.initializeDatabase);
  
  // アプリ起動時にデータベースを初期化
  useEffect(() => {
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
  }, [initializeDatabase]);
  
  // データベース初期化中はローディング表示
  if (!isDbReady && !dbError) {
    return (
      <SafeAreaProvider>
        <StyledView className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#4F46E5" />
          <StyledText className="mt-4 text-gray-600">初期化中...</StyledText>
        </StyledView>
      </SafeAreaProvider>
    );
  }
  
  // データベースエラー時はエラー表示
  if (dbError) {
    return (
      <SafeAreaProvider>
        <StyledView className="flex-1 items-center justify-center bg-white">
          <FontAwesome5 name="exclamation-circle" size={50} color="#EF4444" />
          <StyledText className="mt-4 text-xl font-bold text-red-500">エラーが発生しました</StyledText>
          <StyledText className="mt-2 text-center px-6 text-gray-600">{dbError}</StyledText>
        </StyledView>
      </SafeAreaProvider>
    );
  }
  
  // データベース初期化完了後、アプリを表示
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ 
              title: 'しゃべるノート',
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
            name="Record" 
            component={RecordScreen} 
            options={{ 
              title: '音声録音',
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
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
