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
import { importApi } from '../../services/api';
import { UniversalNoteService } from '../../services/UniversalNoteService';

// 新しいパラメータ型定義
type ImportProgressParams = {
  importId: string;
  importType: 'url' | 'file';
  source: string;
  file?: {
    name: string;
    uri: string;
    type: string;
    size: number;
  };
};

type ImportProgressRouteProp = RouteProp<{ ImportProgress: ImportProgressParams }, 'ImportProgress'>;

interface ImportStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  error?: string;
  result?: {
    note_id: string;
    title: string;
    total_pages: number;
  };
}

const ImportProgressScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<ImportProgressRouteProp>();
  const [status, setStatus] = useState<ImportStatus>({
    status: 'pending',
    progress: 0
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const navigationDoneRef = useRef<boolean>(false); // 🚨 二重遷移防止フラグ

  useEffect(() => {
    if (!route.params?.importId) {
      setErrorMessage('インポートIDがありません');
      return;
    }

    // インポート進捗の監視を開始
    startProgressPolling(route.params.importId);
    
    // クリーンアップ関数
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // インポート進捗の監視
  const startProgressPolling = async (importId: string) => {
    try {
      // 最初に一度チェック
      await checkImportStatus(importId);

      // 2秒間隔で進捗をポーリング
      pollingIntervalRef.current = setInterval(async () => {
        await checkImportStatus(importId);
      }, 2000);

    } catch (error) {
      console.error('❌ 進捗監視エラー:', error);
      setErrorMessage('進捗の監視中にエラーが発生しました');
    }
  };

  // インポート状況をチェック
  const checkImportStatus = async (importId: string) => {
    try {
      const statusResponse = await importApi.getImportStatus(importId);
      console.log('📊 インポート進捗:', statusResponse);

      setStatus(statusResponse);

      // 完了または失敗した場合はポーリングを停止
      if (statusResponse.status === 'completed') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }

        // 結果を取得してノート画面に遷移（AIタイトル生成フォールバック付き）
        setTimeout(async () => {
          try {
            const resultResponse = await importApi.getImportResultWithFallback(importId);
            console.log('📄 インポート結果（フォールバック付き）:', resultResponse);
            
            // 🔍 デバッグ：インポート結果の詳細構造を確認
            console.log('🔍 デバッグ - インポート結果詳細:');
            console.log('  - note_id:', resultResponse.note_id);
            console.log('  - title:', resultResponse.title);
            console.log('  - total_pages:', resultResponse.total_pages);
            console.log('  - pages配列:', resultResponse.pages);
            if (resultResponse.pages && resultResponse.pages.length > 0) {
              resultResponse.pages.forEach((page: any, index: number) => {
                console.log(`  - ページ${index + 1}:`, {
                  page_number: page.page_number,
                  text_length: page.text_length,
                  text_preview: page.text ? page.text.substring(0, 100) + '...' : '(空)',
                  has_text: !!page.text
                });
              });
            }

            if (resultResponse.note_id && resultResponse.title && resultResponse.pages) {
              // フォールバックタイトル生成の通知
              if (resultResponse.fallback_title_generated) {
                console.log('🤖 フォールバックでタイトル生成しました:', resultResponse.title);
              }
              
              // 🔥 UniversalNoteServiceでフロントエンドにノートを作成
              console.log('📝 フロントエンドでノート作成開始...');
              const universalNoteService = new UniversalNoteService();
              const createdNote = await universalNoteService.createNoteFromImport(resultResponse);
              
              if (!createdNote) {
                throw new Error('ノートの作成に失敗しました');
              }
              
              console.log('✅ ノート作成完了:', createdNote.id);
              
              // 🚨 CRITICAL: 二重遷移防止 - 一度だけ実行
              if (navigationDoneRef.current) {
                console.log('🚫 遷移は既に実行済み - スキップ');
                return;
              }
              navigationDoneRef.current = true;
              
              // 作成されたノートのIDでCanvasEditorに遷移
              navigation.replace('CanvasEditor', { 
                noteId: createdNote.id,
                noteType: 'import'
              });
            } else {
              console.error('❌ インポート結果が不完全:', resultResponse);
              setErrorMessage('ノートの作成に失敗しました');
            }
          } catch (error) {
            console.error('❌ 結果取得エラー:', error);
            setErrorMessage('インポート結果の取得に失敗しました');
          }
        }, 1500);

      } else if (statusResponse.status === 'failed') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
        setErrorMessage(statusResponse.error || 'インポート処理に失敗しました');
      }

    } catch (error) {
      console.error('❌ 状況チェックエラー:', error);
      setErrorMessage('インポート状況の確認中にエラーが発生しました');
    }
  };

  // インポートをキャンセル
  const cancelImport = () => {
    Alert.alert(
      'インポートをキャンセル',
      'インポート処理をキャンセルしますか？',
      [
        {
          text: 'いいえ',
          style: 'cancel',
        },
        {
          text: 'はい',
          onPress: () => {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  // ステータスメッセージの生成
  const getStatusMessage = () => {
    switch (status.status) {
      case 'pending':
        return 'インポート処理を開始しています...';
      case 'processing':
        return status.message || 'ファイルを処理中です...';
      case 'completed':
        return 'インポートが完了しました！';
      case 'failed':
        return 'インポート処理に失敗しました';
      default:
        return '処理中です...';
    }
  };

  // アイコンの選択
  const getFileIcon = () => {
    if (route.params?.importType === 'url') {
      return 'web';
    }
    
    if (route.params?.file?.type) {
      const fileType = route.params.file.type;
      if (fileType.includes('pdf')) return 'file-pdf-box';
      if (fileType.includes('image')) return 'file-image';
      if (fileType.includes('audio')) return 'file-music';
      if (fileType.includes('text')) return 'file-document-outline';
    }
    
    return 'file-document';
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
                {getStatusMessage()}
              </Text>
            </View>

            <Text style={styles.statusText}>
              {status.status === 'processing' ? 'ファイルをアップロード中' : '処理完了'}
            </Text>

            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#589ff4" style={styles.loader} />
            </View>

            <Text style={styles.processingText}>
              {status.status === 'processing' ? '処理中です。しばらくお待ちください...' : 'ノートを準備しています...'}
            </Text>

            <View style={styles.fileInfoContainer}>
              <View style={styles.fileInfo}>
                <MaterialCommunityIcons
                  name={getFileIcon()}
                  size={24}
                  color="#589ff4"
                />
                <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                  {route.params?.importType === 'url' 
                    ? route.params.source
                    : route.params?.file?.name || route.params?.source || 'ファイル'}
                </Text>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${status.progress * 100}%` }]} />
              </View>
              
              <View style={styles.progressInfoContainer}>
                <Text style={styles.progressPercentage}>{Math.round(status.progress * 100)}%</Text>
                <Text style={styles.progressText}>
                  {route.params?.importType === 'url' 
                    ? 'URLからインポート中' 
                    : route.params?.file?.size ? formatBytes(route.params.file.size) : 'ファイルサイズ不明'}
                </Text>
              </View>
            </View>

            {status.status === 'processing' && (
              <TouchableOpacity style={styles.cancelButton} onPress={cancelImport}>
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
