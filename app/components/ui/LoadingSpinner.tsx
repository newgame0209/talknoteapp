import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, ViewStyle } from 'react-native';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  thickness?: number;
  style?: ViewStyle;
  speed?: number; // 回転速度（ミリ秒）
}

/**
 * ローディングスピナーコンポーネント
 * 処理中やアップロード中の表示に使用
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 40,
  color = '#4F46E5', // プライマリーカラー
  thickness = 3,
  style,
  speed = 1000,
}) => {
  // アニメーション用のRef
  const spinAnim = useRef(new Animated.Value(0)).current;

  // コンポーネントがマウントされたらアニメーション開始
  useEffect(() => {
    // 無限ループのアニメーション
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: speed,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // クリーンアップ
    return () => {
      spinAnim.stopAnimation();
    };
  }, [spinAnim, speed]);

  // 回転アニメーション
  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.spinner,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: thickness,
            borderColor: `${color}20`, // 薄い色
            borderTopColor: color, // トップの色だけ濃い
            transform: [{ rotate: spin }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    borderStyle: 'solid',
  },
});

export default LoadingSpinner;
