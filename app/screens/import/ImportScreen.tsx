import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Layout from '../../components/layout/Layout';
import UploadStatus from '../../components/ui/UploadStatus';
import { mediaApi } from '../../services/api';

// サポートするファイル形式
const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'image/jpeg',
  'image/png',
  'image/heic',
];

// 最大ファイルサイズ (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// チャンクサイズ (5MB)
const CHUNK_SIZE = 5 * 1024 * 1024;

/**
 * インポート画面
 * ファイルのインポートと処理機能を提供
 */
const ImportScreen: React.FC = () => {
  const navigation = useNavigation();
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    uri: string;
    type: string;
    size: number;
  } | null>(null);
  const [processingMessage, setProcessingMessage] = useState('');

  // ファイル選択
  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: SUPPORTED_FILE_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      const fileInfo = await FileSystem.getInfoAsync(file.uri, { size: true });

      // ファイルサイズチェック
      if (fileInfo.exists && fileInfo.size && fileInfo.size > MAX_FILE_SIZE) {
        Alert.alert(
          'ファイルサイズエラー',
          `ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。`,
          [{ text: 'OK' }]
        );
        return;
      }

      setSelectedFile({
        name: file.name,
        uri: file.uri,
        type: file.mimeType || 'application/octet-stream',
        size: fileInfo.exists && fileInfo.size ? fileInfo.size : 0,
      });
    } catch (error) {
      console.error('ファイル選択エラー:', error);
      Alert.alert('エラー', 'ファイルの選択中にエラーが発生しました。');
    }
  }, []);

  // ファイルアップロード
  const uploadFile = useCallback(async () => {
    if (!selectedFile) return;

    try {
      setUploadState('uploading');
      setProgress(0);
      setProcessingMessage('ちょっと待ってね！ファイルを処理中です♪');

      // ファイルサイズに基づいてチャンク数を計算
      const totalChunks = Math.ceil(selectedFile.size / CHUNK_SIZE);
      
      // アップロードURLを取得
      const uploadUrlResponse = await mediaApi.getUploadUrl(
        selectedFile.type,
        selectedFile.size,
        CHUNK_SIZE,
        totalChunks
      );
      
      const mediaId = uploadUrlResponse.media_id;
      
      // ファイルを読み込み
      const fileContent = await FileSystem.readAsStringAsync(selectedFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // チャンクに分割してアップロード
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
        const chunkSize = end - start;
        
        // Base64文字列からチャンクを抽出
        const chunkBase64 = fileContent.substring(
          Math.floor(start * 4 / 3),
          Math.ceil(end * 4 / 3)
        );
        
        // Base64をBlobに変換
        const byteCharacters = atob(chunkBase64);
        const byteArrays = [];
        for (let j = 0; j < byteCharacters.length; j++) {
          byteArrays.push(byteCharacters.charCodeAt(j));
        }
        const byteArray = new Uint8Array(byteArrays);
        const blob = new Blob([byteArray], { type: selectedFile.type });
        
        // チャンクをアップロード
        await mediaApi.uploadChunk(mediaId, i, totalChunks, blob);
        
        // 進捗を更新
        const newProgress = (i + 1) / totalChunks;
        setProgress(newProgress);
      }
      
      // アップロード完了を通知
      await mediaApi.completeUpload(mediaId, totalChunks, selectedFile.size);
      
      // 処理状態に移行
      setUploadState('processing');
      setProcessingMessage('処理中です。しばらくお待ちください...');
      
      // 処理状態をポーリング
      const checkStatus = async () => {
        try {
          const statusResponse = await mediaApi.getStatus(mediaId);
          
          if (statusResponse.status === 'completed') {
            setUploadState('success');
            // 成功時の処理（例：編集画面への遷移）
            // navigation.navigate('EditNote', { mediaId });
          } else if (statusResponse.status === 'failed') {
            setUploadState('error');
            Alert.alert('エラー', 'ファイルの処理に失敗しました。');
          } else {
            // まだ処理中の場合は再度チェック
            setTimeout(checkStatus, 2000);
          }
        } catch (error) {
          console.error('ステータスチェックエラー:', error);
          setUploadState('error');
          Alert.alert('エラー', 'ファイルの処理状態の確認中にエラーが発生しました。');
        }
      };
      
      // 初回のステータスチェック
      setTimeout(checkStatus, 2000);
      
    } catch (error) {
      console.error('アップロードエラー:', error);
      setUploadState('error');
      Alert.alert('エラー', 'ファイルのアップロード中にエラーが発生しました。');
    }
  }, [selectedFile, navigation]);

  // アップロードキャンセル
  const cancelUpload = useCallback(() => {
    setUploadState('idle');
    setProgress(0);
    setProcessingMessage('');
  }, []);

  // アップロード再試行
  const retryUpload = useCallback(() => {
    uploadFile();
  }, [uploadFile]);

  return (
    <Layout statusBarStyle="dark-content">
      <View style={styles.container}>
        <StatusBar style="dark" />
        
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <FontAwesome5 name="arrow-left" size={16} color="#4B5563" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ファイルインポート</Text>
          <View style={styles.placeholder} />
        </View>
        
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
        >
          {uploadState === 'idle' ? (
            <>
              {/* AIアシスタント */}
              <View style={styles.assistantContainer}>
                <Image
                  source={require('../../assets/ai_assistant.png')}
                  style={styles.assistantImage}
                  defaultSource={require('../../assets/ai_assistant.png')}
                />
                <View style={styles.messageBubble}>
                  <Text style={styles.messageText}>
                    インポートしたいファイルを選んでください。
                    PDFや音声ファイル、画像などに対応しています。
                  </Text>
                </View>
              </View>
              
              {/* ファイル選択エリア */}
              <View style={styles.filePickerContainer}>
                {selectedFile ? (
                  <View style={styles.selectedFileContainer}>
                    <View style={styles.fileIconContainer}>
                      <FontAwesome5 
                        name={getFileIcon(selectedFile.type)} 
                        size={24} 
                        color="#4F46E5" 
                      />
                    </View>
                    <View style={styles.fileInfoContainer}>
                      <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                        {selectedFile.name}
                      </Text>
                      <Text style={styles.fileSize}>
                        {formatFileSize(selectedFile.size)}
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.removeButton}
                      onPress={() => setSelectedFile(null)}
                    >
                      <FontAwesome5 name="times" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.pickButton}
                    onPress={pickDocument}
                  >
                    <FontAwesome5 name="file-upload" size={24} color="#4F46E5" />
                    <Text style={styles.pickButtonText}>ファイルを選択</Text>
                    <Text style={styles.pickButtonSubtext}>
                      PDF, 音声, 画像ファイルに対応
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* インポートボタン */}
              {selectedFile && (
                <TouchableOpacity 
                  style={styles.importButton}
                  onPress={uploadFile}
                >
                  <Text style={styles.importButtonText}>インポート開始</Text>
                </TouchableOpacity>
              )}
              
              {/* サポートするファイル形式 */}
              <View style={styles.supportedFormatsContainer}>
                <Text style={styles.supportedFormatsTitle}>サポートするファイル形式</Text>
                <View style={styles.formatsList}>
                  <FormatItem icon="file-pdf" label="PDF" />
                  <FormatItem icon="file-audio" label="MP3, WAV" />
                  <FormatItem icon="file-image" label="JPG, PNG" />
                </View>
              </View>
            </>
          ) : (
            <View style={styles.uploadStatusContainer}>
              {/* AIアシスタント（アップロード中） */}
              <View style={styles.assistantContainer}>
                <Image
                  source={require('../../assets/ai_assistant.png')}
                  style={styles.assistantImage}
                  defaultSource={require('../../assets/ai_assistant.png')}
                />
                <View style={styles.messageBubble}>
                  <Text style={styles.messageText}>{processingMessage}</Text>
                </View>
              </View>
              
              {/* アップロードステータス */}
              <UploadStatus
                state={uploadState}
                progress={progress}
                fileName={selectedFile?.name}
                fileSize={selectedFile ? Math.floor(selectedFile.size * progress) : 0}
                totalSize={selectedFile?.size}
                onCancel={cancelUpload}
                onRetry={retryUpload}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </Layout>
  );
};

