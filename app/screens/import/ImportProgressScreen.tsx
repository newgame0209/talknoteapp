import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as FileSystem from 'expo-file-system';

// 仮のパラメータ型
type ImportProgressParams = {
  file: {
    name: string;
    uri: string;
    type: string;
    size: number;
  };
};

type ImportProgressRouteProp = RouteProp<{ ImportProgress: ImportProgressParams }, 'ImportProgress'>;

const ImportProgressScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<ImportProgressRouteProp>();
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(true);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 仮のアップロードURL（実際にはバックエンドから取得）
  const DUMMY_UPLOAD_URL = 'https://example.com/upload';

  useEffect(() => {
    if (!route.params?.file) {
      setErrorMessage('ファイル情報がありません');
      return;
    }

    const file = route.params.file;
    setTotalBytes(file.size);

    // 実際のアップロード処理（現在はダミー）
    simulateUpload(file);
  }, []);

  // ダミーアップロード処理（実際にはSignedURLを使用）
  const simulateUpload = async (file: ImportProgressParams['file']) => {
    try {
      // 本来はここでバックエンドからSignedURLを取得
      // const response = await fetch('https://api.example.com/media/upload-url', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ filename: file.name, contentType: file.type })
      // });
      // const { signedUrl } = await response.json();

      // 進捗を模擬
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 0.01;
        if (currentProgress >= 1) {
          clearInterval(interval);
          setIsUploading(false);
          setProgress(1);
          setUploadedBytes(file.size);
          
          // アップロード完了後、ノート作成（実際にはバックエンドAPIを呼び出す）
          setTimeout(() => {
            // 仮のノートID
            const noteId = 'import_' + Date.now();
            navigation.replace('CanvasEditor', { noteId });
          }, 1000);
        } else {
          setProgress(currentProgress);
          setUploadedBytes(Math.floor(file.size * currentProgress));
        }
      }, 100);

      // 実際のアップロード処理は以下のようになる
      // const uploadResult = await FileSystem.uploadAsync(signedUrl, file.uri, {
      //   httpMethod: 'PUT',
      //   uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      //   headers: { 'Content-Type': file.type },
      //   sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
      //   uploadTaskCallback: (data) => {
      //     const currentProgress = data.totalBytesWritten / data.totalBytesExpectedToWrite;
      //     setProgress(currentProgress);
      //     setUploadedBytes(data.totalBytesWritten);
      //   },
      // });
    } catch (error) {
      console.error('アップロードエラー:', error);
      setErrorMessage('ファイルのアップロード中にエラーが発生しました');
      setIsUploading(false);
    }
  };

  // アップロードをキャンセル
  const cancelUpload = () => {
    Alert.alert(
      'アップロードをキャンセル',
      'アップロードをキャンセルしますか？',
      [
        {
          text: 'いいえ',
          style: 'cancel',
        },
        {
          text: 'はい',
          onPress: () => {
            // 実際のキャンセル処理
            // FileSystem.cancelUploadAsync(uploadTaskId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  // バイト数を読みやすい形式に変換
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ファイルインポート</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {errorMessage ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.retryButtonText}>戻る</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.messageContainer}>
              <View style={styles.robotIcon}>
                <Ionicons name="happy-outline" size={32} color="#4F46E5" />
              </View>
              <Text style={styles.messageText}>
                {isUploading
                  ? 'ちょっと待ってね！ファイルを処理中です♪'
                  : 'ファイルの処理が完了しました！'}
              </Text>
            </View>

            <Text style={styles.statusText}>
              {isUploading ? 'ファイルをアップロード中' : '処理完了'}
            </Text>

            <View style={styles.loaderContainer}>
              {isUploading ? (
                <ActivityIndicator size="large" color="#4F46E5" style={styles.loader} />
              ) : (
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              )}
            </View>

            <Text style={styles.processingText}>
              {isUploading ? '処理中です。しばらくお待ちください...' : 'ノートを準備しています...'}
            </Text>

            {route.params?.file && (
              <View style={styles.fileInfoContainer}>
                <View style={styles.fileInfo}>
                  <Ionicons
                    name={
                      route.params.file.type.includes('pdf')
                        ? 'document'
                        : route.params.file.type.includes('image')
                        ? 'image'
                        : 'document-text'
                    }
                    size={24}
                    color="#6B7280"
                  />
                  <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                    {route.params.file.name}
                  </Text>
                </View>

                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                </View>

                <Text style={styles.progressText}>
                  {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
                </Text>
              </View>
            )}

            {isUploading && (
              <TouchableOpacity style={styles.cancelButton} onPress={cancelUpload}>
                <Text style={styles.cancelButtonText}>キャンセル</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    backgroundColor: '#EBF4FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
    width: '100%',
  },
  robotIcon: {
    width: 40,
    height: 40,
    marginRight: 12,
    backgroundColor: '#EBF4FF',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 22,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 24,
  },
  loaderContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginVertical: 8,
  },
  processingText: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 32,
    textAlign: 'center',
  },
  fileInfoContainer: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  fileName: {
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 8,
    flex: 1,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#4B5563',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

export default ImportProgressScreen;
