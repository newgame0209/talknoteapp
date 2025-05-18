import React, { ReactNode, useEffect, useState } from 'react';
import { View, StyleSheet, Keyboard, Platform, Dimensions, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface KeyboardAwareLayoutProps {
  children: ReactNode;
  style?: object;
  contentContainerStyle?: object;
  bottomOffset?: number;
  onKeyboardShow?: () => void;
  onKeyboardHide?: () => void;
}

/**
 * キーボード表示時に自動的にコンテンツを調整するレイアウト
 * 主にフォーム入力や下部に固定UIがある画面で使用
 */
export const KeyboardAwareLayout: React.FC<KeyboardAwareLayoutProps> = ({
  children,
  style,
  contentContainerStyle,
  bottomOffset = 0,
  onKeyboardShow,
  onKeyboardHide,
}) => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // キーボード表示イベントのリスナー
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        onKeyboardShow?.();
      }
    );

    // キーボード非表示イベントのリスナー
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        onKeyboardHide?.();
      }
    );

    // クリーンアップ
    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [onKeyboardShow, onKeyboardHide]);

  // コンテンツの高さを計測
  const onContentLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setContentHeight(height);
  };

  // 画面の高さ
  const screenHeight = Dimensions.get('window').height;
  
  // キーボード表示時のパディング計算
  const paddingBottom = keyboardHeight > 0 
    ? keyboardHeight - insets.bottom + bottomOffset 
    : bottomOffset;

  // コンテンツがキーボードで隠れる場合のみパディングを適用
  const shouldApplyPadding = contentHeight + keyboardHeight > screenHeight;

  return (
    <View style={[styles.container, style]}>
      <View 
        style={[
          styles.contentContainer, 
          contentContainerStyle,
          shouldApplyPadding && { paddingBottom }
        ]}
        onLayout={onContentLayout}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
});

export default KeyboardAwareLayout;
