/**
 * SyncQueueService - オフライン同期サービス
 * オフライン時のデータ変更をキューに保存し、
 * ネットワーク復旧時に自動同期を行う
 */

import { UniversalNote, SyncQueue } from '../types/UniversalNote';
import { universalNoteService } from './UniversalNoteService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 開発環境用のNetInfoモック
const NetInfo = {
  addEventListener: (callback: (state: any) => void) => {
    // 開発環境では常にオンライン状態をシミュレート
    callback({ isConnected: true, type: 'wifi' });
    return () => {}; // unsubscribe function
  },
  fetch: () => Promise.resolve({ isConnected: true, type: 'wifi' })
};

// ===============================
// インターフェース定義
// ===============================

export interface SyncQueueServiceConfig {
  enableAutoSync: boolean;
  syncIntervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
  batchSize: number;
  debugMode: boolean;
}

export type SyncItemStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncQueueItem {
  id: string;
  noteId: string;
  operation: 'create' | 'update' | 'delete';
  data: UniversalNote | null;
  timestamp: string;
  attempts: number;
  lastAttempt?: string;
  status: SyncItemStatus;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  skipped: number;
  errors: Array<{
    itemId: string;
    error: string;
  }>;
}

export interface NetworkStatus {
  isConnected: boolean;
  connectionType: string;
  lastChecked: string;
}

// ===============================
// SyncQueueService クラス
// ===============================

export class SyncQueueService {
  private config: SyncQueueServiceConfig;
  private syncQueue: Map<string, SyncQueueItem>;
  private syncTimer: NodeJS.Timeout | null = null;
  private networkStatus: NetworkStatus;
  private isSyncing = false;

  constructor(config: Partial<SyncQueueServiceConfig> = {}) {
    this.config = {
      enableAutoSync: true,
      syncIntervalMs: 30000, // 30秒間隔
      maxRetries: 3,
      retryDelayMs: 5000,
      batchSize: 10,
      debugMode: false,
      ...config
    };

    this.syncQueue = new Map();
    this.networkStatus = {
      isConnected: false,
      connectionType: 'unknown',
      lastChecked: new Date().toISOString()
    };

    this.initialize();
  }

  // ===============================
  // 初期化・セットアップ
  // ===============================

