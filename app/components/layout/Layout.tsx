import React, { ReactNode } from 'react';
import { View, StyleSheet, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LayoutProps {
  children: ReactNode;
  style?: object;
  keyboardVerticalOffset?: number;
  statusBarStyle?: 'dark-content' | 'light-content';
  statusBarColor?: string;
  disableKeyboardAvoiding?: boolean;
  disableSafeArea?: boolean;
}

/**
 * 基本レイアウトコンポーネント
 * SafeAreaとKeyboardAvoidingを組み合わせたレイアウト
 */
export const Layout: React.FC<LayoutProps> = ({
  children,
  style,
  keyboardVerticalOffset = 0,
  statusBarStyle = 'dark-content',
  statusBarColor = 'transparent',
  disableKeyboardAvoiding = false,
  disableSafeArea = false,
}) => {
  // 基本コンテンツ
  const content = (
    <View style={[styles.container, style]}>
      <StatusBar 
        barStyle={statusBarStyle} 
        backgroundColor={statusBarColor}
        translucent
      />
      {children}
    </View>
  );

  // SafeAreaを適用するかどうか
  const safeAreaContent = disableSafeArea ? (
    content
  ) : (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'left']}>
      {content}
    </SafeAreaView>
  );

  // KeyboardAvoidingViewを適用するかどうか
  return disableKeyboardAvoiding ? (
    safeAreaContent
  ) : (
    <KeyboardAvoidingView
      style={styles.keyboardAvoiding}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {safeAreaContent}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA', // アプリ全体の背景色
  },
  container: {
    flex: 1,
  },
});

export default Layout;
