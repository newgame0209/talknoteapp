import { useState, useEffect, useRef, useCallback } from 'react';
import { CanvasData, UniversalNote, NoteType } from '../types/UniversalNote';
import { UniversalNoteService } from '../services/UniversalNoteService';
import { updateCanvasData } from '../services/database';

// ツールバー機能の型定義
export type ToolbarFunction = 
  // ペンツール (7項目)
  | 'pen_drawing' | 'eraser_tool' | 'marker_tool' | 'media_upload'
  | 'ruler_tool' | 'reading_ruler' | 'pen_settings' | 'ruler'
  // キーボードツール (7項目)
  | 'text_input' | 'heading_change' | 'font_change' | 'font_size_change' | 'font_size'
  | 'bold_toggle' | 'line_spacing' | 'letter_spacing' | 'spacing_adjust'
  // その他ツール (4項目)
  | 'search_function' | 'voice_operations' | 'bookmark' | 'settings'
  | 'title_edit' | 'bookmark_add' | 'template_select' | 'background_change' | 'text_color'
  // AIチャット機能 (7項目)
  | 'ai_summarize' | 'ai_convert' | 'ai_dictionary' | 'ai_proofread'
  | 'ai_furigana' | 'ai_research' | 'ai_chat'
  // 共通機能
  | 'undo_redo' | 'canvas_draw' | 'manual_save' | 'voice_record'
  // ズーム機能
  | 'zoom';

export interface UseAutoSaveProps {
  noteId: string;
  noteType: NoteType;
  getCurrentCanvasData: () => CanvasData;
  getTitle: () => string;
  debugMode?: boolean;
}

export interface UseAutoSaveReturn {
  markChanged: (toolbarFunction: ToolbarFunction, data?: any) => void;
  performSave: () => Promise<boolean>;
  flushSave: () => Promise<void>;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
}

/**
 * 🎯 統一自動保存 Hook
 * 全ツールバー機能とキャンバス変更を統一的に自動保存
 */
