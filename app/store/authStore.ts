import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { auth } from '../services/firebase';

// 認証状態の型定義
interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  
  // アクション
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithApple: (idToken: string, nonce: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  
  // ID Token取得
  getIdToken: () => Promise<string | null>;
}

// Zustandストアの作成
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
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

      // Googleサインイン
      signInWithGoogle: async (idToken: string) => {
        try {
          set({ isLoading: true, error: null });
          const credential = GoogleAuthProvider.credential(idToken);
          const userCredential = await signInWithCredential(auth, credential);
          set({ user: userCredential.user, isLoading: false });
        } catch (error: any) {
          set({ 
            error: error.message || 'Googleサインインに失敗しました', 
            isLoading: false 
          });
          throw error;
        }
      },

      // Appleサインイン
      signInWithApple: async (idToken: string, nonce: string) => {
        try {
          set({ isLoading: true, error: null });
          const provider = new OAuthProvider('apple.com');
          const credential = provider.credential({
            idToken,
            rawNonce: nonce
          });
          const userCredential = await signInWithCredential(auth, credential);
          set({ user: userCredential.user, isLoading: false });
        } catch (error: any) {
          set({ 
            error: error.message || 'Appleサインインに失敗しました', 
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
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user }),
    }
  )
);

// 認証状態の監視を設定
onAuthStateChanged(auth, (user) => {
  useAuthStore.setState({ user, isLoading: false });
});

export default useAuthStore;