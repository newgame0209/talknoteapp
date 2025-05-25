// データベース機能を一時的に無効化し、モック実装に置き換え
// これはデザイン確認用の一時的な対応です
import { Platform } from 'react-native';


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
    await db.execAsync([{
      sql: `CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        duration INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        uploaded INTEGER DEFAULT 0,
        media_id TEXT,
        transcription TEXT
      );`
    }]);
    console.log('Recordings table created successfully');
    
    // インポートファイルテーブル
    await db.execAsync([{
      sql: `CREATE TABLE IF NOT EXISTS imports (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        uploaded INTEGER DEFAULT 0,
        media_id TEXT
      );`
    }]);
    console.log('Imports table created successfully');
    
    // アップロードキューテーブル
    await db.execAsync([{
      sql: `CREATE TABLE IF NOT EXISTS upload_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_attempt INTEGER,
        created_at INTEGER NOT NULL
      );`
    }]);
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
  title: string,
  duration: number,
  filePath: string,
  transcription?: string
): Promise<void> => {
  try {
    const db = getDatabase();
    const now = Date.now();
    
    await db.execAsync([{
      sql: `INSERT INTO recordings (id, title, duration, file_path, created_at, transcription)
            VALUES (?, ?, ?, ?, ?, ?);`,
      args: [id, title, duration, filePath, now, transcription || null]
    }]);
    
    console.log('Recording saved successfully');
    return Promise.resolve();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error saving recording:', errorMessage);
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
    
    await db.execAsync([{
      sql: `INSERT INTO imports (id, title, file_path, file_type, file_size, created_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
      args: [id, title, filePath, fileType, fileSize, now]
    }]);
    
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
    
    await db.execAsync([{
      sql: `INSERT INTO upload_queue (id, type, item_id, status, created_at)
           VALUES (?, ?, ?, ?, ?);`,
      args: [id, type, itemId, 'pending', now]
    }]);
    
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
    
    const result = await db.execAsync([
      { sql: 'SELECT * FROM recordings ORDER BY created_at DESC;' }
    ]);
    
    const recordings: Recording[] = [];
    // execAsyncは各SQL文の結果を配列で返す
    if (result && result.length > 0 && result[0].rows) {
      const rows = result[0].rows;
      for (let i = 0; i < rows.length; i++) {
        recordings.push(rows.item(i) as Recording);
      }
    }
    
    return recordings;
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
    
    const result = await db.execAsync([
      { sql: 'SELECT * FROM imports ORDER BY created_at DESC;' }
    ]);
    
    const imports: ImportFile[] = [];
    if (result && result.length > 0 && result[0].rows) {
      const rows = result[0].rows;
      for (let i = 0; i < rows.length; i++) {
        imports.push(rows.item(i) as ImportFile);
      }
    }
    
    return imports;
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
    const params: (string)[] = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at ASC;';
    
    const result = await db.execAsync([
      { 
        sql: query,
        args: params
      }
    ]);
    
    const items: UploadQueueItem[] = [];
    if (result && result.length > 0 && result[0].rows) {
      const rows = result[0].rows;
      for (let i = 0; i < rows.length; i++) {
        items.push(rows.item(i) as UploadQueueItem);
      }
    }
    
    return items;
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
    await db.execAsync([
      {
        sql: `UPDATE upload_queue 
             SET status = ?, last_attempt = ?, attempts = attempts + 1
             WHERE id = ?;`,
        args: [status, now, id]
      }
    ]);
    
    if (mediaId) {
      // アップロード成功時、元のアイテムのメディアIDを更新
      // まずキューアイテムの情報を取得
      const queueResult = await db.execAsync([
        {
          sql: `SELECT type, item_id FROM upload_queue WHERE id = ?;`,
          args: [id]
        }
      ]);
      
      if (queueResult && queueResult.length > 0 && queueResult[0].rows.length > 0) {
        const item = queueResult[0].rows.item(0);
        const { type, item_id } = item;
        const table = type === 'recording' ? 'recordings' : 'imports';
        
        // 元のレコーディングかインポートアイテムを更新
        try {
          await db.execAsync([
            {
              sql: `UPDATE ${table} SET uploaded = 1, media_id = ? WHERE id = ?;`,
              args: [mediaId, item_id]
            }
          ]);
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
    const db = getDatabase();
    
    // 全テーブルのデータを取得
    const recordingsResult = await db.execAsync([
      { sql: 'SELECT * FROM recordings ORDER BY created_at DESC;' }
    ]);
    
    const recordings: Recording[] = [];
    if (recordingsResult && recordingsResult.length > 0 && recordingsResult[0].rows) {
      const rows = recordingsResult[0].rows;
      for (let i = 0; i < rows.length; i++) {
        recordings.push(rows.item(i) as Recording);
      }
    }
    
    const importsResult = await db.execAsync([
      { sql: 'SELECT * FROM imports ORDER BY created_at DESC;' }
    ]);
    
    const imports: ImportFile[] = [];
    if (importsResult && importsResult.length > 0 && importsResult[0].rows) {
      const rows = importsResult[0].rows;
      for (let i = 0; i < rows.length; i++) {
        imports.push(rows.item(i) as ImportFile);
      }
    }
    
    const queueResult = await db.execAsync([
      { sql: 'SELECT * FROM upload_queue ORDER BY created_at ASC;' }
    ]);
    
    const queue: UploadQueueItem[] = [];
    if (queueResult && queueResult.length > 0 && queueResult[0].rows) {
      const rows = queueResult[0].rows;
      for (let i = 0; i < rows.length; i++) {
        queue.push(rows.item(i) as UploadQueueItem);
      }
    }
    
    return { recordings, imports, queue };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error exporting database:', errorMessage);
    return Promise.reject(error);
  }
};

export default {
  initDatabase,
  saveRecording,
  saveImport,
  addToUploadQueue,
  getRecordings,
  getImports,
  getUploadQueue,
  updateUploadStatus,
  exportDatabase
};
