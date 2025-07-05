/**
 * UniversalNoteService - 統一ノートサービス
 * 4つのノートタイプ（recording, photo_scan, import, manual）に対応した
 * 統一データベースアクセス層
 */

import { 
  UniversalNote, 
  UniversalPage,
  CanvasData,
  NoteType, 
  SaveResult, 
  ValidationResult,
  SyncQueue,
  QueuedSaveOperation,
  QueuedDeleteOperation,
  PageOperation,
  PageOperationData,
  AIProcessingState,
  MediaProcessingState,
  AutoSaveConfig,
  AutoSaveState,
  AutoSaveMetrics,
  PerformanceMetrics,
  CropRegion
} from '../types/UniversalNote';
import { 
  getNotesFromSQLite, 
  updateNote, 
  deleteNote,
  getAllNotes,
  updateCanvasData,
  savePhotoScan,
  deletePhotoScan,
  saveImport,
  saveRecording,
  saveManualNote,
  generateAITitle,
  generateManualNoteAITitle,
  generatePhotoScanAITitle,
  type Recording,
  type ImportFile,
  type ManualNote,
  type PhotoScan
} from './database';
import { DEFAULT_AUTO_SAVE_CONFIG } from '../constants/AutoSaveConfig';
import { aiApi } from './api';
import { MultiPageService } from './MultiPageService';
import { getCurrentIdToken } from './auth';

// 🆕 API設定をConstants.expoConfigから取得（EAS環境対応）
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.0.92:8000';

// 🆕 認証トークン取得関数
const getAuthToken = async (): Promise<string> => {
  try {
    const token = await getCurrentIdToken();
    return token || 'demo_token_for_development';
  } catch (error) {
    console.error('認証トークン取得エラー:', error);
    return 'demo_token_for_development';
  }
};

// 🆕 画像アップロード結果の型定義
interface ImageUploadResult {
  pageId: string;
  pageNumber: number;
  uploadResult?: {
    status: string;
    note_id: string;
    page_id: string;
    file_path?: string;
    local_url?: string;
    gcs_url?: string;
    message: string;
  };
  originalPhotoUri: string;
  error?: string;
}

// 🆕 機能フラグ確認関数
const checkImportSplitEnabled = async (): Promise<boolean> => {
  try {
    // 環境変数やAPIから機能フラグを取得
    return process.env.EXPO_PUBLIC_IMPORT_SPLIT_ENABLED === 'true';
  } catch (error) {
    console.error('機能フラグ確認エラー:', error);
    return false; // デフォルトは無効
  }
};

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

// 🆕 写真スキャン用のページデータ型
export interface PhotoPageData {
  photoUri: string;
  ocrText: string;
  enhancedText?: string;
  orientation?: 'portrait' | 'landscape';
  ocrConfidence?: number;
  cropRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ===============================
// UniversalNoteService クラス
// ===============================

export class UniversalNoteService {
  private config: UniversalNoteServiceConfig;
  private cache: Map<string, UniversalNote>;
  private metrics: ServiceMetrics;
  private multiPageService: MultiPageService; // 🆕 Phase 4: MultiPageService統合

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

    // 🆕 Phase 4: MultiPageService初期化
    this.multiPageService = new MultiPageService({
      enableAutoSplit: true,
      maxCharactersPerPage: 2000,
      splitBoundary: 'paragraph',
      preserveStructure: true,
      debugMode: this.config.debugMode
    });

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
            // 🆕 Phase 4: Feature Flag対応の複数ページ保存処理
            console.log('📥📥📥 UniversalNoteService import保存開始:', {
              noteId: note.id,
              title: note.title,
              totalPages: note.pages.length,
              currentPageIndex,
              hasCanvasData: !!currentPageData?.canvasData,
              canvasDataKeys: currentPageData?.canvasData ? Object.keys(currentPageData.canvasData) : [],
              contentLength: currentPageData?.canvasData?.content?.length || 0,
              pathsCount: currentPageData?.canvasData?.drawingPaths?.length || 0,
              hasCanvasSettings: !!currentPageData?.canvasData?.canvasSettings
            });
            