export const useAutoSave = ({
  noteId,
  noteType,
  getCurrentCanvasData,
  getTitle,
  debugMode = false
}: UseAutoSaveProps): UseAutoSaveReturn => {
  // 状態管理
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // タイマー管理
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 🔄 isSaving 中に "もう一度保存して" という要求が来たかを保持
  const pendingSaveRef = useRef(false);
  
  // 🔧 markChanged関数（デバウンス150msに短縮）
  const markChanged = useCallback((toolbarFunction: ToolbarFunction, data?: any) => {
    console.log('🏷️ markChanged: 変更フラグ設定');
    setHasUnsavedChanges(true);
    
    // 既存のタイマーをクリア
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // 🔧 デバウンス時間を150msに短縮（連続操作をまとめつつ応答性向上）
    saveTimeoutRef.current = setTimeout(() => {
      console.log('⚡ デバウンス完了: 150ms後に保存実行');
      performSave();
    }, 150); // 300ms → 150ms に短縮
  }, []);

  /**
   * 🚀 統一自動保存実行
   */
  const performSave = useCallback(async (): Promise<boolean> => {
    if (isSaving) {
      // "保存が終わったらもう一度実行して" と印を付ける
      pendingSaveRef.current = true;
      console.log('保存中 → pendingSave フラグをセット');
      return false;
    }
    
    if (!hasUnsavedChanges) {
      console.log('保存スキップ: 未変更');
      return true;
    }

    try {
      setIsSaving(true);
      console.log('統一自動保存開始', { noteId, noteType });
      
      // 現在のキャンバスデータを取得
      const canvasData = getCurrentCanvasData();
      const title = getTitle();
      
      console.log('保存データ構築', { 
        contentLength: canvasData.content?.length || 0,
        pathsCount: canvasData.drawingPaths?.length || 0,
        title 
      });

             // UniversalNote形式でデータ構築
       let universalNote: UniversalNote;
       
       // 🆕 複数ページデータがある場合は複数ページとして保存
       if (canvasData.multiPageData && canvasData.multiPageData.pages && canvasData.multiPageData.pages.length > 0) {
         console.log('複数ページデータ保存', { 
           pagesCount: canvasData.multiPageData.pages.length,
           currentPageIndex: canvasData.multiPageData.currentPageIndex,
           totalPages: canvasData.multiPageData.totalPages
         });
         
         // 複数ページデータを使用してUniversalNoteを構築
         const multiPageData = canvasData.multiPageData;
         universalNote = {
           id: noteId,
           type: noteType,
           title: title,
           pages: multiPageData.pages.map((page, index) => ({
             pageId: page.id || `${noteId}_page_${index + 1}`,
             pageNumber: index + 1,
             canvasData: page.canvasData || {
               type: 'canvas',
               version: '1.0',
               content: page.content || '',
               drawingPaths: page.drawingPaths || [],
               textElements: [],
               canvasSettings: canvasData.canvasSettings || {}
             },
             lastModified: new Date().toISOString(),
             pageMetadata: {} // 必要に応じて拡張
           })),
           currentPageIndex: multiPageData.currentPageIndex || 0,
           metadata: {
             createdAt: new Date().toISOString(),
             updatedAt: new Date().toISOString(),
             tags: [],
             totalPages: multiPageData.totalPages || multiPageData.pages.length
           },
           lastModified: new Date().toISOString(),
           lastSaved: new Date().toISOString(),
           autoSaveEnabled: true
         };
       } else {
         // 単一ページデータの場合は従来通り
         universalNote = {
           id: noteId,
           type: noteType,
           title: title,
           pages: [{
             pageId: `${noteId}_page_1`,
             pageNumber: 1,
             canvasData: canvasData,
             lastModified: new Date().toISOString(),
             pageMetadata: {} // 必要に応じて拡張
           }],
           currentPageIndex: 0,
           metadata: {
             createdAt: new Date().toISOString(),
             updatedAt: new Date().toISOString(),
             tags: []
           },
           lastModified: new Date().toISOString(),
           lastSaved: new Date().toISOString(),
           autoSaveEnabled: true
         };
       }

      // 🔧 直接updateCanvasDataで保存（multiPageData対応）
      try {
        console.log('🚀 直接updateCanvasData保存開始', {
          hasMultiPageData: !!canvasData.multiPageData,
          multiPageDataPagesCount: canvasData.multiPageData?.pages?.length || 0
        });

        // multiPageDataを含む完全なcanvasDataを保存
        await updateCanvasData(noteId, canvasData);
        
        setHasUnsavedChanges(false);
        setLastSaved(new Date());
        console.log('✅ 直接保存完了（multiPageData含む）', { 
          noteType,
          pathsCount: canvasData.drawingPaths?.length || 0,
          contentLength: canvasData.content?.length || 0,
          multiPageDataSaved: !!canvasData.multiPageData
        });
        return true;
        
      } catch (directSaveError) {
        console.log('直接保存失敗、UniversalNoteService試行', directSaveError);
        
        // フォールバック: UniversalNoteService
        try {
          const universalNoteService = new UniversalNoteService({
            debugMode: debugMode,
            enableValidation: true,
            enableRetry: true
          });

          const saveResult = await universalNoteService.saveUniversalNote(universalNote);
          
          if (saveResult.success) {
            setHasUnsavedChanges(false);
            setLastSaved(new Date());
            console.log('✅ UniversalNoteService保存完了');
            return true;
          } else {
            throw new Error(saveResult.error || 'UniversalNoteService保存失敗');
          }
        } catch (universalError) {
          console.log('全ての保存方法が失敗', universalError);
          return false;
        }
      }
      
    } catch (error) {
      console.log('統一自動保存エラー', error);
      return false;
    } finally {
      setIsSaving(false);
      // 🆕 pendingSave が立っていればもう一度保存
      if (pendingSaveRef.current) {
        console.log('pendingSave を処理 – 直ちに再保存');
        pendingSaveRef.current = false;
        // 再帰的だが isSaving=false なので即実行される
        setTimeout(() => performSave(), 50);
      }
    }
  }, [noteId, noteType, getCurrentCanvasData, getTitle, hasUnsavedChanges, isSaving, debugMode]);

  // 🆕 確実な保存実行関数（React state反映待ち）
  const flushSave = useCallback(async (): Promise<void> => {
    console.log('🚀 flushSave: 確実な保存を実行開始');
    
    // React stateの反映を待つ（50ms）
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 保存中でも強制的に保存実行
    if (isSaving) {
      console.log('⏳ flushSave: 保存中のため100ms待機後に再実行');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 最新状態で確実に保存
    await performSave();
    console.log('✅ flushSave: 確実な保存完了');
  }, [performSave, isSaving]);

  /**
   * ⏰ 定期自動保存タイマー（5秒間隔）
   */
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }
    
    console.log('自動保存タイマー開始: 5秒間隔');
    autoSaveTimerRef.current = setInterval(() => {
      if (hasUnsavedChanges) {
        console.log('定期自動保存実行');
        performSave();
      }
    }, 5000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        console.log('自動保存タイマー停止');
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [performSave]);

  return {
    markChanged,
    performSave,
    flushSave,
    hasUnsavedChanges,
    isSaving,
    lastSaved
  };
}; 