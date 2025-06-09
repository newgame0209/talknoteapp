/**
 * UniversalNoteService - 統一ノートサービス
 * 4つのノートタイプ（recording, photo_scan, import, manual）に対応した
 * 統一データベースアクセス層
 */

import { 
  UniversalNote, 
  NoteType, 
  SaveResult, 
  ValidationResult
} from '../types/UniversalNote';
import { 
  saveRecording, 
  getNoteById, 
  deleteNote,
  getAllNotes,
  updateCanvasData,
  savePhotoScan,
  deletePhotoScan,
  saveImport,
  updateNote
} from './database';
import { DEFAULT_AUTO_SAVE_CONFIG } from '../constants/AutoSaveConfig';

// ===============================
// インターフェース定義
// ===============================

export interface UniversalNoteServiceConfig {
  enableValidation: boolean;
  enableCaching: boolean;
  enableRetry: boolean;
  maxRetries: number;
  retryDelayMs: number;
  debugMode: boolean;
}

export interface SaveOptions {
  skipValidation?: boolean;
  forceSave?: boolean;
  includePages?: boolean;
}

export interface ServiceMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  lastOperationTime: string;
}

// ===============================
// UniversalNoteService クラス
// ===============================

export class UniversalNoteService {
  private config: UniversalNoteServiceConfig;
  private cache: Map<string, UniversalNote>;
  private metrics: ServiceMetrics;

  constructor(config: Partial<UniversalNoteServiceConfig> = {}) {
    this.config = {
      enableValidation: true,
      enableCaching: true,
      enableRetry: true,
      maxRetries: DEFAULT_AUTO_SAVE_CONFIG.maxRetries,
      retryDelayMs: DEFAULT_AUTO_SAVE_CONFIG.retryDelayMs,
      debugMode: false,
      ...config
    };

    this.cache = new Map();
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      lastOperationTime: new Date().toISOString()
    };

