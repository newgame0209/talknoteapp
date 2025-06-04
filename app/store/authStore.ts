import { create } from 'zustand';
// persist設定を削除
// import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from '../services/firebase';

// 古いZustand永続化データのクリーンアップ
const cleanupOldAuthData = async () => {
  try {
    const oldKeys = ['auth-storage']; // 古いZustandキー
    for (const key of oldKeys) {
      await AsyncStorage.removeItem(key);
      console.log(`🧹 クリーンアップ完了: ${key}`);
    }
  } catch (error) {
    console.warn('⚠️ AsyncStorageクリーンアップエラー:', error);
  }
};

// アプリ起動時に1回だけ実行
cleanupOldAuthData();

// 認証状態の型定義
interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  
  // Email認証のみ（Google/Apple認証は直接auth.tsから使用）
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  
  // ID Token取得
  getIdToken: () => Promise<string | null>;
}

// Zustandストアの作成（永続化なし）
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true, // Firebase初期化完了まではtrue
  error: null,

  // サインアップ
  signUp: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      set({ user: userCredential.user, isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'サインアップに失敗しました', 
        isLoading: false 
      });
      throw error;
    }
  },

  // サインイン
  signIn: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      set({ user: userCredential.user, isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'サインインに失敗しました', 
        isLoading: false 
      });
      throw error;
    }
  },

  // サインアウト
  signOut: async () => {
    try {
      set({ isLoading: true, error: null });
      await firebaseSignOut(auth);
      set({ user: null, isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'サインアウトに失敗しました', 
        isLoading: false 
      });
      throw error;
    }
  },

  // エラークリア
  clearError: () => set({ error: null }),

  // ID Token取得
  getIdToken: async () => {
    const { user } = get();
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (error) {
      console.error('ID Token取得エラー:', error);
      return null;
    }
  }
}));

// 認証状態の監視を設定
onAuthStateChanged(auth, (user) => {
  console.log('🔐 Firebase認証状態変更:', user ? `認証済み(${user.uid})` : '未認証');
  useAuthStore.setState({ user, isLoading: false });
});

export default useAuthStore;