  private async initialize(): Promise<void> {
    try {
      // 保存されたキューを復元
      await this.restoreQueue();

      // ネットワーク状態監視開始
      this.startNetworkMonitoring();

      // 自動同期開始
      if (this.config.enableAutoSync) {
        this.startAutoSync();
      }

      this.log('SyncQueueService initialized', { 
        queueSize: this.syncQueue.size,
        config: this.config 
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('SyncQueueService initialization failed', { error: errorMessage });
    }
  }

  // ===============================
  // キュー操作
  // ===============================

  /**
   * ノート操作をキューに追加
   */
  async addToQueue(
    noteId: string, 
    operation: 'create' | 'update' | 'delete',
    data?: UniversalNote
  ): Promise<void> {
    try {
      const queueItem: SyncQueueItem = {
        id: `${noteId}-${operation}-${Date.now()}`,
        noteId,
        operation,
        data: data || null,
        timestamp: new Date().toISOString(),
        attempts: 0,
        status: 'pending',
      };

      this.syncQueue.set(queueItem.id, queueItem);
      await this.persistQueue();

      this.log('Item added to sync queue', { 
        itemId: queueItem.id,
        noteId,
        operation,
        queueSize: this.syncQueue.size
      });

      // ネットワークが利用可能な場合は即座に同期試行
      if (this.networkStatus.isConnected && !this.isSyncing) {
        this.performSync();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Failed to add item to queue', { noteId, operation, error: errorMessage });
    }
  }

  /**
   * キューから項目を削除
   */
  private removeFromQueue(itemId: string): void {
    this.syncQueue.delete(itemId);
    this.persistQueue();
  }

  /**
   * キューの状態を取得
   */
  getQueueStatus(): {
    total: number;
    pending: number;
    syncing: number;
    failed: number;
    synced: number;
  } {
    const items = Array.from(this.syncQueue.values());
    return {
      total: items.length,
      pending: items.filter(item => item.status === 'pending').length,
      syncing: items.filter(item => item.status === 'syncing').length,
      failed: items.filter(item => item.status === 'failed').length,
      synced: items.filter(item => item.status === 'synced').length
    };
  }

  // ===============================
  // 同期処理
  // ===============================

  /**
   * 手動同期実行
   */
  async performSync(): Promise<SyncResult> {
    if (this.isSyncing) {
      this.log('Sync already in progress, skipping');
      return {
        success: false,
        synced: 0,
        failed: 0,
        skipped: 0,
        errors: [{ itemId: 'system', error: 'Sync already in progress' }]
      };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    try {
      this.log('Sync started', { 
        queueSize: this.syncQueue.size,
        networkConnected: this.networkStatus.isConnected 
      });

      // ネットワーク状態確認
      if (!this.networkStatus.isConnected) {
        this.log('Network not available, skipping sync');
        return {
          success: false,
          synced: 0,
          failed: 0,
          skipped: this.syncQueue.size,
          errors: [{ itemId: 'network', error: 'Network not available' }]
        };
      }

      // 同期対象項目を取得（バッチサイズ分）
      const pendingItems = Array.from(this.syncQueue.values())
        .filter(item => item.status === 'pending' || 
                       (item.status === 'failed' && item.attempts < this.config.maxRetries))
        .slice(0, this.config.batchSize);

      // 各項目を同期
      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          result.synced++;
          this.removeFromQueue(item.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.failed++;
          result.errors.push({ itemId: item.id, error: errorMessage });
          
          // リトライ回数更新
          item.attempts++;
          item.lastAttempt = new Date().toISOString();
          item.error = errorMessage;
          
          if (item.attempts >= this.config.maxRetries) {
            item.status = 'failed';
          }
        }
      }

      await this.persistQueue();

      this.log('Sync completed', { 
        synced: result.synced,
        failed: result.failed,
        remainingQueue: this.syncQueue.size
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Sync failed', { error: errorMessage });
      result.success = false;
      result.errors.push({ itemId: 'system', error: errorMessage });
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * 個別項目の同期処理
   */
  private async syncItem(item: SyncQueueItem): Promise<void> {
    item.status = 'syncing';
    
    this.log('Syncing item', { 
      itemId: item.id,
      noteId: item.noteId,
      operation: item.operation 
    });

    switch (item.operation) {
      case 'create':
      case 'update':
        if (!item.data) {
          throw new Error('Data is required for create/update operations');
        }
        await universalNoteService.saveUniversalNote(item.data);
        break;

      case 'delete':
        await universalNoteService.deleteUniversalNote(item.noteId, 'manual'); // デフォルトタイプ
        break;

      default:
        throw new Error(`Unknown operation: ${item.operation}`);
    }

    item.status = 'synced';
    this.log('Item synced successfully', { itemId: item.id });
  }

  // ===============================
  // ネットワーク監視
  // ===============================

  private startNetworkMonitoring(): void {
    // NetInfo未実装のため、モック実装
    this.networkStatus = {
      isConnected: true, // 仮に常時接続として扱う
      connectionType: 'wifi',
      lastChecked: new Date().toISOString()
    };

    this.log('Network monitoring started', { status: this.networkStatus });
  }

  private async updateNetworkStatus(): Promise<void> {
    try {
      // 実際の実装では NetInfo.fetch() を使用
      this.networkStatus = {
        isConnected: true, // モック値
        connectionType: 'wifi',
        lastChecked: new Date().toISOString()
      };

      // ネットワーク復旧時の自動同期
      if (this.networkStatus.isConnected && this.syncQueue.size > 0) {
        this.log('Network restored, triggering sync');
        this.performSync();
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Failed to update network status', { error: errorMessage });
    }
  }

  // ===============================
  // 自動同期
  // ===============================

  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      if (this.networkStatus.isConnected && this.syncQueue.size > 0 && !this.isSyncing) {
        this.performSync();
      }
    }, this.config.syncIntervalMs);

    this.log('Auto sync started', { intervalMs: this.config.syncIntervalMs });
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.log('Auto sync stopped');
  }

  // ===============================
  // 永続化
  // ===============================

  private async persistQueue(): Promise<void> {
    try {
      const queueData = JSON.stringify(Array.from(this.syncQueue.entries()));
      await AsyncStorage.setItem('sync_queue', queueData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Failed to persist queue', { error: errorMessage });
    }
  }

  private async restoreQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem('sync_queue');
      if (queueData) {
        const entries: [string, SyncQueueItem][] = JSON.parse(queueData);
        this.syncQueue = new Map(entries);
        this.log('Queue restored', { size: this.syncQueue.size });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Failed to restore queue', { error: errorMessage });
      this.syncQueue = new Map();
    }
  }

  // ===============================
  // ユーティリティメソッド
  // ===============================

  private log(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.log(`🔄 SyncQueueService: ${message}`, data || '');
    }
  }

  // ===============================
  // パブリックメソッド
  // ===============================

  /**
   * ネットワーク状態取得
   */
  getNetworkStatus(): NetworkStatus {
    return { ...this.networkStatus };
  }

  /**
   * キュークリア
   */
  async clearQueue(): Promise<void> {
    this.syncQueue.clear();
    await this.persistQueue();
    this.log('Queue cleared');
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<SyncQueueServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 自動同期の再起動
    if (this.config.enableAutoSync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
    
    this.log('Config updated', { config: this.config });
  }

  /**
   * サービス停止
   */
  destroy(): void {
    this.stopAutoSync();
    this.persistQueue();
    this.log('SyncQueueService destroyed');
  }
}

// ===============================
// シングルトンインスタンス
// ===============================

export const syncQueueService = new SyncQueueService({
  enableAutoSync: true,
  syncIntervalMs: 30000,
  maxRetries: 3,
  batchSize: 10,
  debugMode: true
}); 