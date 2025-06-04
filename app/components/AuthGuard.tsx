import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { authHelpers } from '../services/firebase';

/**
 * 認証ガードコンポーネント
 * 
 * 機能:
 * - 認証状態の監視
 * - 未認証ユーザーのリダイレクト
 * - 認証中の待機画面表示
 * - Firebase Auth永続化対応
 */

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredAuth?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  fallback = null,
  requiredAuth = true 
}) => {
  const { user, isLoading } = useAuthStore();
  const [initializationComplete, setInitializationComplete] = useState(false);

  // Firebase Auth初期化待機
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Firebase Authの初期化を待機
        // onAuthStateChangedにより自動的にuseAuthStoreが更新される
        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 1000); // 最大1秒待機
          if (user !== undefined) {
            clearTimeout(timer);
            resolve(undefined);
          }
        });
        
        setInitializationComplete(true);
        
        if (__DEV__) {
          authHelpers.debugInfo();
          console.log('🔐 AuthGuard: 初期化完了', {
            user: user ? '認証済み' : '未認証',
            isLoading,
          });
        }
      } catch (error) {
        console.error('AuthGuard初期化エラー:', error);
        setInitializationComplete(true);
      }
    };

    initializeAuth();
  }, [user, isLoading]);

  // 認証が不要な場合は常に子コンポーネントを表示
  if (!requiredAuth) {
    return <>{children}</>;
  }

  // 初期化中または認証確認中
  if (!initializationComplete || isLoading) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
      }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{
          marginTop: 10,
          fontSize: 16,
          color: '#666666',
        }}>
          認証状態を確認中...
        </Text>
        {__DEV__ && (
          <Text style={{
            marginTop: 5,
            fontSize: 12,
            color: '#999999',
          }}>
            🔧 Debug: Firebase Auth初期化中
          </Text>
        )}
      </View>
    );
  }

  // 認証済みの場合は子コンポーネントを表示
  if (user) {
    return <>{children}</>;
  }

  // 未認証の場合はfallbackを表示（通常はログイン画面）
  return <>{fallback}</>;
};

export default AuthGuard; 