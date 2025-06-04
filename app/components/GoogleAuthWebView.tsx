import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';

interface GoogleAuthWebViewProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (idToken: string) => void;
  onError: (error: Error) => void;
}

/**
 * WebViewベースのGoogle認証コンポーネント
 * Expo Go対応、ExpoWebBrowserエラーを回避
 */
const GoogleAuthWebView: React.FC<GoogleAuthWebViewProps> = ({
  visible,
  onClose,
  onSuccess,
  onError,
}) => {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  // Google OAuth設定
  const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
  const REDIRECT_URI = 'https://developers.google.com/oauthplayground'; // 開発用の確実なURI

  // Google OAuth認証URLを構築
  const buildAuthUrl = (): string => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code', // codeに変更（id_tokenは直接取得困難）
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  // WebViewの状態変化を監視
  const handleWebViewNavigationStateChange = (navState: any) => {
    const { url } = navState;
    console.log('🌐 WebView URL:', url);

    // OAuth playgroundへのリダイレクトを検出
    if (url.includes('developers.google.com/oauthplayground') && url.includes('code=')) {
      try {
        const urlObj = new URL(url);
        const authCode = urlObj.searchParams.get('code');

        if (authCode) {
          console.log('✅ Google認証コード取得成功');
          exchangeCodeForToken(authCode);
        } else {
          throw new Error('認証コードが見つかりません');
        }
      } catch (error: any) {
        console.error('❌ 認証コード抽出エラー:', error);
        onError(new Error('認証情報の取得に失敗しました'));
        onClose();
      }
    }

    // Google承認ページの検出（手動コピー用）
    if (url.includes('accounts.google.com/o/oauth2/approval') || 
        url.includes('oauthplayground') && !url.includes('code=')) {
      // ユーザーに手動でコードをコピーするよう促す
      webViewRef.current?.injectJavaScript(`
        (function() {
          const codeElements = document.querySelectorAll('input, textarea, code, pre');
          for (let element of codeElements) {
            if (element.value && element.value.length > 10) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'authCode',
                code: element.value
              }));
              break;
            }
            if (element.textContent && element.textContent.length > 10) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'authCode',
                code: element.textContent.trim()
              }));
              break;
            }
          }
        })();
        true;
      `);
    }

    // エラーの場合
    if (url.includes('error=')) {
      const urlObj = new URL(url);
      const error = urlObj.searchParams.get('error');
      const errorDescription = urlObj.searchParams.get('error_description');
      
      console.error('❌ Google認証エラー:', error, errorDescription);
      onError(new Error(errorDescription || 'Google認証に失敗しました'));
      onClose();
    }
  };

  // WebViewからのメッセージを処理
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'authCode' && data.code) {
        console.log('✅ JavaScript経由で認証コード取得');
        exchangeCodeForToken(data.code);
      }
    } catch (error) {
      console.warn('WebViewメッセージ処理エラー:', error);
    }
  };

  // 認証コードをIDトークンに交換
  const exchangeCodeForToken = async (authCode: string) => {
    try {
      console.log('🔄 認証コードをIDトークンに交換中...');
      
      // 一時的にmock IDトークンを生成（開発用）
      // 実際の実装では、バックエンドAPIを通じて安全にトークン交換を行う
      const mockIdToken = btoa(JSON.stringify({
        iss: 'https://accounts.google.com',
        aud: GOOGLE_CLIENT_ID,
        sub: 'mock-user-id',
        email: 'test@gmail.com',
        name: 'Test User',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }));
      
      console.log('✅ IDトークン生成完了（開発用）');
      onSuccess(`header.${mockIdToken}.signature`);
      onClose();
      
    } catch (error: any) {
      console.error('❌ トークン交換エラー:', error);
      onError(new Error('認証の最終処理に失敗しました'));
      onClose();
    }
  };

  // WebView読み込み完了
  const handleWebViewLoad = () => {
    setLoading(false);
  };

  // エラーハンドリング
  const handleWebViewError = (event: any) => {
    console.error('❌ WebViewエラー:', event.nativeEvent);
    onError(new Error('認証画面の読み込みに失敗しました'));
    onClose();
  };

  // 認証URLが正しく設定されているかチェック
  if (!GOOGLE_CLIENT_ID) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Google Client IDが設定されていません
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>キャンセル</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Googleでログイン</Text>
          <View style={styles.spacer} />
        </View>

        {/* WebView */}
        <View style={styles.webViewContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4285F4" />
              <Text style={styles.loadingText}>認証画面を読み込み中...</Text>
            </View>
          )}
          
          <WebView
            ref={webViewRef}
            source={{ uri: buildAuthUrl() }}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            onMessage={handleWebViewMessage}
            onLoadEnd={handleWebViewLoad}
            onError={handleWebViewError}
            style={[styles.webView, loading && styles.hidden]}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={false}
            scalesPageToFit={true}
            userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
          />
        </View>
      </SafeAreaView>
    </Modal>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  spacer: {
    width: 80, // cancelButtonと同じ幅でバランス調整
  },
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  hidden: {
    opacity: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GoogleAuthWebView; 