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

// 写真スキャン用の新しいインターフェース
export interface PhotoScan {
  id: string;
  title: string;
  photos: {
    uri: string;
    processedUri?: string;
    ocrResult?: {
      text: string;
      confidence: number;
      enhancedText?: string; // AI整形済みテキスト
    };
  }[];
  created_at: number;
  uploaded: number;
  media_id?: string;
}

export interface UploadQueueItem {
  id: string;
  type: 'recording' | 'import' | 'photo_scan';
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
    
    // 写真スキャンデータテーブル
    await db.execAsync(`CREATE TABLE IF NOT EXISTS photo_scans (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        photos TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        uploaded INTEGER DEFAULT 0,
        media_id TEXT
    );`);
    console.log('Photo scans table created successfully');
    
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

// 写真スキャンデータの保存
export const savePhotoScan = async (
  id: string,
  title: string = "AIがタイトルを生成中…",
  photos: PhotoScan['photos']
): Promise<void> => {
  try {
    const db = getDatabase();
    const now = Date.now();
    
    // 既存レコードをチェック
    const existing = await db.getFirstAsync<{id: string}>(
      `SELECT id FROM photo_scans WHERE id = ?;`,
      [id]
    );
    
    if (existing) {
      // 既存の場合はphotosのみ更新
      await db.runAsync(
        `UPDATE photo_scans SET photos = ? WHERE id = ?;`,
        [JSON.stringify(photos), id]
      );
      console.log('Photo scan updated successfully');
    } else {
      // 新規の場合はINSERT
      await db.runAsync(
        `INSERT INTO photo_scans (id, title, photos, created_at)
         VALUES (?, ?, ?, ?);`,
        [id, title, JSON.stringify(photos), now]
      );
      console.log('Photo scan saved successfully');
    }
    
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error saving photo scan:', errorMessage);
    return Promise.reject(error);
  }
};

// 写真スキャン用AIタイトル生成
export const generatePhotoScanAITitle = async (photoScanId: string, ocrText: string): Promise<void> => {
  try {
    console.log('[generatePhotoScanAITitle] 開始 - photoScanId:', photoScanId, 'ocrText長:', ocrText.length);
    
    // AI APIでタイトル生成
    console.log('[generatePhotoScanAITitle] AI APIを呼び出し中...');
    const response = await aiApi.generateTitle(ocrText, 15); // 最大15文字
    console.log('[generatePhotoScanAITitle] AI APIレスポンス:', response);
    
    const generatedTitle = response.title;
    console.log('[generatePhotoScanAITitle] 生成されたタイトル:', generatedTitle);

    // 写真スキャンのタイトルを更新
    console.log('[generatePhotoScanAITitle] データベース更新中...');
    await updatePhotoScanTitle(photoScanId, generatedTitle);
    console.log('[generatePhotoScanAITitle] AI title generated and updated successfully');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[generatePhotoScanAITitle] Error generating AI title:', errorMessage);
    return Promise.reject(error);
  }
};

// アップロードキューに追加
export const addToUploadQueue = async (
  id: string,
  type: 'recording' | 'import' | 'photo_scan',
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

// 写真スキャンの取得（最新順）
export const getPhotoScans = async (): Promise<PhotoScan[]> => {
  try {
    const db = getDatabase();
    
    const result = await db.getAllAsync<{
      id: string;
      title: string;
      photos: string;
      created_at: number;
      uploaded: number;
      media_id?: string;
    }>('SELECT * FROM photo_scans ORDER BY created_at DESC;');
    
    // photosフィールドをJSONパースして返す
    return (result || []).map(row => ({
      ...row,
      photos: JSON.parse(row.photos)
    }));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error getting photo scans:', errorMessage);
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

// 写真スキャンのタイトルを更新する関数
export const updatePhotoScanTitle = async (photoScanId: string, title: string): Promise<void> => {
  try {
    const db = getDatabase();
    await db.runAsync(
      'UPDATE photo_scans SET title = ? WHERE id = ?;',
      [title, photoScanId]
    );
    console.log('Photo scan title updated successfully');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error updating photo scan title:', errorMessage);
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

// キャンバスデータ専用の更新関数
export const updateCanvasData = async (noteId: string, canvasData: any): Promise<void> => {
  try {
    const db = getDatabase();
    const canvasJson = JSON.stringify(canvasData);
    
    // 録音データテーブルから検索
    const recordingResult = await db.getFirstAsync<Recording>(
      'SELECT * FROM recordings WHERE id = ?;',
      [noteId]
    );
    if (recordingResult) {
      await db.runAsync(
        'UPDATE recordings SET transcription = ? WHERE id = ?;',
        [canvasJson, noteId]
      );
      console.log('Canvas data updated successfully (recording)');
      return Promise.resolve();
    }
    
    // 写真スキャンテーブルから検索
    const photoScanResult = await db.getFirstAsync<PhotoScan>(
      'SELECT * FROM photo_scans WHERE id = ?;',
      [noteId]
    );
    if (photoScanResult) {
      // 🔥 写真スキャンノート専用の保存処理改善
      try {
        const currentPhotos = JSON.parse(photoScanResult.photos as unknown as string);
        
        // キャンバスデータを写真の最初の要素のcanvasDataフィールドに保存
        if (currentPhotos.length > 0) {
          currentPhotos[0].canvasData = canvasData;
          
          await db.runAsync(
            'UPDATE photo_scans SET photos = ? WHERE id = ?;',
            [JSON.stringify(currentPhotos), noteId]
          );
          console.log('Canvas data updated successfully (photo scan)');
          return Promise.resolve();
        } else {
          console.error('写真スキャンデータが空です');
          throw new Error('No photos in photo scan data');
        }
      } catch (parseError) {
        console.error('写真スキャンデータのJSON解析エラー:', parseError);
        throw new Error('Failed to parse photo scan data');
      }
    }
    
    // インポートファイルテーブルには対応しない（将来拡張可能）
    throw new Error('Note not found or not a recording/photo scan');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error updating canvas data:', errorMessage);
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

// 写真スキャンを削除する関数
export const deletePhotoScan = async (photoScanId: string): Promise<void> => {
  try {
    const db = getDatabase();
    await db.runAsync(
      'DELETE FROM photo_scans WHERE id = ?;',
      [photoScanId]
    );
    console.log('Photo scan deleted successfully');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error deleting photo scan:', errorMessage);
    return Promise.reject(error);
  }
};

// ノートを削除する統合関数（Recording、ImportFile、PhotoScan対応）
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
    
    // 写真スキャンテーブルから検索
    const photoScanResult = await db.getFirstAsync<PhotoScan>(
      'SELECT * FROM photo_scans WHERE id = ?;',
      [noteId]
    );
    if (photoScanResult) {
      await deletePhotoScan(noteId);
      return Promise.resolve();
    }
    
    throw new Error('Note not found');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error deleting note:', errorMessage);
    return Promise.reject(error);
  }
};

// すべてのノート（録音 + インポート + 写真スキャン）を統合して取得
export const getAllNotes = async (): Promise<Recording[]> => {
  try {
    const db = getDatabase();
    
    // 録音データ、インポートファイル、写真スキャンを統合してRecording型として返す
    const result = await db.getAllAsync<Recording>(
      `SELECT 
        id,
        title,
        duration,
        file_path,
        created_at,
        uploaded,
        media_id,
        transcription
      FROM recordings
      UNION ALL
      SELECT 
        id,
        title,
        0 as duration,
        file_path,
        created_at,
        uploaded,
        media_id,
        NULL as transcription
      FROM imports
      UNION ALL
      SELECT 
        id,
        title,
        0 as duration,
        'photo_scan' as file_path,
        created_at,
        uploaded,
        media_id,
        photos as transcription
      FROM photo_scans
      ORDER BY created_at DESC;`
    );
    
    console.log('[getAllNotes] 取得したノート数:', result.length);
    return result || [];
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error getting all notes:', errorMessage);
    return Promise.reject(error);
  }
};

export default {
  initDatabase,
  saveRecording,
  generateAITitle,
  saveImport,
  savePhotoScan,
  generatePhotoScanAITitle,
  addToUploadQueue,
  getRecordings,
  getImports,
  getPhotoScans,
  getUploadQueue,
  updateUploadStatus,
  exportDatabase,
  getNoteById,
  updateNote,
  updateCanvasData,
  updateNoteTitle,
  updatePhotoScanTitle,
  deleteRecording,
  deleteImport,
  deletePhotoScan,
  deleteNote,
  getAllNotes
};