            try {
              // 🆕 Phase 4: Feature Flag確認
              const isMultiPageEnabled = await checkImportSplitEnabled();
              
              if (isMultiPageEnabled && note.pages.length > 1 && options.includePages) {
                // 🆕 複数ページ保存処理（マニュアルノートと同じmultiPageData構造を使用）
                console.log('🔄 複数ページ保存モード開始:', note.pages.length, 'ページ');
                
                // 🎯 マニュアルノートと同じmultiPageData構造を構築
                // 🚨 CRITICAL: 全ページのコンテンツを結合してcontentフィールドに設定
                const allPagesContent = note.pages.map(page => page.canvasData?.content || '').join('\n\n--- ページ区切り ---\n\n');
                
                const multiPageCanvasData = {
                  type: 'canvas',
                  version: '1.0',
                  content: allPagesContent, // 🎯 全ページの結合コンテンツ
                  drawingPaths: currentPageData?.canvasData?.drawingPaths || [],
                  textElements: [],
                  canvasSettings: currentPageData?.canvasData?.canvasSettings || {
                    selectedTool: 'pen',
                    selectedPenTool: 'pen',
                    selectedColor: '#000000',
                    strokeWidth: 2,
                    textSettings: {
                      fontSize: 16,
                      textColor: '#000000',
                      selectedFont: 'standard',
                      selectedTextType: 'body',
                      isBold: false,
                      lineSpacing: 1.5,
                      letterSpacing: 0
                    }
                  },
                  // 🎯 マニュアルノートと同じmultiPageData構造
                  multiPageData: {
                    pages: note.pages.map((page, index) => ({
                      id: page.pageId,
                      title: `ページ ${page.pageNumber}`,
                      content: page.canvasData?.content || '',
                      drawingPaths: page.canvasData?.drawingPaths || [],
                      canvasData: page.canvasData || {}
                    })),
                    currentPageIndex: currentPageIndex,
                    totalPages: note.pages.length
                  }
                };
                
                console.log('🔍 multiPageData構造確認:', {
                  allPagesContentLength: allPagesContent.length,
                  pagesCount: note.pages.length,
                  firstPagePreview: note.pages[0]?.canvasData?.content?.substring(0, 100) + '...',
                  allPagesPreview: allPagesContent.substring(0, 200) + '...'
                });
                
                // Step 1: インポートノートをimportsテーブルに作成（multiPageData構造で）
                await saveImport(
                  note.id,
                  note.title,
                  '', // filePath
                  'text', // fileType
                  note.pages.reduce((total, page) => total + (page.canvasData?.content?.length || 0), 0), // 全ページの文字数合計
                  note.pages.map(page => page.canvasData?.content || '').join('\n\n'), // 全ページのコンテンツ結合
                  multiPageCanvasData // 🎯 multiPageData構造を含むcanvas_data
                );
                
                console.log('✅ 複数ページ保存完了 (multiPageData構造):', {
                  noteId: note.id,
                  totalPages: note.pages.length,
                  multiPageDataStructure: 'manual_note_compatible'
                });
              } else {
                // 🔒 従来の単一ページ保存処理（既存機能保護）
                console.log('🔒 単一ページ保存モード（既存機能保護）');
                
                // Step 1: まず、インポートノートをimportsテーブルに作成
                await saveImport(
                  note.id,
                  note.title,
                  '', // filePath
                  'text', // fileType
                  currentPageData?.canvasData?.content?.length || 0, // fileSize
                  currentPageData?.canvasData?.content || '', // content
                  currentPageData?.canvasData || {} // canvas_data
                );
                console.log('📥 Step 1: インポートノート作成完了:', note.id);
                
                // Step 2: 次に、updateCanvasDataでキャンバスデータを更新
                await updateCanvasData(note.id, currentPageData?.canvasData || {});
                console.log('📥 Step 2: キャンバスデータ更新完了:', note.id);
              }
              
              success = true;
              console.log('📥📥📥 インポートノート保存完了 (Phase 4対応)');
            } catch (importError) {
              console.error('❌ インポートノート保存エラー:', importError);
              // エラー時は従来のsaveImportのみ実行（フォールバック）
              await saveImport(
                note.id,
                note.title,
                '', // filePath
                'text', // fileType
                currentPageData?.canvasData?.content?.length || 0, // fileSize
                currentPageData?.canvasData?.content || '', // content
                currentPageData?.canvasData || {} // canvas_data
              );
              success = true;
              console.log('📥 フォールバック: saveImportのみで保存完了');
            }
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
      const note = await getNotesFromSQLite(noteId);
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

