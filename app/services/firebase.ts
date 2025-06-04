import { initializeApp } from 'firebase/app';
// @ts-ignore: firebase v9 の React Native 専用モジュール
import { initializeAuth, getReactNativePersistence } from 'firebase/auth/react-native';
// 通常 API 用
import { getAuth, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 正しいライブラリ名を使用

// Firebase設定型定義
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// GoogleService-Info.plistから取得した正確なFirebase設定
const firebaseConfig: FirebaseConfig = {
  apiKey: "AIzaSyBxJW4zRL6AOt9MEmetZ5BmHH_PAEyAODk",
  authDomain: "talknote-446306.firebaseapp.com",
  projectId: "talknote-446306",
  storageBucket: "talknote-446306.appspot.com",
  messagingSenderId: "309882614658",
  appId: "1:309882614658:ios:d567bcd40bc5bcd473ab17",
  // measurementIdは後で追加可能
};

// デバッグモードフラグ
const isDebugMode = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true' || __DEV__;

let app: any;
let auth: Auth;

try {
  // Firebaseの初期化
  app = initializeApp(firebaseConfig);

  // Firebase v10.14.1 – AsyncStorage 永続化を明示的に設定
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  
  if (isDebugMode) {
    console.log('🔥 Firebase initialized successfully');
    console.log('✅ Firebase認証永続化: AsyncStorageに明示設定完了');
    console.log('📦 @react-native-async-storage/async-storage:', AsyncStorage ? '利用可能' : 'エラー');
    console.log('🔧 Debug mode enabled');
    console.log('📱 Project ID:', firebaseConfig.projectId);
  }
} catch (error: any) {
  console.error('❌ Firebase initialization failed:', error);

  // フォールバック: getAuthを使用（既に初期化済みの場合）
  try {
    auth = getAuth(app);
    console.warn('⚠️ Using getAuth as fallback');
  } catch (fallbackError) {
    console.error('❌ Fallback auth also failed:', fallbackError);
    throw new Error('Firebase authentication could not be initialized');
  }
}

// 認証状態の管理用ヘルパー
export const authHelpers = {
  // 認証状態の確認
  isAuthenticated: (): boolean => {
    return auth?.currentUser !== null;
  },
  
  // 現在のユーザー取得
  getCurrentUser: () => {
    return auth?.currentUser;
  },
  
  // IDトークン取得（API通信用）
  getIdToken: async (forceRefresh: boolean = false): Promise<string | null> => {
    try {
      if (!auth?.currentUser) {
        if (isDebugMode) {
          console.log('🔧 No authenticated user, returning null token');
        }
        return null;
      }
      
      const token = await auth.currentUser.getIdToken(forceRefresh);
      if (isDebugMode) {
        console.log('🎫 ID Token obtained successfully');
      }
      return token;
    } catch (error) {
      console.error('❌ Failed to get ID token:', error);
      return null;
    }
  },
  
  // デバッグ情報表示
  debugInfo: () => {
    if (isDebugMode) {
      console.log('🔍 Firebase Debug Info:', {
        isAuthenticated: authHelpers.isAuthenticated(),
        userId: auth?.currentUser?.uid || 'None',
        email: auth?.currentUser?.email || 'None',
        configProjectId: firebaseConfig.projectId,
        persistenceMode: 'Firebase AsyncStorage Only'
      });
    }
  }
};

export { app, auth };
