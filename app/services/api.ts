import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getCurrentIdToken } from './auth';

// 環境変数から動的にAPIベースURLを取得
const getApiBaseUrl = () => {
  // 🔍 デバッグ: 全ての環境変数をログ出力
  console.log('[API DEBUG] process.env keys:', Object.keys(process.env).filter(key => key.startsWith('EXPO_PUBLIC')));
  console.log('[API DEBUG] EXPO_PUBLIC_API_BASE_URL:', process.env.EXPO_PUBLIC_API_BASE_URL);
  console.log('[API DEBUG] __DEV__:', __DEV__);
  
  // 環境変数からAPIベースURLを取得
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (baseUrl) {
    console.log('[API] 環境変数からベースURL取得:', baseUrl);
    return baseUrl;
  }
  
  console.log('[API DEBUG] 環境変数が未設定、フォールバックロジックに移行');
  
  // フォールバック：開発環境と本番環境
  if (__DEV__) {
    // Expo Goの場合、hostUriからIPアドレスを取得
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(':')[0];
      const devUrl = `http://${host}:8000`;
      console.log('[API] Expo GoホストからURL生成:', devUrl);
      return devUrl;
    }
    
    // デフォルトフォールバック
    const fallbackUrl = Platform.OS === 'android' 
      ? 'http://10.0.2.2:8000'  // Android エミュレータ用
      : 'http://localhost:8000'; // iOS シミュレータ用
    console.log('[API] フォールバックURL使用:', fallbackUrl);
    return fallbackUrl;
  }
  
  // 開発段階: 常にローカル開発環境を使用
  const devUrl = 'http://192.168.0.46:8000';
  console.log('[API] 開発環境URL使用:', devUrl);
  return devUrl;
};

// API設定
const API_BASE_URL = getApiBaseUrl();

// WebSocket URL生成関数
const getWsBaseUrl = () => {
  // 環境変数からSTTベースURLを取得
  const sttBaseUrl = process.env.EXPO_PUBLIC_STT_BASE_URL;
  if (sttBaseUrl) {
    // HTTPをWSに変換
    const wsUrl = sttBaseUrl.replace('http:', 'ws:').replace('https:', 'wss:');
    console.log('[WS] 環境変数からWebSocketURL取得:', `${wsUrl}/api/v1/stt/stream`);
    return `${wsUrl}/api/v1/stt/stream`;
    }
    
    // 開発段階: 常にローカル開発環境を使用
    const devWsUrl = 'ws://192.168.0.46:8002/api/v1/stt/stream';
    console.log('[WS] 開発WebSocketURL使用:', devWsUrl);
    return devWsUrl;
};

const WS_BASE_URL = getWsBaseUrl();

// 開発環境でのIPアドレスを取得
const getDevServerUrl = () => {
  // APIベースURLにAPIバージョンパスを追加
  return `${API_BASE_URL}/api/v1`;
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
      // backend.mdc仕様に従ったID Token取得
      const idToken = await getCurrentIdToken();
      
      if (idToken) {
        // backend.mdc仕様：Authorization: Bearer <ID_TOKEN>
        config.headers.Authorization = `Bearer ${idToken}`;
        console.log('🎫 API要求にID Token付与:', idToken.substring(0, 50) + '...');
      } else {
        // 認証されていない場合はデモトークンを使用（開発環境用）
        config.headers.Authorization = `Bearer demo_token_for_development`;
        console.log('🔧 開発用デモトークンを使用');
      }
    } catch (error) {
      console.error('❌ ID Token取得エラー:', error);
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

  // OCR: Base64画像からテキスト抽出
  extractTextFromBase64: async (imageData: string, languageHints?: string[], provider?: string) => {
    const response = await api.post('/api/v1/ocr/extract-text-base64', {
      image_data: imageData,
      language_hints: languageHints || ['ja', 'en'],
      provider: provider || 'google_vision'
    });
    return response.data;
  },

  // Expo Go対応: ファイルアップロード
  uploadFile: async (fileUri: string, fileType: string) => {
    console.log('🚀 [uploadFile] 開始 - fileUri:', fileUri, 'fileType:', fileType);
    
    const formData = new FormData();
    // React Native対応: ファイルオブジェクトの形式を修正
    formData.append('file', {
      uri: fileUri,
      name: 'recording.wav',
      type: fileType,
    } as any);
    
    console.log('🚀 [uploadFile] FormData作成完了');
    
    try {
    const response = await api.post('/api/v1/media/upload-file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
        timeout: 60000, // 60秒タイムアウト
    });
      
      console.log('🚀 [uploadFile] 成功 - response:', response.data);
    return response.data;
    } catch (error) {
      console.error('❌ [uploadFile] エラー:', error);
      throw error;
    }
  },
};

