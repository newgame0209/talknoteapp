import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useAuthStore } from '../store/authStore';

/**
 * Apple認証のヘルパー関数
 * Apple Sign-Inボタンの表示可否確認と認証フロー実行
 */

/**
 * デバイスがApple認証をサポートしているか確認
 */
export const isAppleAuthAvailable = async (): Promise<boolean> => {
  return await AppleAuthentication.isAvailableAsync();
};

/**
 * ランダムなnonceを生成
 * CSRF攻撃を防ぐためのセキュリティ対策
 */
export const generateNonce = async (): Promise<string> => {
  const randomString = Math.random().toString(36).substring(2, 10);
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    randomString
  );
};

/**
 * Apple Sign-Inを実行
 * 成功時はFirebaseと連携して認証完了
 */
export const signInWithApple = async (): Promise<void> => {
  try {
    // nonceを生成（セキュリティ対策）
    const nonce = await generateNonce();
    
    // Apple認証を実行
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
    
    // 認証成功時、Firebaseと連携
    if (credential.identityToken) {
      await useAuthStore.getState().signInWithApple(
        credential.identityToken,
        nonce
      );
      return;
    }
    
    throw new Error('Apple認証に失敗しました: IDトークンがありません');
  } catch (error: any) {
    // ユーザーがキャンセルした場合は特別処理
    if (error.code === 'ERR_CANCELED') {
      console.log('ユーザーが認証をキャンセルしました');
      return;
    }
    
    console.error('Apple認証エラー:', error);
    throw error;
  }
};

/**
 * Apple Sign-Inのボタンコンポーネント
 * 使用例: <AppleAuthButton onSuccess={() => navigation.navigate('Home')} />
 */
export const AppleAuthButton: React.FC<{
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}> = ({ onSuccess, onError }) => {
  // デバイスがApple認証をサポートしていない場合は何も表示しない
  if (!AppleAuthentication.isAvailableAsync()) {
    return null;
  }

  const handlePress = async () => {
    try {
      await signInWithApple();
      onSuccess?.();
    } catch (error: any) {
      onError?.(error);
    }
  };

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={5}
      style={{ width: '100%', height: 44 }}
      onPress={handlePress}
    />
  );
};

export default {
  isAppleAuthAvailable,
  signInWithApple,
  AppleAuthButton,
};
