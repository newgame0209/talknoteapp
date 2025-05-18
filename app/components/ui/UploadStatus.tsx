import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LoadingSpinner from './LoadingSpinner';
import ProgressBar from './ProgressBar';

// アップロードの状態
export type UploadState = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

interface UploadStatusProps {
  state: UploadState;
  progress?: number;
  fileName?: string;
  fileSize?: number;
  totalSize?: number;
  message?: string;
  onCancel?: () => void;
  onRetry?: () => void;
}

/**
 * アップロード状態表示コンポーネント
 * ファイルのアップロード状態と進捗を表示
 */
export const UploadStatus: React.FC<UploadStatusProps> = ({
  state,
  progress = 0,
  fileName,
  fileSize,
  totalSize,
  message,
  onCancel,
  onRetry,
}) => {
  // 状態に応じたメッセージ
  const getStatusMessage = () => {
    if (message) return message;
    
    switch (state) {
      case 'uploading':
        return 'ファイルをアップロード中';
      case 'processing':
        return '処理中です。しばらくお待ちください...';
      case 'success':
        return 'アップロード完了';
      case 'error':
        return 'エラーが発生しました';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      {/* 状態メッセージ */}
      <Text style={styles.statusText}>{getStatusMessage()}</Text>
      
      {/* ローディングスピナー（アップロード中または処理中） */}
      {(state === 'uploading' || state === 'processing') && (
        <View style={styles.spinnerContainer}>
          <LoadingSpinner size={36} />
        </View>
      )}
      
      {/* プログレスバー（アップロード中） */}
      {state === 'uploading' && (
        <View style={styles.progressContainer}>
          <ProgressBar 
            progress={progress}
            fileInfo={{
              fileName,
              currentSize: fileSize ? fileSize * progress : undefined,
              totalSize,
            }}
            height={6}
            animated
          />
        </View>
      )}
      
      {/* アクションボタン */}
      <View style={styles.actionContainer}>
        {/* キャンセルボタン（アップロード中または処理中） */}
        {(state === 'uploading' || state === 'processing') && onCancel && (
          <TouchableOpacity 
            style={styles.button} 
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>キャンセル</Text>
          </TouchableOpacity>
        )}
        
        {/* リトライボタン（エラー時） */}
        {state === 'error' && onRetry && (
          <TouchableOpacity 
            style={[styles.button, styles.retryButton]} 
            onPress={onRetry}
            activeOpacity={0.7}
          >
            <Text style={[styles.buttonText, styles.retryButtonText]}>再試行</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  spinnerContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  progressContainer: {
    marginVertical: 12,
  },
  actionContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  retryButton: {
    backgroundColor: '#4F46E5',
  },
  retryButtonText: {
    color: '#FFFFFF',
  },
});

export default UploadStatus;
