// データベース機能を一時的に無効化し、モック実装に置き換え
// これはデザイン確認用の一時的な対応です
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { aiApi } from './api';


/**
 * SQLiteデータベースサービス
 * ローカルデータの永続化を担当
 */

// 型定義
export interface Recording {
  id: string;
  title: string;
  duration: number;
  file_path: string;
  created_at: number;
  uploaded: number;
  media_id?: string;
  transcription?: string;
}

export interface ImportFile {
  id: string;
  title: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: number;
  uploaded: number;
  media_id?: string;
}

export interface UploadQueueItem {
  id: string;
  type: 'recording' | 'import';
  item_id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  attempts: number;
  last_attempt?: number;
  created_at: number;
}

// データベース名
const DATABASE_NAME = 'talknote.db';

// データベース接続インスタンス
let db: SQLite.SQLiteDatabase | null = null;

// データベース接続を取得
export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (Platform.OS === 'web') {
    // Webプラットフォームでは警告を表示
    console.warn('SQLite is not supported on web platform');
    return null as unknown as SQLite.SQLiteDatabase;
  }
  
  if (!db) {
    db = SQLite.openDatabaseSync(DATABASE_NAME);
  }
  return db;
};

// データベース初期化
export const initDatabase = async (): Promise<void> => {
  try {
    const db = getDatabase();
    
    // 録音データテーブル
    await db.execAsync(`CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        duration INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        uploaded INTEGER DEFAULT 0,
        media_id TEXT,
        transcription TEXT
    );`);
    console.log('Recordings table created successfully');
    
    // インポートファイルテーブル
    await db.execAsync(`CREATE TABLE IF NOT EXISTS imports (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        uploaded INTEGER DEFAULT 0,
        media_id TEXT
    );`);
    console.log('Imports table created successfully');
    
    // アップロードキューテーブル
    await db.execAsync(`CREATE TABLE IF NOT EXISTS upload_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_attempt INTEGER,
        created_at INTEGER NOT NULL
    );`);
    console.log('Upload queue table created successfully');
    
    console.log('Database initialized successfully');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Database initialization error:', errorMessage);
    return Promise.reject(error);
  }
};

// 録音データの保存
export const saveRecording = async (
  id: string,
  title: string = "AIがタイトルを生成中…", // デフォルトで仮タイトルを設定
  duration: number,
  filePath: string,
  transcription?: string
): Promise<void> => {
  try {
    const db = getDatabase();
    const now = Date.now();
    
    await db.runAsync(
      `INSERT INTO recordings (id, title, duration, file_path, created_at, transcription)
            VALUES (?, ?, ?, ?, ?, ?);`,
      [id, title, duration, filePath, now, transcription || null]
    );
    
    console.log('Recording saved successfully');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error saving recording:', errorMessage);
    return Promise.reject(error);
  }
};

// AIタイトル生成
export const generateAITitle = async (noteId: string, transcription: string): Promise<void> => {
  try {
    console.log('[generateAITitle] 開始 - noteId:', noteId, 'transcription長:', transcription.length);
    
    // AI APIでタイトル生成
    console.log('[generateAITitle] AI APIを呼び出し中...');
    const response = await aiApi.generateTitle(transcription, 15); // 最大15文字
    console.log('[generateAITitle] AI APIレスポンス:', response);
    
    const generatedTitle = response.title;
    console.log('[generateAITitle] 生成されたタイトル:', generatedTitle);

    // ノートのタイトルのみを更新（文字起こし内容は保持）
    console.log('[generateAITitle] データベース更新中...');
    await updateNoteTitle(noteId, generatedTitle);
    console.log('[generateAITitle] AI title generated and updated successfully');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[generateAITitle] Error generating AI title:', errorMessage);
    return Promise.reject(error);
  }
};