    this.log('UniversalNoteService initialized', { config: this.config });
  }

  // ===============================
  // CRUD操作（統一インターフェース）
  // ===============================

  /**
   * ノート保存（統一処理）
   */
  async saveUniversalNote(note: UniversalNote, options: SaveOptions = {}): Promise<SaveResult> {
    const startTime = performance.now();
    this.updateMetrics('start');

    try {
      this.log('saveNote開始', { noteId: note.id, type: note.type });

      // バリデーション
      if (this.config.enableValidation && !options.skipValidation) {
        const validation = await this.validateNote(note);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }

      // ノートタイプ別処理
      let success = false;
      const currentPageIndex = note.currentPageIndex || 0;
      const currentPageData = note.pages[currentPageIndex] || note.pages[0];
      const canvasContent = JSON.stringify(currentPageData?.canvasData || {});

      try {
        console.log('🚨🚨🚨 CRITICAL saveUniversalNote処理開始:', {
          noteId: note.id,
          noteType: note.type,
          title: note.title,
          currentPageIndex,
          hasCurrentPageData: !!currentPageData,
          canvasDataKeys: currentPageData?.canvasData ? Object.keys(currentPageData.canvasData) : []
        });

        switch (note.type) {
          case 'recording':
            // 🔥 録音ノート保存処理の詳細ログ
            console.log('🎤 UniversalNoteService recording保存開始:', {
              noteId: note.id,
              title: note.title,
              hasCanvasData: !!currentPageData?.canvasData,
              canvasDataKeys: currentPageData?.canvasData ? Object.keys(currentPageData.canvasData) : [],
              contentLength: currentPageData?.canvasData?.content?.length || 0,
              pathsCount: currentPageData?.canvasData?.drawingPaths?.length || 0,
              hasCanvasSettings: !!currentPageData?.canvasData?.canvasSettings
            });
            
            // updateCanvasDataを直接使用してcanvasData全体を保存
            await updateCanvasData(note.id, currentPageData?.canvasData || {});
            success = true;
            console.log('🎤 録音ノート保存完了 (updateCanvasData使用)');
            break;

          case 'photo_scan':
            // 🔥 写真スキャン保存処理の詳細ログ
            console.log('📸📸📸 UniversalNoteService photo_scan保存開始:', {
              noteId: note.id,
              title: note.title,
              hasCanvasData: !!currentPageData?.canvasData,
              canvasDataKeys: currentPageData?.canvasData ? Object.keys(currentPageData.canvasData) : [],
              contentLength: currentPageData?.canvasData?.content?.length || 0,
              pathsCount: currentPageData?.canvasData?.drawingPaths?.length || 0,
              hasCanvasSettings: !!currentPageData?.canvasData?.canvasSettings
            });
            
            // updateCanvasDataを直接使用してcanvasData全体を保存
            await updateCanvasData(note.id, currentPageData?.canvasData || {});
            success = true;
            console.log('📸📸📸 写真スキャン保存完了 (updateCanvasData使用)');
            break;

          case 'import':
            await saveImport(
              note.id,
              note.title,
              '', // filePath
              'text', // fileType
              canvasContent.length // fileSize
            );
            success = true;
            break;

          case 'manual':
            await updateNote(note.id, note.title, canvasContent);
            success = true;
            break;

          default:
            throw new Error(`Unknown note type: ${note.type}`);
        }
      } catch (error) {
        success = false;
        throw error;
      }

      // キャッシュ更新
      if (this.config.enableCaching && success) {
        this.cache.set(note.id, { ...note, lastSaved: new Date().toISOString() });
      }

      const endTime = performance.now();
      this.updateMetrics('success', endTime - startTime);

      this.log('saveNote完了', { 
        noteId: note.id, 
        success,
        duration: `${(endTime - startTime).toFixed(2)}ms`
      });

      return {
        success,
        savedAt: new Date().toISOString(),
        noteId: note.id,
        metrics: {
          saveTime: endTime - startTime,
          dataSize: JSON.stringify(note).length
        }
      };

    } catch (error) {
      const endTime = performance.now();
      this.updateMetrics('failed', endTime - startTime);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('saveNote失敗', { noteId: note.id, error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        savedAt: new Date().toISOString(),
        noteId: note.id
      };
    }
  }

  /**
   * ノート読み込み（統一処理）
   */
  async loadUniversalNote(noteId: string): Promise<UniversalNote | null> {
    const startTime = performance.now();
    this.updateMetrics('start');

    try {
      this.log('loadNote開始', { noteId });

      // キャッシュ確認
      if (this.config.enableCaching && this.cache.has(noteId)) {
        const cached = this.cache.get(noteId)!;
        this.updateMetrics('success', performance.now() - startTime);
        this.log('loadNote完了（キャッシュ）', { noteId });
        return cached;
      }

      // データベースから読み込み
      const note = await getNoteById(noteId);
      if (!note) {
        this.log('loadNote失敗', { noteId, reason: 'ノートが見つからない' });
        return null;
      }

      // UniversalNote形式に変換
      const universalNote = await this.convertToUniversalNote(note);

      // キャッシュ保存
      if (this.config.enableCaching) {
        this.cache.set(noteId, universalNote);
      }

      const endTime = performance.now();
      this.updateMetrics('success', endTime - startTime);

      this.log('loadNote完了', { 
        noteId, 
        type: universalNote.type,
        duration: `${(endTime - startTime).toFixed(2)}ms`
      });

      return universalNote;

    } catch (error) {
      const endTime = performance.now();
      this.updateMetrics('failed', endTime - startTime);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('loadNote失敗', { noteId, error: errorMessage });

      return null;
    }
  }

  /**
   * ノート削除（統一処理）
   */
  async deleteUniversalNote(noteId: string, noteType: NoteType): Promise<boolean> {
    const startTime = performance.now();
    this.updateMetrics('start');

    try {
      this.log('deleteNote開始', { noteId, noteType });

      // ノートタイプ別削除処理
      let success = false;
      try {
        switch (noteType) {
          case 'photo_scan':
            await deletePhotoScan(noteId);
            success = true;
            break;
          default:
            await deleteNote(noteId);
            success = true;
            break;
        }
      } catch (error) {
        success = false;
        throw error;
      }

      // キャッシュから削除
      if (this.config.enableCaching) {
        this.cache.delete(noteId);
      }

      const endTime = performance.now();
      this.updateMetrics('success', endTime - startTime);

      this.log('deleteNote完了', { 
        noteId, 
        success,
        duration: `${(endTime - startTime).toFixed(2)}ms`
      });

      return success;

    } catch (error) {
      const endTime = performance.now();
      this.updateMetrics('failed', endTime - startTime);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('deleteNote失敗', { noteId, error: errorMessage });

      return false;
    }
  }

  /**
   * 全ノート取得（統一処理）
   */
  async getAllUniversalNotes(): Promise<UniversalNote[]> {
    const startTime = performance.now();
    this.updateMetrics('start');

    try {
      this.log('getAllNotes開始');

      // データベースから全ノート取得
      const notes = await getAllNotes();

      // UniversalNote形式に変換
      const universalNotes: UniversalNote[] = [];
      for (const note of notes) {
        const universalNote = await this.convertToUniversalNote(note);
        universalNotes.push(universalNote);
      }

      // キャッシュ更新
      if (this.config.enableCaching) {
        universalNotes.forEach(note => {
          this.cache.set(note.id, note);
        });
      }

      const endTime = performance.now();
      this.updateMetrics('success', endTime - startTime);

      this.log('getAllNotes完了', { 
        count: universalNotes.length,
        duration: `${(endTime - startTime).toFixed(2)}ms`
      });

      return universalNotes;

    } catch (error) {
      const endTime = performance.now();
      this.updateMetrics('failed', endTime - startTime);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('getAllNotes失敗', { error: errorMessage });

      return [];
    }
  }

  // ===============================
  // ユーティリティメソッド
  // ===============================

  private async convertToUniversalNote(dbNote: any): Promise<UniversalNote> {
    // データベースオブジェクトをUniversalNote形式に変換
    const universalNote: UniversalNote = {
      id: dbNote.id,
      type: this.detectNoteType(dbNote),
      title: dbNote.title,
      pages: [{
        pageId: `${dbNote.id}-page-0`,
        pageNumber: 0,
        canvasData: {
          type: 'canvas',
          version: '1.0',
          content: dbNote.content || '',
          drawingPaths: [],
          textElements: [],
          canvasSettings: {
            paperType: 'blank',
            paperColor: '#ffffff',
            orientation: 'portrait',
            zoom: 1.0
          },
          contentLength: (dbNote.content || '').length,
          pathsCount: 0,
          elementsCount: 0
        },
        lastModified: dbNote.updated_at || new Date().toISOString(),
        pageMetadata: {
          audioUri: dbNote.file_path,
          transcriptText: dbNote.transcription,
          enhancedText: ''
        }
      }],
      currentPageIndex: 0,
      metadata: {
        createdAt: new Date(dbNote.created_at || Date.now()).toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        folder: undefined
      },
      lastModified: new Date().toISOString(),
      lastSaved: new Date().toISOString(),
      autoSaveEnabled: true
    };

    // ノートタイプ別メタデータ設定
    this.setNoteTypeMetadata(universalNote, dbNote);

    return universalNote;
  }

  private detectNoteType(dbNote: any): NoteType {
    if (dbNote.type) return dbNote.type;
    if (dbNote.file_path && dbNote.duration !== undefined) return 'recording';
    if (dbNote.photos) return 'photo_scan';
    if (dbNote.file_type) return 'import';
    return 'manual';
  }

  private setNoteTypeMetadata(note: UniversalNote, dbNote: any): void {
    switch (note.type) {
      case 'recording':
        note.metadata.recordingMetadata = {
          originalAudioUri: dbNote.file_path || '',
          duration: dbNote.duration || 0,
          sttProvider: 'google',
          sttConfidence: 0.95,
          language: 'ja'
        };
        break;
      case 'photo_scan':
        note.metadata.photoScanMetadata = {
          originalPhotoUris: dbNote.photos ? JSON.parse(dbNote.photos).map((p: any) => p.uri) : [],
          ocrProvider: 'google_vision',
          ocrConfidence: 0.95,
          language: 'ja'
        };
        break;
      case 'import':
        note.metadata.importMetadata = {
          sourceType: dbNote.file_type || 'text',
          sourceUri: dbNote.file_path || '',
          importedAt: new Date(dbNote.created_at || Date.now()).toISOString(),
          processedPages: 1
        };
        break;
      case 'manual':
        note.metadata.manualMetadata = {};
        break;
    }
  }

  private async validateNote(note: UniversalNote): Promise<ValidationResult> {
    const errors: Array<{field: string, message: string, code: string}> = [];
    const warnings: Array<{field: string, message: string, suggestion?: string}> = [];

    // 基本バリデーション
    if (!note.id) {
      errors.push({ field: 'id', message: 'Note ID is required', code: 'REQUIRED' });
    }
    if (!note.title || note.title.trim().length === 0) {
      warnings.push({ 
        field: 'title', 
        message: 'Title is empty', 
        suggestion: 'Set a descriptive title for better organization' 
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private updateMetrics(
    operation: 'start' | 'success' | 'failed', 
    responseTime?: number
  ): void {
    this.metrics.totalOperations++;
    this.metrics.lastOperationTime = new Date().toISOString();

    if (operation === 'success') {
      this.metrics.successfulOperations++;
      if (responseTime !== undefined) {
        this.metrics.averageResponseTime = 
          (this.metrics.averageResponseTime * (this.metrics.successfulOperations - 1) + responseTime) / 
          this.metrics.successfulOperations;
      }
    } else if (operation === 'failed') {
      this.metrics.failedOperations++;
    }
  }

  private log(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.log(`🗄️ UniversalNoteService: ${message}`, data || '');
    }
  }

  // ===============================
  // パブリックメソッド
  // ===============================

  /**
   * サービス統計取得
   */
  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * キャッシュクリア
   */
  clearCache(): void {
    this.cache.clear();
    this.log('キャッシュクリア完了');
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<UniversalNoteServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('設定更新完了', { config: this.config });
  }
}

// ===============================
// シングルトンインスタンス
// ===============================

export const universalNoteService = new UniversalNoteService({
  enableValidation: true,
  enableCaching: true,
  enableRetry: true,
  debugMode: true
}); 