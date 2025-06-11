import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../store/authStore';
import { Platform } from 'react-native';

// WebBrowserセッション完了ハンドラー
WebBrowser.maybeCompleteAuthSession();

/**
 * Google Sign-Inのヘルパー関数
 * WebBrowser方式での認証を実装
 */

// Google OAuth設定
const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
  scopes: ['openid', 'profile', 'email'],
  redirectUri: 'com.talknote.app://oauth',
};

/**
 * Google OAuth認証URLを構築
 */
const buildGoogleAuthUrl = (): string => {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CONFIG.clientId,
    redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
    response_type: 'id_token',
    scope: GOOGLE_OAUTH_CONFIG.scopes.join(' '),
    nonce: Math.random().toString(36).substring(2, 15),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

/**
 * URLからIDトークンを抽出
 */
const extractIdTokenFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    
    // ハッシュフラグメントからid_tokenを取得
    const fragment = urlObj.hash.substring(1);
    const params = new URLSearchParams(fragment);
    const idToken = params.get('id_token');
    
    console.log('🔍 URL解析結果:', {
      hasFragment: !!urlObj.hash,
      hasIdToken: !!idToken,
      tokenLength: idToken?.length || 0
    });
    
    return idToken;
  } catch (error) {
    console.error('❌ URL解析エラー:', error);
    return null;
  }
};

/**
 * Google Sign-Inを実行
 */
export const signInWithGoogle = async (): Promise<void> => {
  try {
    console.log('🔵 Google Sign-In開始');
    
    // 設定確認
    if (!GOOGLE_OAUTH_CONFIG.clientId || GOOGLE_OAUTH_CONFIG.clientId === 'YOUR_GOOGLE_CLIENT_ID') {
      throw new Error('Google Client IDが設定されていません。環境変数EXPO_PUBLIC_GOOGLE_CLIENT_IDを確認してください。');
    }

    const authUrl = buildGoogleAuthUrl();
    console.log('🔗 Google認証URL構築完了');

    // WebBrowserで認証画面を開く
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      GOOGLE_OAUTH_CONFIG.redirectUri,
      {
        showInRecents: false,
      }
    );

    console.log('🔵 Google認証レスポンス:', {
      type: result.type,
      hasUrl: !!(result as any).url
    });

    if (result.type === 'success') {
      const responseUrl = (result as any).url;
      const idToken = extractIdTokenFromUrl(responseUrl);

      if (!idToken) {
        throw new Error('Google認証からIDトークンを取得できませんでした');
      }

      console.log('🎫 Google IDトークン取得成功');

      // AuthStoreでGoogle認証を実行
      const { signInWithGoogle: storeSignInWithGoogle } = useAuthStore.getState();
      await storeSignInWithGoogle(idToken);

      console.log('✅ Google認証 & Firebase連携完了');
    } else if (result.type === 'cancel') {
      console.log('🔧 ユーザーがGoogle認証をキャンセルしました');
    } else {
      throw new Error('Google認証が予期しない結果で終了しました');
    }
  } catch (error: any) {
    console.error('❌ Google認証エラー:', error);
    throw error;
  }
};

/**
 * Google認証が利用可能かチェック
 */
export const isGoogleAuthAvailable = (): boolean => {
  const hasClientId = GOOGLE_OAUTH_CONFIG.clientId && 
                     GOOGLE_OAUTH_CONFIG.clientId !== 'YOUR_GOOGLE_CLIENT_ID';
  
  console.log('🔍 Google認証設定確認:', {
    hasClientId,
    platform: Platform.OS,
    status: hasClientId ? '利用可能' : '設定不備'
  });
  
  return hasClientId;
};

/**
 * 設定情報デバッグ表示
 */
export const debugGoogleAuthConfig = () => {
  if (__DEV__) {
    console.log('🔍 Google Auth Config:', {
      clientIdConfigured: isGoogleAuthAvailable(),
      clientIdPreview: GOOGLE_OAUTH_CONFIG.clientId.substring(0, 20) + '...',
      redirectUri: GOOGLE_OAUTH_CONFIG.redirectUri,
      scopes: GOOGLE_OAUTH_CONFIG.scopes,
      platform: Platform.OS,
    });
  }
}; 