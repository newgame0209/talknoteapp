import { create } from 'zustand';
import * as databaseService from '../services/database';
import { Recording, ImportFile, UploadQueueItem } from '../services/database';
import * as Crypto from 'expo-crypto';

// データベースストアの型定義
interface DatabaseState {
  // 状態
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  
  // データ
  recordings: any[];
  imports: any[];
  uploadQueue: any[];
  
  // アクション
  initializeDatabase: () => Promise<void>;
  loadData: () => Promise<void>;
  saveRecording: (title: string, duration: number, filePath: string, transcription?: string) => Promise<string>;
  saveImport: (title: string, filePath: string, fileType: string, fileSize: number) => Promise<string>;
  addToUploadQueue: (type: 'recording' | 'import', itemId: string) => Promise<string>;
  updateUploadStatus: (id: string, status: string, mediaId?: string) => Promise<void>;
  clearError: () => void;
  getNoteById: (noteId: string) => Promise<any>;
  updateNote: (noteId: string, title: string, content?: string) => Promise<void>;
}

// Zustandストアの作成
export const useDatabaseStore = create<DatabaseState>()((set, get) => ({
  // 初期状態
  isInitialized: false,
  isLoading: false,
  error: null,
  recordings: [],
  imports: [],
  uploadQueue: [],
  
  // データベース初期化
  initializeDatabase: async () => {
    try {
      set({ isLoading: true, error: null });
      await databaseService.initDatabase();
      set({ isInitialized: true, isLoading: false });
      
      // データの初期ロード
      await get().loadData();
    } catch (error: any) {
      set({ 
        error: error.message || 'データベースの初期化に失敗しました', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  // データのロード
  loadData: async () => {
    try {
      set({ isLoading: true, error: null });
      
      // 録音データの取得
      const recordings = await databaseService.getRecordings();
      
      // インポートデータの取得
      const imports = await databaseService.getImports();
      
      // アップロードキューの取得
      const uploadQueue = await databaseService.getUploadQueue();
      
      set({ 
        recordings, 
        imports, 
        uploadQueue,
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'データの読み込みに失敗しました', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  // 録音データの保存
  saveRecording: async (title: string, duration: number, filePath: string, transcription?: string) => {
    try {
      set({ isLoading: true, error: null });
      
      // 一意のIDを生成
      const id = Crypto.randomUUID();
      
      // データベースに保存
      await databaseService.saveRecording(id, title, duration, filePath, transcription);
      
      // データを再ロード
      await get().loadData();
      
      return id;
    } catch (error: any) {
      set({ 
        error: error.message || '録音データの保存に失敗しました', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  // インポートデータの保存
  saveImport: async (title: string, filePath: string, fileType: string, fileSize: number) => {
    try {
      set({ isLoading: true, error: null });
      
      // 一意のIDを生成
      const id = Crypto.randomUUID();
      
      // データベースに保存
      await databaseService.saveImport(id, title, filePath, fileType, fileSize);
      
      // データを再ロード
      await get().loadData();
      
      return id;
    } catch (error: any) {
      set({ 
        error: error.message || 'インポートデータの保存に失敗しました', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  // アップロードキューに追加
  addToUploadQueue: async (type: 'recording' | 'import', itemId: string) => {
    try {
      set({ isLoading: true, error: null });
      
      // 一意のIDを生成
      const id = Crypto.randomUUID();
      
      // アップロードキューに追加
      await databaseService.addToUploadQueue(id, type, itemId);
      
      // データを再ロード
      await get().loadData();
      
      return id;
    } catch (error: any) {
      set({ 
        error: error.message || 'アップロードキューへの追加に失敗しました', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  // アップロードステータスの更新
  updateUploadStatus: async (id: string, status: string, mediaId?: string) => {
    try {
      set({ isLoading: true, error: null });
      
      // ステータスを更新
      await databaseService.updateUploadStatus(id, status, mediaId);
      
      // データを再ロード
      await get().loadData();
    } catch (error: any) {
      set({ 
        error: error.message || 'アップロードステータスの更新に失敗しました', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  // エラークリア
  clearError: () => set({ error: null }),
  
  // ノート詳細画面用：noteIdでノートを取得する関数
  getNoteById: async (noteId: string) => {
    try {
      set({ isLoading: true, error: null });
      const note = await databaseService.getNoteById(noteId);
      set({ isLoading: false });
      return note;
    } catch (error: any) {
      set({ 
        error: error.message || 'ノートの取得に失敗しました', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  // ノート詳細画面用：noteIdでノートを更新する関数
  updateNote: async (noteId: string, title: string, content?: string) => {
    try {
      set({ isLoading: true, error: null });
      await databaseService.updateNote(noteId, title, content);
      set({ isLoading: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'ノートの更新に失敗しました', 
        isLoading: false 
      });
      throw error;
    }
  }
}));

export default useDatabaseStore;