// ファイル形式アイテム
const FormatItem: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <View style={styles.formatItem}>
    <FontAwesome5 name={icon} size={16} color="#4F46E5" />
    <Text style={styles.formatLabel}>{label}</Text>
  </View>
);

// ファイルタイプに基づいてアイコンを取得
const getFileIcon = (fileType: string): string => {
  if (fileType.includes('pdf')) return 'file-pdf';
  if (fileType.includes('audio')) return 'file-audio';
  if (fileType.includes('image')) return 'file-image';
  return 'file';
};

// ファイルサイズのフォーマット
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  assistantContainer: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  assistantImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  messageBubble: {
    flex: 1,
    backgroundColor: '#E0F2FE',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 12,
    marginLeft: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#0C4A6E',
    lineHeight: 20,
  },
  filePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: 16,
    marginBottom: 16,
  },
  pickButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  pickButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
    marginTop: 8,
  },
  pickButtonSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  selectedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileInfoContainer: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#6B7280',
  },
  removeButton: {
    padding: 8,
  },
  importButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  supportedFormatsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  supportedFormatsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  formatsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  formatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  formatLabel: {
    fontSize: 12,
    color: '#4B5563',
    marginLeft: 4,
  },
  uploadStatusContainer: {
    flex: 1,
  },
});

export default ImportScreen;