// インポートファイルの保存
export const saveImport = async (
  id: string,
  title: string,
  filePath: string,
  fileType: string,
  fileSize: number
): Promise<void> => {
  try {
    const db = getDatabase();
    const now = Date.now();
    
    await db.runAsync(
      `INSERT INTO imports (id, title, file_path, file_type, file_size, created_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
      [id, title, filePath, fileType, fileSize, now]
    );
    
    console.log('Import saved successfully');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error saving import:', errorMessage);
    return Promise.reject(error);
  }
};

// アップロードキューに追加
export const addToUploadQueue = async (
  id: string,
  type: 'recording' | 'import',
  itemId: string
): Promise<void> => {
  try {
    const db = getDatabase();
    const now = Date.now();
    
    await db.runAsync(
      `INSERT INTO upload_queue (id, type, item_id, status, created_at)
           VALUES (?, ?, ?, ?, ?);`,
      [id, type, itemId, 'pending', now]
    );
    
    console.log('Item added to upload queue');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error adding to upload queue:', errorMessage);
    return Promise.reject(error);
  }
};

// 録音データの取得（最新順）
export const getRecordings = async (): Promise<Recording[]> => {
  try {
    const db = getDatabase();
    
    const result = await db.getAllAsync<Recording>(
      'SELECT * FROM recordings ORDER BY created_at DESC;'
    );
    
    return result || [];
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error getting recordings:', errorMessage);
    return Promise.reject(error);
  }
};

// インポートファイルの取得（最新順）
export const getImports = async (): Promise<ImportFile[]> => {
  try {
    const db = getDatabase();
    
    const result = await db.getAllAsync<ImportFile>(
      'SELECT * FROM imports ORDER BY created_at DESC;'
    );
    
    return result || [];
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error getting imports:', errorMessage);
    return Promise.reject(error);
  }
};

// アップロードキューの取得（ステータス別）
export const getUploadQueue = async (status?: string): Promise<UploadQueueItem[]> => {
  try {
    const db = getDatabase();
    
    let query = 'SELECT * FROM upload_queue';
    const params: string[] = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at ASC;';
    
    const result = await db.getAllAsync<UploadQueueItem>(query, params);
    
    return result || [];
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error getting upload queue:', errorMessage);
    return Promise.reject(error);
  }
};

// アップロードステータスの更新
export const updateUploadStatus = async (
  id: string,
  status: string,
  mediaId?: string
): Promise<void> => {
  try {
    const db = getDatabase();
    const now = Date.now();
    
    // アップロードキューのステータスを更新
    await db.runAsync(
      `UPDATE upload_queue 
             SET status = ?, last_attempt = ?, attempts = attempts + 1
             WHERE id = ?;`,
      [status, now, id]
    );
    
    if (mediaId) {
      // アップロード成功時、元のアイテムのメディアIDを更新
      // まずキューアイテムの情報を取得
      const queueResult = await db.getFirstAsync<{type: string, item_id: string}>(
        `SELECT type, item_id FROM upload_queue WHERE id = ?;`,
        [id]
      );
      
      if (queueResult) {
        const { type, item_id } = queueResult;
        const table = type === 'recording' ? 'recordings' : 'imports';
        
        // 元のレコーディングかインポートアイテムを更新
        try {
          await db.runAsync(
            `UPDATE ${table} SET uploaded = 1, media_id = ? WHERE id = ?;`,
            [mediaId, item_id]
          );
          console.log(`Updated ${type} with media ID:`, mediaId);
        } catch (updateError: unknown) {
          const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);
          console.error(`Error updating ${type}:`, errorMessage);
          // エラーは無視して処理を続行
        }
      }
    }
    
    console.log('Upload status updated successfully');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error updating upload status:', errorMessage);
    return Promise.reject(error);
  }
};

// データベースエクスポート（デバッグ用）
interface DatabaseExport {
  recordings: Recording[];
  imports: ImportFile[];
  queue: UploadQueueItem[];
}

export const exportDatabase = async (): Promise<DatabaseExport> => {
  try {
    const recordings = await getRecordings();
    const imports = await getImports();
    const queue = await getUploadQueue();
    
    return { recordings, imports, queue };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error exporting database:', errorMessage);
    return Promise.reject(error);
  }
};

// ノート詳細画面用：noteIdでノートを取得する関数
export const getNoteById = async (noteId: string): Promise<Recording | ImportFile | null> => {
  try {
    const db = getDatabase();
    // 録音データテーブルから検索
    const recordingResult = await db.getFirstAsync<Recording>(
      'SELECT * FROM recordings WHERE id = ?;',
      [noteId]
    );
    if (recordingResult) {
      return recordingResult;
    }
    // インポートファイルテーブルから検索
    const importResult = await db.getFirstAsync<ImportFile>(
      'SELECT * FROM imports WHERE id = ?;',
      [noteId]
    );
    return importResult || null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error getting note by id:', errorMessage);
    return Promise.reject(error);
  }
};

// ノート詳細画面用：noteIdでノートのタイトルのみを更新する関数
export const updateNoteTitle = async (noteId: string, title: string): Promise<void> => {
  try {
    const db = getDatabase();
    // 録音データテーブルから検索
    const recordingResult = await db.getFirstAsync<Recording>(
      'SELECT * FROM recordings WHERE id = ?;',
      [noteId]
    );
    if (recordingResult) {
      await db.runAsync(
        'UPDATE recordings SET title = ? WHERE id = ?;',
        [title, noteId]
      );
      console.log('Recording title updated successfully');
      return Promise.resolve();
    }
    // インポートファイルテーブルから検索
    const importResult = await db.getFirstAsync<ImportFile>(
      'SELECT * FROM imports WHERE id = ?;',
      [noteId]
    );
    if (importResult) {
      await db.runAsync(
        'UPDATE imports SET title = ? WHERE id = ?;',
        [title, noteId]
      );
      console.log('Import title updated successfully');
      return Promise.resolve();
    }
    throw new Error('Note not found');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error updating note title:', errorMessage);
    return Promise.reject(error);
  }
};

// ノート詳細画面用：noteIdでノートを更新する関数（後方互換性のため残す）
export const updateNote = async (noteId: string, title: string, content?: string): Promise<void> => {
  try {
    const db = getDatabase();
    // 録音データテーブルから検索
    const recordingResult = await db.getFirstAsync<Recording>(
      'SELECT * FROM recordings WHERE id = ?;',
      [noteId]
    );
    if (recordingResult) {
      // contentが指定されていない場合は、transcriptionを更新しない
      if (content !== undefined) {
        await db.runAsync(
          'UPDATE recordings SET title = ?, transcription = ? WHERE id = ?;',
          [title, content, noteId]
        );
      } else {
        await db.runAsync(
          'UPDATE recordings SET title = ? WHERE id = ?;',
          [title, noteId]
        );
      }
      console.log('Recording updated successfully');
      return Promise.resolve();
    }
    // インポートファイルテーブルから検索
    const importResult = await db.getFirstAsync<ImportFile>(
      'SELECT * FROM imports WHERE id = ?;',
      [noteId]
    );
    if (importResult) {
      await db.runAsync(
        'UPDATE imports SET title = ? WHERE id = ?;',
        [title, noteId]
      );
      console.log('Import updated successfully');
      return Promise.resolve();
    }
    throw new Error('Note not found');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error updating note:', errorMessage);
    return Promise.reject(error);
  }
};

// 録音データを削除する関数
export const deleteRecording = async (recordingId: string): Promise<void> => {
  try {
    const db = getDatabase();
    await db.runAsync(
      'DELETE FROM recordings WHERE id = ?;',
      [recordingId]
    );
    console.log('Recording deleted successfully');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error deleting recording:', errorMessage);
    return Promise.reject(error);
  }
};

// インポートファイルを削除する関数
export const deleteImport = async (importId: string): Promise<void> => {
  try {
    const db = getDatabase();
    await db.runAsync(
      'DELETE FROM imports WHERE id = ?;',
      [importId]
    );
    console.log('Import deleted successfully');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error deleting import:', errorMessage);
    return Promise.reject(error);
  }
};

// ノートを削除する統合関数（Recording または ImportFile）
export const deleteNote = async (noteId: string): Promise<void> => {
  try {
    const db = getDatabase();
    
    // 録音データテーブルから検索
    const recordingResult = await db.getFirstAsync<Recording>(
      'SELECT * FROM recordings WHERE id = ?;',
      [noteId]
    );
    if (recordingResult) {
      await deleteRecording(noteId);
      return Promise.resolve();
    }
    
    // インポートファイルテーブルから検索
    const importResult = await db.getFirstAsync<ImportFile>(
      'SELECT * FROM imports WHERE id = ?;',
      [noteId]
    );
    if (importResult) {
      await deleteImport(noteId);
      return Promise.resolve();
    }
    
    throw new Error('Note not found');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error deleting note:', errorMessage);
    return Promise.reject(error);
  }
};

export default {
  initDatabase,
  saveRecording,
  generateAITitle,
  saveImport,
  addToUploadQueue,
  getRecordings,
  getImports,
  getUploadQueue,
  updateUploadStatus,
  exportDatabase,
  getNoteById,
  updateNote,
  updateNoteTitle,
  deleteRecording,
  deleteImport,
  deleteNote
};
