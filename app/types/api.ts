import { ApiResponse, Notebook, Page, User, AudioRecording, TranscriptionResult } from './index';

// APIクライアントの型定義
export interface ApiClient {
  // 認証関連
  login: (email: string, password: string) => Promise<ApiResponse<{ token: string; user: User }>>;
  logout: () => Promise<ApiResponse<void>>;
  getCurrentUser: () => Promise<ApiResponse<User>>;

  // ノートブック関連
  getNotebooks: () => Promise<ApiResponse<Notebook[]>>;
  getNotebook: (id: string) => Promise<ApiResponse<Notebook>>;
  createNotebook: (data: Omit<Notebook, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => Promise<ApiResponse<Notebook>>;
  updateNotebook: (id: string, data: Partial<Notebook>) => Promise<ApiResponse<Notebook>>;
  deleteNotebook: (id: string) => Promise<ApiResponse<void>>;

  // ページ関連
  getPages: (notebookId: string) => Promise<ApiResponse<Page[]>>;
  getPage: (id: string) => Promise<ApiResponse<Page>>;
  createPage: (data: Omit<Page, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => Promise<ApiResponse<Page>>;
  updatePage: (id: string, data: Partial<Page>) => Promise<ApiResponse<Page>>;
  deletePage: (id: string) => Promise<ApiResponse<void>>;

  // 音声関連
  uploadAudio: (file: File, pageId: string) => Promise<ApiResponse<AudioRecording>>;
  getAudio: (id: string) => Promise<ApiResponse<AudioRecording>>;
  deleteAudio: (id: string) => Promise<ApiResponse<void>>;

  // STT関連
  startTranscription: (audioId: string) => Promise<ApiResponse<{ jobId: string }>>;
  getTranscriptionResult: (jobId: string) => Promise<ApiResponse<TranscriptionResult>>;
}

// APIエラーの型定義
export interface ApiError extends Error {
  code: string;
  status: number;
  data?: any;
}

// APIリクエストの設定型定義
export interface ApiRequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
} 