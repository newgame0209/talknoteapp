import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

/**
 * SQLiteデータベースサービス
 * ローカルデータの永続化を担当
 */

// データベース名
const DATABASE_NAME = 'talknote.db';

// データベース接続を取得
export const getDatabase = (): SQLite.SQLiteDatabase => {
  if (Platform.OS === 'web') {
    // Webプラットフォームでは警告を表示
    console.warn('SQLite is not supported on web platform');
    return null as unknown as SQLite.SQLiteDatabase;
  }
  return SQLite.openDatabase(DATABASE_NAME);
};

// データベース初期化
export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    // トランザクション内でテーブル作成
    db.transaction(
      (tx) => {
        // 録音データテーブル
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS recordings (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            duration INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            uploaded INTEGER DEFAULT 0,
            media_id TEXT,
            transcription TEXT
          );`,
          [],
          () => {
            console.log('Recordings table created successfully');
          },
          (_, error) => {
            console.error('Error creating recordings table:', error);
            return true; // トランザクションをロールバック
          }
        );
        
        // インポートファイルテーブル
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS imports (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            uploaded INTEGER DEFAULT 0,
            media_id TEXT
          );`,
          [],
          () => {
            console.log('Imports table created successfully');
          },
          (_, error) => {
            console.error('Error creating imports table:', error);
            return true; // トランザクションをロールバック
          }
        );
        
        // アップロードキューテーブル
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS upload_queue (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            item_id TEXT NOT NULL,
            status TEXT NOT NULL,
            attempts INTEGER DEFAULT 0,
            last_attempt INTEGER,
            created_at INTEGER NOT NULL
          );`,
          [],
          () => {
            console.log('Upload queue table created successfully');
          },
          (_, error) => {
            console.error('Error creating upload queue table:', error);
            return true; // トランザクションをロールバック
          }
        );
      },
      (error) => {
        console.error('Database transaction error:', error);
        reject(error);
      },
      () => {
        console.log('Database initialized successfully');
        resolve();
      }
    );
  });
};

// 録音データの保存
export const saveRecording = (
  id: string,
  title: string,
  duration: number,
  filePath: string,
  transcription?: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const now = Date.now();
    
    db.transaction(
      (tx) => {
        tx.executeSql(
          `INSERT INTO recordings (id, title, duration, file_path, created_at, transcription)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [id, title, duration, filePath, now, transcription || null],
          (_, result) => {
            console.log('Recording saved successfully:', result);
            resolve();
          },
          (_, error) => {
            console.error('Error saving recording:', error);
            reject(error);
            return true; // トランザクションをロールバック
          }
        );
      },
      (error) => {
        console.error('Transaction error:', error);
        reject(error);
      }
    );
  });
};