// AI関連のAPI
export const aiApi = {
  // テキストの要約
  summarize: async (text: string, maxLength?: number) => {
    const response = await api.post('/api/v1/ai/summarize', {
      text,
      max_length: maxLength
    });
    return response.data;
  },

  // テキストからタイトルを生成
  generateTitle: async (text: string, maxLength: number = 15) => {
    console.log('[aiApi.generateTitle] 開始 - text長:', text.length, 'maxLength:', maxLength);
    
    // API Tokenを取得
    const token = await getCurrentIdToken();
    console.log('🎫 API要求にID Token付与:', token ? `${token.substring(0, 50)}...` : 'トークンなし');
    
    try {
      const response = await api.post('/api/v1/ai/generate-title', {
        text,
        max_length: maxLength
      });
      
      console.log('[aiApi.generateTitle] 成功 - response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[aiApi.generateTitle] エラー:', error);
      throw error;
    }
  },

  // AI文章整形機能
  enhanceScannedText: async (
    text: string,
    options: {
      analyze_structure?: boolean;
      correct_grammar?: boolean;
      improve_readability?: boolean;
      format_style?: string;
      language?: string;
    } = {}
  ) => {
    console.log('[aiApi.enhanceScannedText] 開始 - text長:', text.length);
    
    // API Tokenを取得
    const token = await getCurrentIdToken();
    console.log('🎫 API要求にID Token付与:', token ? `${token.substring(0, 50)}...` : 'トークンなし');
    
    try {
      const response = await api.post('/api/v1/ai/enhance-scanned-text', {
        text,
        analyze_structure: options.analyze_structure ?? true,
        correct_grammar: options.correct_grammar ?? true,
        improve_readability: options.improve_readability ?? true,
        format_style: options.format_style ?? 'structured',
        language: options.language ?? 'ja'
      });
      
      console.log('[aiApi.enhanceScannedText] 成功 - enhanced text長:', response.data.enhanced_text?.length || 0);
      return response.data;
    } catch (error) {
      console.error('[aiApi.enhanceScannedText] エラー:', error);
      throw error;
    }
  }
};

// Notebooks関連のAPI
export const notebooksApi = {
  // ノートブック一覧の取得
  getNotebooks: async (skip: number = 0, limit: number = 100, search?: string) => {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (search) {
      params.append('search', search);
    }
    
    const response = await api.get(`/api/v1/notebooks?${params.toString()}`);
    return response.data;
  },

  // ノートブック作成
  createNotebook: async () => {
    const response = await api.post('/api/v1/notebooks');
    return response.data;
  },

  // ノートブック取得
  getNotebook: async (notebookId: string) => {
    const response = await api.get(`/api/v1/notebooks/${notebookId}`);
    return response.data;
  },

  // ノートブック更新
  updateNotebook: async (notebookId: string, data: { title?: string; description?: string; folder?: string; tags?: string[] }) => {
    const response = await api.patch(`/api/v1/notebooks/${notebookId}`, data);
    return response.data;
  },

  // ノートブック削除（論理削除）
  deleteNotebook: async (notebookId: string) => {
    const response = await api.delete(`/api/v1/notebooks/${notebookId}`);
    return response.data;
  },
};

// Pages関連のAPI
export const pagesApi = {
  // ページ一覧の取得
  getPages: async (notebookId: string, skip: number = 0, limit: number = 100) => {
    const params = new URLSearchParams({
      notebook_id: notebookId,
      skip: skip.toString(),
      limit: limit.toString(),
    });
    
    const response = await api.get(`/api/v1/pages/?${params.toString()}`);
    return response.data;
  },

  // ページ作成
  createPage: async (notebookId: string, data: { title?: string; page_number?: number; canvas_data?: any }) => {
    const response = await api.post('/api/v1/pages/', {
      notebook_id: notebookId,
      ...data
    });
    return response.data;
  },

  // ページ取得
  getPage: async (pageId: string) => {
    const response = await api.get(`/api/v1/pages/${pageId}`);
    return response.data;
  },

  // ページ更新（キャンバスデータ保存を含む）
  updatePage: async (pageId: string, data: { title?: string; page_number?: number; canvas_data?: any }) => {
    const response = await api.patch(`/api/v1/pages/${pageId}`, data);
    return response.data;
  },

  // ページ削除
  deletePage: async (pageId: string) => {
    const response = await api.delete(`/api/v1/pages/${pageId}`);
    return response.data;
  },
};

export default api;