  /**
   * インポート結果からUniversalNoteを作成
   */
  async createNoteFromImport(importResult: any): Promise<UniversalNote | null> {
    try {
      this.log('createNoteFromImport開始', { 
        noteId: importResult.note_id,
        title: importResult.title,
        totalPages: importResult.total_pages 
      });

      if (!importResult.note_id || !importResult.pages) {
        throw new Error('Invalid import result: missing note_id or pages');
      }

      // 🆕 各ページのテキストをAI整形
      console.log('🔍 AI整形処理開始（インポートノート用）...');
      const pages = await Promise.all(
        importResult.pages.map(async (page: any, index: number) => {
          let enhancedText = page.text || '';
          
          // ✅ AI整形処理（createNoteFromImportでのみ実行）
          let isAIEnhanced = false;
          if (enhancedText.trim().length > 0) {
            try {
              enhancedText = await this.enhanceImportTextWithAI(enhancedText);
              isAIEnhanced = true; // 整形完了フラグ
            } catch (enhanceError) {
              enhancedText = page.text || '';
              isAIEnhanced = false;
            }
          }
          
          return {
            pageId: `${importResult.note_id}-page-${index}`,
            pageNumber: page.page_number || (index + 1),
            canvasData: {
              type: 'canvas' as const,
              version: '1.0' as const,
              content: enhancedText, // 🆕 AI整形済みテキスト
              drawingPaths: [],
              textElements: [],
              canvasSettings: {
                selectedTool: null,
                selectedPenTool: null,
                selectedColor: '#000000',
                strokeWidth: 2,
                textSettings: {
                  fontSize: 16,
                  textColor: '#000000',
                  selectedFont: 'standard',
                  selectedTextType: 'body',
                  isBold: false,
                  lineSpacing: 1.2,
                  letterSpacing: 0
                }
              },
              contentLength: enhancedText.length, // 🆕 整形後の文字数
              pathsCount: 0,
              elementsCount: 0
            },
            lastModified: new Date().toISOString(),
            pageMetadata: {
              sourcePageNumber: page.page_number,
              importedAt: importResult.created_at || new Date().toISOString(),
              originalTextLength: page.text?.length || 0, // 🆕 元の文字数
              enhancedTextLength: enhancedText.length,    // 🆕 整形後の文字数
              isAIEnhanced: isAIEnhanced,                 // 🆕 AI整形済みフラグ（確実な値を使用）
              aiEnhancedAt: isAIEnhanced ? new Date().toISOString() : undefined // 🆕 AI整形実行時刻
            }
          };
        })
      );

      const universalNote: UniversalNote = {
        id: importResult.note_id,
        type: 'import',
        title: importResult.title || 'インポートしたノート',
        pages,
        currentPageIndex: 0,
        metadata: {
          createdAt: importResult.created_at || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
          folder: undefined,
          totalPages: importResult.total_pages || pages.length,
          importMetadata: {
            sourceType: importResult.source_metadata?.content_type === 'webpage' ? 'url' : 
                       importResult.source_metadata?.content_type || 'text',
            sourceUri: importResult.source_metadata?.url || '',
            originalTitle: importResult.source_metadata?.title || '',
            importedAt: importResult.created_at || new Date().toISOString(),
            processedPages: importResult.total_pages || pages.length
          }
        },
        lastModified: new Date().toISOString(),
        lastSaved: new Date().toISOString(),
        autoSaveEnabled: true
      };

              // ノートをデータベースに保存（複数ページ対応）
        const saveResult = await this.saveUniversalNote(universalNote, { includePages: true });
      
      if (saveResult.success) {
        this.log('createNoteFromImport成功', { noteId: universalNote.id });
        return universalNote;
      } else {
        throw new Error(`Save failed: ${saveResult.error}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('createNoteFromImport失敗', { error: errorMessage });
      console.error('❌ createNoteFromImport エラー:', error);
      return null;
    }
  }

  /**
   * 写真スキャン結果から複数ページUniversalNoteを作成
   */
  async createPhotoScanNote(photoPages: PhotoPageData[]): Promise<UniversalNote | null> {
    try {
      // ノートIDを生成
      const noteId = `photo_scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.log('createPhotoScanNote開始', { 
        noteId,
        totalPhotos: photoPages.length 
      });

      if (!photoPages || photoPages.length === 0) {
        throw new Error('Invalid photo pages: no photos provided');
      }

      // 🆕 Step 1: 画像をバックエンドに保存
      console.log('🖼️ 画像保存処理開始:', photoPages.length, '枚');
      
      const imageUploadResults = [];
      for (let i = 0; i < photoPages.length; i++) {
        const photoPage = photoPages[i];
        const pageId = `${noteId}-page-${i}`;
        
        try {
          // 画像をBase64形式で取得
          let imageBase64 = '';
          if (photoPage.photoUri.startsWith('data:')) {
            // 既にBase64形式の場合
            imageBase64 = photoPage.photoUri;
          } else if (photoPage.photoUri.startsWith('file://')) {
            // ローカルファイルの場合、Base64に変換
            const response = await fetch(photoPage.photoUri);
            const blob = await response.blob();
            imageBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } else {
            console.warn('⚠️ 未対応の画像URI形式:', photoPage.photoUri);
            continue;
          }
          
          // Base64データからプレフィックスを除去
          const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
          
          console.log('📤 画像アップロード開始:', {
            noteId,
            pageId,
            imageBase64Length: imageBase64.length,
            base64DataLength: base64Data.length,
            apiUrl: `${API_BASE_URL}/api/v1/photo-scan/upload-image-base64`
          });
          
          // バックエンドAPI呼び出し（JSON Body 方式）
          const uploadResponse = await fetch(`${API_BASE_URL}/api/v1/photo-scan/upload-image-base64`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await getAuthToken()}`
            },
            body: JSON.stringify({
              note_id: noteId,
              page_id: pageId,
              image_base64: base64Data
            })
          });
          
          console.log('📤 API応答:', {
            status: uploadResponse.status,
            statusText: uploadResponse.statusText,
            ok: uploadResponse.ok
          });
          
          if (!uploadResponse.ok) {
            throw new Error(`画像アップロード失敗: ${uploadResponse.status}`);
          }
          
          const uploadResult = await uploadResponse.json();
          imageUploadResults.push({
            pageId,
            pageNumber: i + 1,
            uploadResult,
            originalPhotoUri: photoPage.photoUri
          });
          
          console.log(`✅ 画像${i + 1}/${photoPages.length}保存完了:`, pageId);
          
        } catch (uploadError) {
          console.error(`❌ 画像${i + 1}保存エラー:`, uploadError);
          // エラーが発生しても他の画像の処理は続行
          imageUploadResults.push({
            pageId,
            pageNumber: i + 1,
            uploadResult: null,
            originalPhotoUri: photoPage.photoUri,
            error: uploadError instanceof Error ? uploadError.message : 'Unknown error'
          });
        }
      }
      
      console.log('🖼️ 画像保存処理完了:', {
        totalImages: photoPages.length,
        successfulUploads: imageUploadResults.filter(r => r.uploadResult).length,
        failedUploads: imageUploadResults.filter(r => r.error).length
      });

      // 🆕 Step 2: 各写真をページに変換（画像保存結果を含む）
      const pages = photoPages.map((photoPage, index) => {
        const pageId = `${noteId}-page-${index}`;
        const uploadResult = imageUploadResults[index];
        
        return {
          pageId,
          pageNumber: index + 1,
          canvasData: {
            type: 'canvas' as const,
            version: '1.0' as const,
            content: photoPage.enhancedText || photoPage.ocrText || '',
            drawingPaths: [],
            textElements: [],
            canvasSettings: {
              selectedTool: null,
              selectedPenTool: null,
              selectedColor: '#000000',
              strokeWidth: 2,
              textSettings: {
                fontSize: 16,
                textColor: '#000000',
                selectedFont: 'standard',
                selectedTextType: 'body',
                isBold: false,
                lineSpacing: 1.2,
                letterSpacing: 0
              }
            },
            contentLength: (photoPage.enhancedText || photoPage.ocrText || '').length,
            pathsCount: 0,
            elementsCount: 0
          },
          lastModified: new Date().toISOString(),
          pageMetadata: {
            photoUri: photoPage.photoUri,
            enhancedText: photoPage.enhancedText,
            originalOcrText: photoPage.ocrText,
            orientation: photoPage.orientation || 'portrait',
            ocrConfidence: photoPage.ocrConfidence,
            aiProcessed: !!photoPage.enhancedText,
            aiProcessedAt: photoPage.enhancedText ? new Date().toISOString() : undefined,
            // 🆕 画像保存結果を追加
            imageStorage: uploadResult?.uploadResult ? {
              backendStored: true,
              filePath: uploadResult.uploadResult.file_path,
              localUrl: uploadResult.uploadResult.local_url,
              gcsUrl: uploadResult.uploadResult.gcs_url,
              storedAt: new Date().toISOString()
            } : {
              backendStored: false,
              error: uploadResult?.error || 'Upload failed',
              originalUri: photoPage.photoUri
            }
          }
        };
      });

      // AIでタイトル生成（最初のページのテキストから）
      let title = 'スキャンしたノート';
      try {
        const firstPageText = pages[0]?.canvasData?.content || '';
        if (firstPageText.trim().length > 0) {
          const titleResponse = await aiApi.generateTitle(firstPageText);
          if (titleResponse.title) {
            title = titleResponse.title;
          }
        }
      } catch (titleError) {
        console.warn('⚠️ AI タイトル生成失敗 - デフォルトタイトルを使用:', titleError);
      }

      const universalNote: UniversalNote = {
        id: noteId,
        type: 'photo_scan',
        title,
        pages,
        currentPageIndex: 0,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
          folder: undefined,
          totalPages: pages.length,
          photoScanMetadata: {
            originalPhotoUris: photoPages.map(p => p.photoUri),
            ocrProvider: 'google_vision',
            ocrConfidence: photoPages.reduce((sum, p) => sum + (p.ocrConfidence || 0), 0) / photoPages.length,
            language: 'ja',
            croppedRegions: photoPages.map(p => p.cropRegion).filter((region): region is CropRegion => region !== undefined),
            // 🆕 画像保存統計を追加
            imageStorageStats: {
              totalImages: photoPages.length,
              successfullyStored: imageUploadResults.filter(r => r.uploadResult).length,
              failedUploads: imageUploadResults.filter(r => r.error).length,
              storageProvider: 'backend_api'
            }
          }
        },
        lastModified: new Date().toISOString(),
        lastSaved: new Date().toISOString(),
        autoSaveEnabled: true
      };

      console.log('📝 UniversalNote作成完了:', {
        noteId,
        totalPages: pages.length,
        firstPageContent: pages[0]?.canvasData.content.substring(0, 100)
      });

      // ---------------------------------------------
      // 📸 重要: photo_scansテーブルに初期行を作成
      // saveUniversalNote()のupdateCanvasData()が成功するため
      // ---------------------------------------------
      try {
        const photoScanPhotos = pages.map((page, index) => ({
          uri: `temp_${page.pageId}.jpg`, // 一時的なURI
          canvasData: page.canvasData,
          ocrResult: page.pageMetadata?.originalOcrText ? {
            text: page.pageMetadata.originalOcrText,
            confidence: page.pageMetadata.ocrConfidence || 0,
            enhancedText: page.canvasData.content
          } : undefined
        }));

        console.log('📸 photo_scansテーブルに初期行を作成中...');
        await savePhotoScan(noteId, universalNote.title, photoScanPhotos);
        console.log('✅ photo_scansテーブル初期行作成完了');
      } catch (error) {
        console.error('❌ photo_scansテーブル初期行作成失敗:', error);
        throw new Error(`PhotoScan初期行作成に失敗しました: ${error}`);
      }

      // ---------------------------------------------
      // 📄 UniversalNoteをデータベースに保存
      // 既にphoto_scans行が存在するため、updateCanvasData()が成功する
      // ---------------------------------------------
      const saveResult = await this.saveUniversalNote(universalNote, { includePages: true });
      
      if (saveResult.success) {
        this.log('createPhotoScanNote成功', { 
          noteId: universalNote.id,
          totalPages: pages.length,
          title,
          imageStorageStats: universalNote.metadata.photoScanMetadata?.imageStorageStats
        });
        return universalNote;
      } else {
        throw new Error(`Save failed: ${saveResult.error}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('createPhotoScanNote失敗', { error: errorMessage });
      console.error('❌ createPhotoScanNote エラー:', error);
      return null;
    }
  }

  // ===============================
  // AI整形メソッド
  // ===============================

  // 🆕 インポートテキスト専用AI整形機能
  private async enhanceImportTextWithAI(rawText: string): Promise<string> {
    try {
      // 🚨 重複整形防止チェック
      if (this.isAlreadyAIEnhanced(rawText)) {
        console.log('⚠️ 既にAI整形済みのテキストを検出 - スキップ:', {
          textLength: rawText.length,
          preview: rawText.substring(0, 100) + '...'
        });
        return rawText; // 既に整形済みの場合はそのまま返す
      }
      
      console.log('🔍 AI整形処理開始（インポートテキスト専用）:', { textLength: rawText.length });
      
      // 🔧 修正: インポートテキスト専用のAI整形設定（タイムアウト延長）
      const response = await aiApi.enhanceScannedText(rawText, {
        analyze_structure: true,          // 文章構造解析
        correct_grammar: true,            // 文法修正
        improve_readability: true,        // 読みやすさ向上
        format_style: 'structured',       // 構造化スタイル（写真スキャンと同じ）
        language: 'ja',
        timeout: 120000                   // 🚨 CRITICAL: 2分タイムアウト（長文対応）
      });
      
      if (response.enhanced_text) {
        console.log('✅ AI整形完了（インポートテキスト）:', {
          originalLength: rawText.length,
          enhancedLength: response.enhanced_text.length,
          improvement: `${((response.enhanced_text.length / rawText.length - 1) * 100).toFixed(1)}%`
        });
        return response.enhanced_text;
      } else {
        console.warn('⚠️ AI整形APIレスポンスが空です - 元テキスト返却');
        return rawText; // フォールバック
      }
    } catch (error) {
      console.error('❌ AI整形エラー（インポートテキスト）:', error);
      return rawText; // エラー時は元のテキストを返す
    }
  }

  // 🆕 AI整形済みテキストかどうかを判定する関数
  private isAlreadyAIEnhanced(text: string): boolean {
    // 🔧 修正: より厳格な判定条件に変更（インポートテキストは基本的に整形する）
    const enhancedIndicators = [
      // 明らかにAI整形済みの特徴のみチェック
      /^### .+\n\n/m,                    // AI整形特有の見出し形式
      /^#### .+\n\n/m,                   // AI整形特有の見出し形式
      /\n\n\*\*要約\*\*\n/m,           // AI整形特有の要約セクション
      /\n\n\*\*概要\*\*\n/m,           // AI整形特有の概要セクション
      /\n\n\*\*ポイント\*\*\n/m,       // AI整形特有のポイントセクション
      /\n\n\*\*主な内容\*\*\n/m,       // AI整形特有の主な内容セクション
    ];
    
    let indicatorCount = 0;
    for (const indicator of enhancedIndicators) {
      if (indicator.test(text)) {
        indicatorCount++;
      }
    }
    
    // 🚨 CRITICAL: 3つ以上の明確なAI整形特徴があり、かつ短時間で重複処理を防ぐ場合のみスキップ
    const isEnhanced = indicatorCount >= 3;
    
    if (isEnhanced) {
      console.log('🔍 AI整形済み判定結果（厳格判定）:', {
        textLength: text.length,
        indicatorCount,
        hasAIHeadings: /^### .+\n\n/m.test(text) || /^#### .+\n\n/m.test(text),
        hasSummarySection: /\n\n\*\*要約\*\*\n/m.test(text),
        hasOverviewSection: /\n\n\*\*概要\*\*\n/m.test(text),
        hasPointsSection: /\n\n\*\*ポイント\*\*\n/m.test(text),
        hasMainContentSection: /\n\n\*\*主な内容\*\*\n/m.test(text)
      });
    } else {
      console.log('✅ AI整形実行対象:', {
        textLength: text.length,
        indicatorCount,
        reason: 'AI整形特有の特徴が不十分のため整形を実行'
      });
    }
    
    return isEnhanced;
  }

  // ===============================
  // ユーティリティメソッド
  // ===============================

  private async convertToUniversalNote(dbNote: any): Promise<UniversalNote> {
    // データベースオブジェクトをUniversalNote形式に変換
    const noteType = this.detectNoteType(dbNote);
    let content = '';
    let canvasData = {};
    let pages: any[] = [];
    
    // 🆕 photo_scan用の複数ページ処理
    if (noteType === 'photo_scan') {
      try {
        const photos = dbNote.photos ? JSON.parse(dbNote.photos) : [];
        console.log('📸 PhotoScan複数ページ変換開始:', {
          noteId: dbNote.id,
          totalPhotos: photos.length
        });
        
        pages = photos.map((photo: any, index: number) => ({
          pageId: `${dbNote.id}-page-${index}`,
          pageNumber: index,
          canvasData: {
            type: 'canvas',
            version: '1.0',
            content: photo.enhancedText || photo.ocrResult?.text || '',
            drawingPaths: [],
            textElements: [],
            canvasSettings: {
              selectedTool: null,
              selectedPenTool: null,
              selectedColor: '#000000',
              strokeWidth: 2,
              textSettings: {
                fontSize: 16,
                textColor: '#000000',
                selectedFont: 'standard',
                selectedTextType: 'body',
                isBold: false,
                lineSpacing: 1.2,
                letterSpacing: 0
              }
            },
            contentLength: (photo.enhancedText || photo.ocrResult?.text || '').length,
            pathsCount: 0,
            elementsCount: 0
          },
          lastModified: dbNote.updated_at || new Date().toISOString(),
          pageMetadata: {
            photoUri: photo.uri,
            originalOcrText: photo.ocrResult?.text || '',
            enhancedText: photo.enhancedText || '',
            orientation: photo.orientation || 'portrait',
            ocrConfidence: photo.ocrResult?.confidence || 0,
            aiProcessed: photo.aiProcessed || false,
            aiProcessedAt: photo.aiProcessedAt || undefined
          }
        }));
        
        console.log('✅ PhotoScan複数ページ変換完了:', {
          noteId: dbNote.id,
          totalPages: pages.length
        });
      } catch (error) {
        console.error('❌ PhotoScan複数ページ変換エラー:', error);
        // フォールバック: 単一ページとして処理
        pages = [{
          pageId: `${dbNote.id}-page-0`,
          pageNumber: 0,
          canvasData: {
            type: 'canvas',
            version: '1.0',
            content: '',
            drawingPaths: [],
            textElements: [],
            canvasSettings: {
              selectedTool: null,
              selectedPenTool: null,
              selectedColor: '#000000',
              strokeWidth: 2,
              textSettings: {
                fontSize: 16,
                textColor: '#000000',
                selectedFont: 'standard',
                selectedTextType: 'body',
                isBold: false,
                lineSpacing: 1.2,
                letterSpacing: 0
              }
            },
            contentLength: 0,
            pathsCount: 0,
            elementsCount: 0
          },
          lastModified: dbNote.updated_at || new Date().toISOString(),
          pageMetadata: {}
        }];
      }
    }
    // インポートノートの場合は、canvas_data フィールドから完全なテキストを取得
    else if (noteType === 'import') {
      // 🚨 CRITICAL: canvas_dataフィールドから完全なテキストを優先取得
      let contentFromCanvasData = '';
      if (dbNote.canvas_data) {
        try {
          const parsedCanvasData = JSON.parse(dbNote.canvas_data);
          if (parsedCanvasData && parsedCanvasData.content) {
            contentFromCanvasData = parsedCanvasData.content;
            console.log('✅ canvas_dataから完全テキスト取得:', {
              textLength: contentFromCanvasData.length,
              preview: contentFromCanvasData.substring(0, 100) + '...'
            });
          }
          canvasData = parsedCanvasData;
        } catch (error) {
          console.warn('⚠️ キャンバスデータの解析に失敗:', error);
        }
      }
      
      // フォールバック: canvas_dataがない場合はcontentフィールドを使用
      if (contentFromCanvasData) {
        content = contentFromCanvasData; // 🚨 完全なテキストを使用
      } else if (dbNote.content) {
        try {
          const parsedContent = JSON.parse(dbNote.content);
          if (parsedContent && typeof parsedContent === 'object' && parsedContent.content) {
            content = parsedContent.content;
          } else {
            content = dbNote.content;
          }
        } catch (parseError) {
          content = dbNote.content;
        }
      } else {
        content = '';
      }
      
      console.log('📊 インポートノート読み込み結果:', {
        noteId: dbNote.id,
        hasCanvasData: !!dbNote.canvas_data,
        hasContent: !!dbNote.content,
        finalContentLength: content.length,
        source: contentFromCanvasData ? 'canvas_data' : 'content'
      });
      
      // 単一ページとして処理
      pages = [{
        pageId: `${dbNote.id}-page-0`,
        pageNumber: 0,
        canvasData: {
          type: 'canvas',
          version: '1.0',
          content: content,
          drawingPaths: [],
          textElements: [],
          canvasSettings: {
            selectedTool: null,
            selectedPenTool: null,
            selectedColor: '#000000',
            strokeWidth: 2,
            textSettings: {
              fontSize: 16,
              textColor: '#000000',
              selectedFont: 'standard',
              selectedTextType: 'body',
              isBold: false,
              lineSpacing: 1.2,
              letterSpacing: 0
            }
          },
          contentLength: content.length,
          pathsCount: 0,
          elementsCount: 0
        },
        lastModified: dbNote.updated_at || new Date().toISOString(),
        pageMetadata: {
          audioUri: dbNote.file_path,
          transcriptText: dbNote.transcription,
          enhancedText: ''
        }
      }];
    } else {
      // 他のノートタイプ（recording, manual）
      content = dbNote.content || '';
      pages = [{
        pageId: `${dbNote.id}-page-0`,
        pageNumber: 0,
        canvasData: {
          type: 'canvas',
          version: '1.0',
          content: content,
          drawingPaths: [],
          textElements: [],
          canvasSettings: {
            selectedTool: null,
            selectedPenTool: null,
            selectedColor: '#000000',
            strokeWidth: 2,
            textSettings: {
              fontSize: 16,
              textColor: '#000000',
              selectedFont: 'standard',
              selectedTextType: 'body',
              isBold: false,
              lineSpacing: 1.2,
              letterSpacing: 0
            }
          },
          contentLength: content.length,
          pathsCount: 0,
          elementsCount: 0
        },
        lastModified: dbNote.updated_at || new Date().toISOString(),
        pageMetadata: {
          audioUri: dbNote.file_path,
          transcriptText: dbNote.transcription,
          enhancedText: ''
        }
      }];
    }
    
    const universalNote: UniversalNote = {
      id: dbNote.id,
      type: noteType,
      title: dbNote.title,
      pages,
      currentPageIndex: 0,
      metadata: {
        createdAt: new Date(dbNote.created_at || Date.now()).toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        folder: undefined,
        totalPages: pages.length
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