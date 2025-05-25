import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
  const DUMMY_UPLOAD_URL = 'https://httpbin.org/put'; // テスト用のエンドポイント
  
  // アップロードタスクの参照
  const uploadTaskRef = useRef<string | null>(null);

  useEffect(() => {
    if (!route.params?.file) {
      setErrorMessage('ファイル情報がありません');
      return;
    }

    const file = route.params.file;
    setTotalBytes(file.size);

    // 実際のアップロード処理
    startUpload(file);
    
    // クリーンアップ関数
    return () => {
      // アップロードタスクのキャンセルは必要ならここに追加
    };
  }, []);

  // 実際のアップロード処理
  const startUpload = async (file: ImportProgressParams['file']) => {
    try {
      // 本来はここでバックエンドからSignedURLを取得
      // const response = await fetch('https://api.example.com/media/upload-url', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ filename: file.name, contentType: file.type })
      // });
      // const { signedUrl } = await response.json();
      
      // テスト用のダミーURL
      const signedUrl = DUMMY_UPLOAD_URL;
      
      // 実際のアップロード処理
      const uploadResult = await FileSystem.uploadAsync(signedUrl, file.uri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': file.type },
      });
      
      // 進捗をシミュレート（実際のアップロードは一瞬で完了するため）
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 0.02;
        if (currentProgress >= 1) {
          clearInterval(interval);
          setProgress(1);
          setUploadedBytes(file.size);
          setIsUploading(false);
          
          // アップロード完了後、ノート作成に遷移
          setTimeout(() => {
            const noteId = 'import_' + Date.now();
            navigation.replace('CanvasEditor', { noteId });
          }, 1500);
        } else {
          setProgress(currentProgress);
          setUploadedBytes(Math.floor(file.size * currentProgress));
        }
      }, 100);
      
      // アップロード完了
      setIsUploading(false);
      setProgress(1);
      
      // アップロード完了後、ノート作成（実際にはバックエンドAPIを呼び出す）
      setTimeout(() => {
        // 仮のノートID
        const noteId = 'import_' + Date.now();
        navigation.replace('CanvasEditor', { noteId });
      }, 1500);
      
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
            // アップロードキャンセル処理
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
      <StatusBar barStyle="dark-content" />

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
            <View style={styles.aiCharacterContainer}>
              <Image 
                source={require('../../assets/ai_assistant2.png')} 
                style={styles.aiCharacterImage} 
              />
            </View>
            
            <View style={styles.messageContainer}>
              <Text style={styles.messageText}>
                ちょっと待ってね！ファイルを処理中です♪
              </Text>
            </View>

            <Text style={styles.statusText}>
              {isUploading ? 'ファイルをアップロード中' : '処理完了'}
            </Text>

            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#589ff4" style={styles.loader} />
            </View>

            <Text style={styles.processingText}>
              {isUploading ? '処理中です。しばらくお待ちください...' : 'ノートを準備しています...'}
            </Text>

            {route.params?.file && (
              <View style={styles.fileInfoContainer}>
                <View style={styles.fileInfo}>
                  <MaterialCommunityIcons
                    name={
                      route.params.file.type.includes('pdf')
                        ? 'file-pdf-box'
                        : route.params.file.type.includes('image')
                        ? 'file-image'
                        : route.params.file.type.includes('audio')
                        ? 'file-music'
                        : 'file-document'
                    }
                    size={24}
                    color="#589ff4"
                  />
                  <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                    {route.params.file.name}
                  </Text>
                </View>

                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                </View>
                
                <View style={styles.progressInfoContainer}>
                  <Text style={styles.progressPercentage}>{Math.round(progress * 100)}%</Text>
                  <Text style={styles.progressText}>
                    {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
                  </Text>
                </View>


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
    paddingTop: 60, // iPhoneのステータスバー対応
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageContainer: {
    backgroundColor: '#EBF5FF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
  },
  messageText: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 22,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 24,
    textAlign: 'center',
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
  aiCharacterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  aiCharacterImage: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
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
    backgroundColor: '#589ff4',
    borderRadius: 4,
  },
  progressInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginTop: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#4B5563',
    fontWeight: '500',
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
