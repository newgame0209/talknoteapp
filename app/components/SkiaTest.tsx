import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';

/**
 * React Native Skiaの動作テスト用コンポーネント
 * 描画機能が正常に動作することを確認します
 */
export const SkiaTest: React.FC = () => {
  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        <Group>
          {/* 中央に赤い円を描画 */}
          <Circle cx={128} cy={128} r={40} color="red" />
          
          {/* 左上に青い円を描画 */}
          <Circle cx={64} cy={64} r={20} color="blue" />
          
          {/* 右下に緑の円を描画 */}
          <Circle cx={192} cy={192} r={30} color="green" />
        </Group>
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  canvas: {
    width: 256,
    height: 256,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
}); 