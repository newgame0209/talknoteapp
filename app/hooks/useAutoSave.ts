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
  | 'undo_redo' | 'canvas_draw' | 'manual_save' | 'voice_record';

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
  
  // デバッグログ
  const log = useCallback((message: string, data?: any) => {
    if (debugMode) {
      console.log(`🎯 useAutoSave: ${message}`, data || '');
    }
  }, [debugMode]);

  /**
   * 🏷️ 変更マーク関数
   * 任意のツールバー機能実行時に呼び出し
   */
  const markChanged = useCallback((toolbarFunction: ToolbarFunction, data?: any) => {
    log('変更フラグ設定', { toolbarFunction, data });
    setHasUnsavedChanges(true);
    
    // 即座保存（100ms後）
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      log('即座保存実行', { toolbarFunction });
      performSave();
    }, 100);
  }, []);

  /**
   * 💾 統一保存実行関数
   */
  const performSave = useCallback(async (): Promise<boolean> => {
    if (isSaving) {
      log('保存スキップ: 保存処理中');
      return false;
    }
    
    if (!hasUnsavedChanges) {
      log('保存スキップ: 未変更');
      return true;
    }

    try {
      setIsSaving(true);
      log('統一自動保存開始', { noteId, noteType });
      
      // 現在のキャンバスデータを取得
      const canvasData = getCurrentCanvasData();
      const title = getTitle();
      
      log('保存データ構築', { 
        contentLength: canvasData.content?.length || 0,
        pathsCount: canvasData.drawingPaths?.length || 0,
        title 
      });

             // UniversalNote形式でデータ構築
       const universalNote: UniversalNote = {
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

      // 🎯 UniversalNoteService経由で保存
      try {
        log('🚀🚀🚀 UniversalNoteService保存開始');
        const universalNoteService = new UniversalNoteService({
          debugMode: debugMode,
          enableValidation: true,
          enableRetry: true
        });

        log('🚀🚀🚀 saveUniversalNote実行直前', { 
          canvasSettings: canvasData.canvasSettings,
          fontSize: canvasData.canvasSettings?.textSettings?.fontSize,
          isBold: canvasData.canvasSettings?.textSettings?.isBold
        });

        const saveResult = await universalNoteService.saveUniversalNote(universalNote);
        
        log('🚀🚀🚀 saveUniversalNote実行完了', { saveResult });
        
        if (saveResult.success) {
          setHasUnsavedChanges(false);
          setLastSaved(new Date());
          log('✅✅✅ 統一自動保存完了', { 
            noteType,
            pathsCount: canvasData.drawingPaths?.length || 0,
            contentLength: canvasData.content?.length || 0,
            saveTime: saveResult.metrics?.saveTime
          });
          return true;
        } else {
          throw new Error(saveResult.error || 'UniversalNoteService保存失敗');
        }
      } catch (universalError) {
        log('UniversalNoteService保存失敗、フォールバック実行', universalError);
        
        // フォールバック: 従来の保存方法
        await updateCanvasData(noteId, canvasData);
        setHasUnsavedChanges(false);
        setLastSaved(new Date());
        log('フォールバック保存完了');
        return true;
      }
      
    } catch (error) {
      log('統一自動保存エラー', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [noteId, noteType, getCurrentCanvasData, getTitle, hasUnsavedChanges, isSaving, debugMode]);

  /**
   * ⏰ 定期自動保存タイマー（5秒間隔）
   */
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }
    
    log('自動保存タイマー開始: 5秒間隔');
    autoSaveTimerRef.current = setInterval(() => {
      log('定期自動保存実行');
      performSave();
    }, 5000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        log('自動保存タイマー停止');
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [performSave]);

  return {
    markChanged,
    performSave,
    hasUnsavedChanges,
    isSaving,
    lastSaved
  };
}; 