// インポートファイルの保存
export const saveImport = (
  id: string,
  title: string,
  filePath: string,
  fileType: string,
  fileSize: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const now = Date.now();
    
    db.transaction(
      (tx) => {
        tx.executeSql(
          `INSERT INTO imports (id, title, file_path, file_type, file_size, created_at)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [id, title, filePath, fileType, fileSize, now],
          (_, result) => {
            console.log('Import saved successfully:', result);
            resolve();
          },
          (_, error) => {
            console.error('Error saving import:', error);
            reject(error);
            return true; // トランザクションをロールバック
          }
        );
      },
      (error) => {
        console.error('Transaction error:', error);
        reject(error);
      }
    );
  });
};

// アップロードキューに追加
export const addToUploadQueue = (
  id: string,
  type: 'recording' | 'import',
  itemId: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const now = Date.now();
    
    db.transaction(
      (tx) => {
        tx.executeSql(
          `INSERT INTO upload_queue (id, type, item_id, status, created_at)
           VALUES (?, ?, ?, ?, ?);`,
          [id, type, itemId, 'pending', now],
          (_, result) => {
            console.log('Item added to upload queue:', result);
            resolve();
          },
          (_, error) => {
            console.error('Error adding to upload queue:', error);
            reject(error);
            return true; // トランザクションをロールバック
          }
        );
      },
      (error) => {
        console.error('Transaction error:', error);
        reject(error);
      }
    );
  });
};

// 録音データの取得（最新順）
export const getRecordings = (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    db.transaction(
      (tx) => {
        tx.executeSql(
          'SELECT * FROM recordings ORDER BY created_at DESC;',
          [],
          (_, result) => {
            const items = [];
            for (let i = 0; i < result.rows.length; i++) {
              items.push(result.rows.item(i));
            }
            resolve(items);
          },
          (_, error) => {
            console.error('Error getting recordings:', error);
            reject(error);
            return true; // トランザクションをロールバック
          }
        );
      },
      (error) => {
        console.error('Transaction error:', error);
        reject(error);
      }
    );
  });
};

// インポートファイルの取得（最新順）
export const getImports = (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    db.transaction(
      (tx) => {
        tx.executeSql(
          'SELECT * FROM imports ORDER BY created_at DESC;',
          [],
          (_, result) => {
            const items = [];
            for (let i = 0; i < result.rows.length; i++) {
              items.push(result.rows.item(i));
            }
            resolve(items);
          },
          (_, error) => {
            console.error('Error getting imports:', error);
            reject(error);
            return true; // トランザクションをロールバック
          }
        );
      },
      (error) => {
        console.error('Transaction error:', error);
        reject(error);
      }
    );
  });
};

// アップロードキューの取得（ステータス別）
export const getUploadQueue = (status?: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    db.transaction(
      (tx) => {
        let query = 'SELECT * FROM upload_queue';
        const params = [];
        
        if (status) {
          query += ' WHERE status = ?';
          params.push(status);
        }
        
        query += ' ORDER BY created_at ASC;';
        
        tx.executeSql(
          query,
          params,
          (_, result) => {
            const items = [];
            for (let i = 0; i < result.rows.length; i++) {
              items.push(result.rows.item(i));
            }
            resolve(items);
          },
          (_, error) => {
            console.error('Error getting upload queue:', error);
            reject(error);
            return true; // トランザクションをロールバック
          }
        );
      },
      (error) => {
        console.error('Transaction error:', error);
        reject(error);
      }
    );
  });
};

// アップロードステータスの更新
export const updateUploadStatus = (
  id: string,
  status: string,
  mediaId?: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const now = Date.now();
    
    db.transaction(
      (tx) => {
        tx.executeSql(
          `UPDATE upload_queue 
           SET status = ?, last_attempt = ?, attempts = attempts + 1
           WHERE id = ?;`,
          [status, now, id],
          (_, result) => {
            if (mediaId) {
              // アップロード成功時、元のアイテムのメディアIDを更新
              tx.executeSql(
                `SELECT type, item_id FROM upload_queue WHERE id = ?;`,
                [id],
                (_, queueResult) => {
                  if (queueResult.rows.length > 0) {
                    const { type, item_id } = queueResult.rows.item(0);
                    const table = type === 'recording' ? 'recordings' : 'imports';
                    
                    tx.executeSql(
                      `UPDATE ${table} SET uploaded = 1, media_id = ? WHERE id = ?;`,
                      [mediaId, item_id],
                      () => {
                        console.log(`Updated ${type} with media ID:`, mediaId);
                      },
                      (_, error) => {
                        console.error(`Error updating ${type}:`, error);
                        return false; // トランザクションを続行
                      }
                    );
                  }
                },
                (_, error) => {
                  console.error('Error getting queue item:', error);
                  return false; // トランザクションを続行
                }
              );
            }
            
            console.log('Upload status updated:', result);
            resolve();
          },
          (_, error) => {
            console.error('Error updating upload status:', error);
            reject(error);
            return true; // トランザクションをロールバック
          }
        );
      },
      (error) => {
        console.error('Transaction error:', error);
        reject(error);
      }
    );
  });
};

// データベースエクスポート（デバッグ用）
export const exportDatabase = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const result: any = {
      recordings: [],
      imports: [],
      upload_queue: []
    };
    
    db.transaction(
      (tx) => {
        // 録音データの取得
        tx.executeSql(
          'SELECT * FROM recordings;',
          [],
          (_, recordingsResult) => {
            for (let i = 0; i < recordingsResult.rows.length; i++) {
              result.recordings.push(recordingsResult.rows.item(i));
            }
            
            // インポートデータの取得
            tx.executeSql(
              'SELECT * FROM imports;',
              [],
              (_, importsResult) => {
                for (let i = 0; i < importsResult.rows.length; i++) {
                  result.imports.push(importsResult.rows.item(i));
                }
                
                // アップロードキューの取得
                tx.executeSql(
                  'SELECT * FROM upload_queue;',
                  [],
                  (_, queueResult) => {
                    for (let i = 0; i < queueResult.rows.length; i++) {
                      result.upload_queue.push(queueResult.rows.item(i));
                    }
                    
                    resolve(result);
                  },
                  (_, error) => {
                    console.error('Error exporting upload queue:', error);
                    reject(error);
                    return true;
                  }
                );
              },
              (_, error) => {
                console.error('Error exporting imports:', error);
                reject(error);
                return true;
              }
            );
          },
          (_, error) => {
            console.error('Error exporting recordings:', error);
            reject(error);
            return true;
          }
        );
      },
      (error) => {
        console.error('Transaction error:', error);
        reject(error);
      }
    );
  });
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
