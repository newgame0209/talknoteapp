import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';
// Skiaのインポートを修正
// import { Canvas } from '@shopify/react-native-skia';

// NativeWindの設定
import 'nativewind';

// 一時的なプレースホルダー画面
const PlaceholderScreen = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
    <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#4F46E5' }}>しゃべるノート</Text>
    <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 8 }}>開発中...</Text>
    <StatusBar style="auto" />
  </View>
);

// ナビゲーションスタックの型定義
type RootStackParamList = {
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen 
            name="Home" 
            component={PlaceholderScreen} 
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
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
