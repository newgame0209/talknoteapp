import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';

interface RulerProps {
  isVisible: boolean;
  x: number;
  y: number;
  rotation: number;
  canvasWidth: number;
  canvasHeight: number;
  onMove: (x: number, y: number) => void;
  onAngleAdjust: () => void;
}

const Ruler: React.FC<RulerProps> = ({
  isVisible,
  x,
  y,
  rotation,
  canvasWidth,
  canvasHeight,
  onMove,
  onAngleAdjust,
}) => {
  // 定規の長さ（キャンバス縦幅に合わせる）
  const rulerLength = canvasHeight;
  const rulerWidth = 60;

  // アニメーション用の値
  const translateX = useSharedValue(x);
  const translateY = useSharedValue(y);

  // ドラッグジェスチャー
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX + x;
      translateY.value = event.translationY + y;
    })
    .onEnd((event) => {
      runOnJS(onMove)(event.translationX + x, event.translationY + y);
    });

  // タップジェスチャー（角度調整）
  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(onAngleAdjust)();
    });

  // 定規のアニメーションスタイル
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation}deg` },
    ],
  }));

  // 目盛りを生成
  const generateRulerMarks = () => {
    const marks = [];
    const totalCm = Math.floor(rulerLength / 37.8); // 1cm ≈ 37.8px

    for (let i = 0; i <= totalCm; i++) {
      const position = i * 37.8;
      marks.push(
        <View key={i} style={[styles.rulerMark, { top: position }]}>
          <View style={styles.rulerLine} />
          <Text style={styles.rulerText}>{i}</Text>
        </View>
      );
    }
    return marks;
  };

  if (!isVisible) {
    return null;
  }

  return (
    <View style={styles.rulerContainer} pointerEvents="box-none">
      <GestureDetector gesture={Gesture.Simultaneous(panGesture, tapGesture)}>
        <Animated.View style={[styles.ruler, animatedStyle, { width: rulerWidth, height: rulerLength }]}>
          <View style={styles.rulerGradient}>
            {/* 目盛り表示 */}
            {generateRulerMarks()}
            
            {/* 角度調整ヒント */}
            <View style={styles.angleHint}>
              <Text style={styles.angleText}>{rotation}°</Text>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  rulerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000, // 最前面に表示
  },
  ruler: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A0845C',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    opacity: 0.7, // 半透明
  },
  rulerGradient: {
    flex: 1,
    backgroundColor: '#D4AF85', // 木製定規風の色
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  rulerMark: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rulerLine: {
    width: 20,
    height: 1,
    backgroundColor: '#5A4A3A',
  },
  rulerText: {
    fontSize: 10,
    color: '#5A4A3A',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  angleHint: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  angleText: {
    fontSize: 10,
    color: '#5A4A3A',
    fontWeight: 'bold',
  },
});

export default Ruler; 