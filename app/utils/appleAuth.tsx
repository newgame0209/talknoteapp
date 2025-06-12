import React from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../store/authStore';
import * as Crypto from 'expo-crypto';

/**
 * Apple認証ボタンコンポーネント
 * iOS限定でApple Sign-Inを提供
 */

interface AppleAuthButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

// 安全なnonce生成（Crypto APIを使用）
const generateSecureNonce = async (): Promise<string> => {
  try {
    // Crypto.getRandomBytesAsync で安全なランダム値を生成
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
    let result = '';
    
    for (let i = 0; i < 32; i++) {
      const randomIndex = randomBytes[i] % chars.length;
      result += chars.charAt(randomIndex);
    }
    
    return result;
  } catch (error) {
    console.warn('⚠️ Crypto APIでのnonce生成に失敗、フォールバック使用:', error);
    // フォールバック: Math.randomを使用
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
};

export const AppleAuthButton: React.FC<AppleAuthButtonProps> = ({
  onSuccess,
  onError,
}) => {
  const { signInWithApple } = useAuthStore();

  // Apple認証処理
  const handleAppleSignIn = async () => {
    try {
      console.log('🍎 Apple Sign-In開始');

      // プラットフォームチェック
      if (Platform.OS !== 'ios') {
        throw new Error('Apple認証はiOSでのみ利用可能です');
      }

      // Apple認証が利用可能かチェック
      console.log('🔍 Apple認証の利用可能性をチェック中...');
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      console.log('🔍 Apple認証利用可能:', isAvailable);
      
      if (!isAvailable) {
        throw new Error('このデバイスではApple認証が利用できません。設定でSign in with Appleが有効になっているか確認してください。');
      }

      // 安全なnonceを生成
      console.log('🔐 セキュアなnonce生成中...');
      const nonce = await generateSecureNonce();
      console.log('🔐 nonce生成完了 (長さ:', nonce.length, ')');

      console.log('🍎 Apple認証リクエスト開始...');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: nonce,
      });

      console.log('🍎 Apple認証レスポンス受信完了');
      console.log('🔍 credential詳細:', {
        hasIdentityToken: !!credential.identityToken,
        hasAuthorizationCode: !!credential.authorizationCode,
        hasUser: !!credential.user,
        tokenLength: credential.identityToken?.length || 0,
        nonceLength: nonce.length
      });

      // IDトークンの存在確認
      if (!credential.identityToken) {
        console.error('❌ Apple IDトークンが存在しません');
        throw new Error('Apple認証は成功しましたが、IDトークンが取得できませんでした');
      }

      // IDトークンの基本形式チェック
      if (credential.identityToken.split('.').length !== 3) {
        console.error('❌ 不正なIDトークン形式:', credential.identityToken.substring(0, 50) + '...');
        throw new Error('不正なApple IDトークンが返されました');
      }

      console.log('🎫 Apple IDトークン検証成功');

      // Firebase認証に進む
      console.log('🔄 Firebase Apple認証を開始...');
      await signInWithApple(credential.identityToken, nonce);

      console.log('✅ Apple認証 & Firebase連携完了');
      onSuccess?.();

    } catch (error: any) {
      console.error('❌ Apple認証エラー - 完全な詳細:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        name: error.name
      });
      
      // ユーザーキャンセルの場合は静かに処理
      if (error.code === 'ERR_REQUEST_CANCELED' || 
          error.code === 'ERR_CANCELED' ||
          error.message?.includes('canceled')) {
        console.log('🔧 ユーザーがApple認証をキャンセルしました');
        return;
      }
      
      // エラーメッセージを具体的に改善
      let errorMessage = error.message || 'Apple認証でエラーが発生しました';
      
      if (error.code === 'ERR_REQUEST_FAILED') {
        errorMessage = 'Apple認証リクエストが失敗しました。インターネット接続を確認してください。';
      } else if (error.code === 'ERR_REQUEST_UNKNOWN') {
        errorMessage = 'Apple認証で予期しないエラーが発生しました。デバイスの設定でApple IDが正しく設定されているか確認してください。';
      } else if (error.message?.includes('authorization attempt failed')) {
        errorMessage = 'Apple認証の認可に失敗しました。しばらく時間をおいてから再試行してください。';
      } else if (error.message?.includes('not available')) {
        errorMessage = 'このデバイスではApple認証が利用できません。iOS 13以降が必要です。';
      }
      
      const enhancedError = new Error(errorMessage);
      onError?.(enhancedError);
    }
  };

  // iOS以外では表示しない
  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={8}
      style={{
        width: '100%',
        height: 50,
      }}
      onPress={handleAppleSignIn}
    />
  );
};

/**
 * Apple認証が利用可能かチェック
 */
export const isAppleAuthAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    console.log('🔍 Apple認証: iOS以外のプラットフォーム');
    return false;
  }
  
  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    console.log('🔍 Apple認証利用可能性:', isAvailable);
    return isAvailable;
  } catch (error) {
    console.error('❌ Apple認証可用性チェックエラー:', error);
    return false;
  }
};

export default AppleAuthButton;
