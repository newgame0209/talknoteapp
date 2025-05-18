import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, ViewStyle, DimensionValue } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0から1の間の値
  width?: DimensionValue;
  height?: number;
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  showPercentage?: boolean;
  animated?: boolean;
  label?: string;
  fileInfo?: {
    fileName?: string;
    currentSize?: number;
    totalSize?: number;
  };
}

/**
 * 進捗状況を表示するProgressBarコンポーネント
 * アップロードや処理の進行状況を視覚的に表示
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  width = '100%',
  height = 8,
  color = '#4F46E5', // プライマリーカラー
  backgroundColor = '#E5E7EB',
  borderRadius = 4,
  showPercentage = false,
  animated = true,
  label,
  fileInfo,
}) => {
  // アニメーション用のRef
  const progressAnim = useRef(new Animated.Value(0)).current;

  // 進捗が変わったらアニメーション
  useEffect(() => {
    if (animated) {
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(progress);
    }
  }, [progress, animated, progressAnim]);

  // 進捗バーの幅をアニメーション
  const width_anim = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  // パーセンテージ表示用
  const percentage = Math.round(progress * 100);

  // ファイルサイズの表示用
  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.container}>
      {/* ラベルとパーセンテージ */}
      {(label || showPercentage) && (
        <View style={styles.labelContainer}>
          {label && <Text style={styles.label}>{label}</Text>}
          {showPercentage && <Text style={styles.percentage}>{percentage}%</Text>}
        </View>
      )}

      {/* ファイル情報 */}
      {fileInfo && fileInfo.fileName && (
        <View style={styles.fileInfoContainer}>
          <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
            {fileInfo.fileName}
          </Text>
          {fileInfo.currentSize !== undefined && fileInfo.totalSize !== undefined && (
            <Text style={styles.fileSize}>
              {formatFileSize(fileInfo.currentSize)} / {formatFileSize(fileInfo.totalSize)}
            </Text>
          )}
        </View>
      )}

      {/* プログレスバー */}
      <View 
        style={[
          styles.progressContainer, 
          { 
            width: typeof width === 'string' ? width : width as number, 
            height, 
            backgroundColor, 
            borderRadius 
          }
        ]}
      >
        <Animated.View 
          style={[
            styles.progressBar, 
            { 
              width: width_anim, 
              height, 
              backgroundColor: color, 
              borderRadius 
            }
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  percentage: {
    fontSize: 14,
    color: '#6B7280',
  },
  fileInfoContainer: {
    marginBottom: 8,
  },
  fileName: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#6B7280',
  },
  progressContainer: {
    overflow: 'hidden',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
  },
});

export default ProgressBar;
