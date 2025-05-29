import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// API設定
const API_BASE_URL = __DEV__ 
  ? 'http://192.168.0.46:8000'  // 開発環境（実機用IPアドレス）
  : 'https://api.talknote.app';  // 本番環境

const WS_BASE_URL = __DEV__ 
  ? 'ws://192.168.0.46:8002'  // 開発環境（実機用IPアドレス）
  : 'wss://api.talknote.app';  // 本番環境

// 開発環境でのIPアドレスを取得
const getDevServerUrl = () => {
  if (__DEV__) {
    // Expo Goの場合、hostUriからIPアドレスを取得
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      return `http://${host}:8000/api/v1`;
    }
    
    // フォールバック
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:8000/api/v1'; // Android エミュレータ用
    } else {
      return 'http://localhost:8000/api/v1'; // iOS シミュレータ用
    }
  }
  return 'https://api.talknote.app/api/v1'; // 本番環境用
};

// APIのベースURLを環境に応じて設定
const BASE_URL = getDevServerUrl();

console.log('[API] Base URL:', BASE_URL);

// Axiosインスタンスの作成
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター（認証トークンの追加など）
api.interceptors.request.use(
  async (config) => {
    try {
      // Firebase authから直接IDトークンを取得
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${idToken}`;
      } else {
        // 認証されていない場合はデモトークンを使用（開発環境用）
        config.headers.Authorization = `Bearer demo_token_for_development`;
      }
    } catch (error) {
      console.error('認証トークン取得エラー:', error);
      // フォールバックとしてデモトークンを使用
      config.headers.Authorization = `Bearer demo_token_for_development`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター（エラーハンドリングなど）
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // エラーハンドリング
    if (error.response) {
      // サーバーからのレスポンスがある場合
      console.error('API Error:', error.response.data);
      
      // 認証エラーの場合はログアウト処理など
      if (error.response.status === 401) {
        // 認証エラー処理
      }
    } else if (error.request) {
      // リクエストは送信されたがレスポンスがない場合
      console.error('Network Error:', error.request);
    } else {
      // リクエスト設定中にエラーが発生した場合
      console.error('Request Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// メディアアップロード関連のAPI
export const mediaApi = {
  // アップロードURLの取得
  getUploadUrl: async (fileType: string, fileSize: number, chunkSize?: number, totalChunks?: number) => {
    const response = await api.post('/api/v1/media/upload-url', {
      file_type: fileType,
      file_size: fileSize,
      chunk_size: chunkSize,
      total_chunks: totalChunks
    });
    return response.data;
  },

  // チャンクアップロード
  uploadChunk: async (mediaId: string, chunkIndex: number, totalChunks: number, chunk: Blob) => {
    const formData = new FormData();
    formData.append('media_id', mediaId);
    formData.append('chunk_index', chunkIndex.toString());
    formData.append('total_chunks', totalChunks.toString());
    formData.append('chunk', chunk as any);

    const response = await api.post('/api/v1/media/upload-chunk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // アップロード完了
  completeUpload: async (mediaId: string, totalChunks: number, totalSize: number, md5Hash?: string) => {
    const response = await api.post('/api/v1/media/complete-upload', {
      media_id: mediaId,
      total_chunks: totalChunks,
      total_size: totalSize,
      md5_hash: md5Hash
    });
    return response.data;
  },

  // メディア処理状況の取得
  getStatus: async (mediaId: string) => {
    const response = await api.get(`/api/v1/media/status/${mediaId}`);
    return response.data;
  },

  // Expo Go対応: ファイルアップロード
  uploadFile: async (fileUri: string, fileType: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: 'recording.wav',
      type: fileType,
    } as any);
    const response = await api.post('/api/v1/media/upload-file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default api;
