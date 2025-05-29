// ユーザー関連の型定義
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ノート関連の型定義
export interface Notebook {
  id: string;
  userId: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

export interface Page {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  audioUrl?: string;
  transcript?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

// 音声関連の型定義
export interface AudioRecording {
  id: string;
  pageId: string;
  url: string;
  duration: number;
  size: number;
  format: string;
  createdAt: Date;
  updatedAt: Date;
}

// STT関連の型定義
export interface TranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: Array<{
    text: string;
    confidence: number;
  }>;
}

// APIレスポンスの型定義
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// 認証関連の型定義
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// 設定関連の型定義
export interface AppSettings {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  isHighContrast: boolean;
  isDarkMode: boolean;
  isOfflineMode: boolean;
} 