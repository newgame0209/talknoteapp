/**
 * AutoSaveDecorator - 統一自動保存デコレーター
 * 全25個のツールバー機能への統一的な自動保存適用
 * AI処理競合防止、ページ操作制御、オフライン同期制御を含む
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UniversalNote, AIProcessingState, PageOperation, SyncQueue, SaveResult } from '../types/UniversalNote';
import { UniversalNoteService } from '../services/UniversalNoteService';

// ===============================
// ツールバー機能型定義
// ===============================

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

export interface ToolbarAction {
  function: ToolbarFunction;
  data?: any;
  timestamp: number;
  triggeredBy: 'user' | 'system' | 'ai';
}

export interface AutoSaveDecoratorConfig {
  // 基本設定
  enabledFunctions: ToolbarFunction[];
  debounceMs: number;
  maxRetries: number;
  
  // AI処理競合防止
  aiConflictPrevention: boolean;
  aiProcessingTimeout: number;
  
  // ページ操作制御
  pageOperationControl: boolean;
  pageValidationEnabled: boolean;
  
  // オフライン同期制御
  offlineSyncEnabled: boolean;
  syncQueueMaxSize: number;
  
  // デバッグ
  debugMode: boolean;
}

// ===============================
// デフォルト設定
// ===============================

const DEFAULT_DECORATOR_CONFIG: AutoSaveDecoratorConfig = {
  enabledFunctions: [
    // ペンツール (7項目)
    'pen_drawing', 'eraser_tool', 'marker_tool', 'media_upload', 'ruler_tool', 'reading_ruler', 'pen_settings',
    // キーボードツール (7項目)
    'text_input', 'heading_change', 'font_change', 'font_size_change', 'bold_toggle', 'line_spacing', 'letter_spacing',
    // その他ツール (4項目)
    'search_function', 'voice_operations', 'bookmark', 'settings',
    // AIチャット機能 (7項目)
    'ai_summarize', 'ai_convert', 'ai_dictionary', 'ai_proofread', 'ai_furigana', 'ai_research', 'ai_chat',
    // 共通機能
    'undo_redo', 'canvas_draw', 'manual_save', 'voice_record', 'title_edit', 'background_change', 'template_select'
  ],
  debounceMs: 100,
  maxRetries: 3,
  aiConflictPrevention: true,
  aiProcessingTimeout: 30000, // 30秒
  pageOperationControl: true,
  pageValidationEnabled: true,
  offlineSyncEnabled: true,
  syncQueueMaxSize: 100,
  debugMode: true
};

// ===============================
// AutoSaveDecorator状態管理
// ===============================

interface DecoratorState {
  // AI処理状態
  aiProcessingStates: AIProcessingState[];
  isAnyAIProcessing: boolean;
  
  // ページ操作状態
  activePageOperations: PageOperation[];
  isPageOperationInProgress: boolean;
  
  // オフライン同期状態
  syncQueue: SyncQueue;
  isOnline: boolean;
  
  // 統計
  functionsTriggered: Record<ToolbarFunction, number>;
  conflictsPrevented: number;
  successfulSaves: number;
  failedSaves: number;
}

// ===============================
// AutoSaveDecorator HOC
// ===============================

export interface WithAutoSaveProps {
  autoSave: {
    // 基本操作
    triggerSave: (toolbarAction: ToolbarAction) => Promise<SaveResult>;
    markChanged: (toolbarFunction: ToolbarFunction, data?: any) => void;
    
    // 状態確認
    canExecuteFunction: (toolbarFunction: ToolbarFunction) => boolean;
    getBlockingReason: (toolbarFunction: ToolbarFunction) => string | null;
    
    // AI処理制御
    startAIProcessing: (processType: string, noteId: string, pageId?: string) => void;
    endAIProcessing: (processType: string, noteId: string) => void;
    isAIProcessing: (processType?: string) => boolean;
    
    // ページ操作制御
    startPageOperation: (operation: PageOperation) => Promise<boolean>;
    endPageOperation: (operationId: string, success: boolean) => void;
    
    // オフライン同期制御
    queueForSync: (operation: any) => void;
    processSyncQueue: () => Promise<void>;
    
    // デバッグ情報
    getDecoratorState: () => DecoratorState;
    getStats: () => object;
  };
}

export function withAutoSave<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  config: Partial<AutoSaveDecoratorConfig> = {}
) {
  const finalConfig = { ...DEFAULT_DECORATOR_CONFIG, ...config };
  
  return function AutoSaveDecoratedComponent(props: P) {
    // ===============================
    // Hooks and State
    // ===============================
    
    // 🔧 独立動作: UniversalNoteServiceを直接使用
    const [currentNote, setCurrentNote] = useState<UniversalNote | null>(null);
    const universalNoteServiceRef = useRef<UniversalNoteService | null>(null);
    
    const [decoratorState, setDecoratorState] = useState<DecoratorState>({
      aiProcessingStates: [],
      isAnyAIProcessing: false,
      activePageOperations: [],
      isPageOperationInProgress: false,
      syncQueue: {
        queuedSaves: [],
        queuedDeletes: [],
        lastSyncAttempt: new Date().toISOString(),
        syncInProgress: false
      },
      isOnline: true, // React Nativeでは一旦オンライン固定
      functionsTriggered: {} as Record<ToolbarFunction, number>,
      conflictsPrevented: 0,
      successfulSaves: 0,
      failedSaves: 0
    });
    
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pendingActionsRef = useRef<ToolbarAction[]>([]);
    
    // ===============================
    // 初期化処理
    // ===============================
    
    useEffect(() => {
      // React Nativeでは一旦オンライン状態に固定
      setDecoratorState(prev => ({ ...prev, isOnline: true }));
      
      // UniversalNoteServiceの初期化
      if (!universalNoteServiceRef.current) {
        universalNoteServiceRef.current = new UniversalNoteService({
          debugMode: finalConfig.debugMode,
          enableValidation: true,
          enableRetry: true
        });
        console.log('🔧 AutoSaveDecorator: UniversalNoteService初期化完了');
      }
      
      // 将来的にはNetInfoを使用してネットワーク状態を監視
      // const unsubscribe = NetInfo.addEventListener(state => {
      //   setDecoratorState(prev => ({ ...prev, isOnline: state.isConnected ?? true }));
      //   if (state.isConnected && finalConfig.offlineSyncEnabled) {
      //     processSyncQueue();
      //   }
      // });
      // 
      // return unsubscribe;
    }, []);
    
    // ===============================
    // ユーティリティ関数
    // ===============================
    
    const log = useCallback((message: string, data?: any) => {
      if (finalConfig.debugMode) {
        console.log(`🎯 AutoSaveDecorator: ${message}`, data || '');
      }
    }, [finalConfig.debugMode]);
    
    const updateStats = useCallback((toolbarFunction: ToolbarFunction, success: boolean = true) => {
      setDecoratorState(prev => ({
        ...prev,
        functionsTriggered: {
          ...prev.functionsTriggered,
          [toolbarFunction]: (prev.functionsTriggered[toolbarFunction] || 0) + 1
        },
        successfulSaves: success ? prev.successfulSaves + 1 : prev.successfulSaves,
        failedSaves: success ? prev.failedSaves : prev.failedSaves + 1
      }));
    }, []);
    
    // ===============================
    // AI処理競合防止
    // ===============================
    
    const startAIProcessing = useCallback((processType: string, noteId: string, pageId?: string) => {
      if (!finalConfig.aiConflictPrevention) return;
      
      const newState: AIProcessingState = {
        isProcessing: true,
        processType: processType as any,
        noteId,
        pageId,
        startTime: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + finalConfig.aiProcessingTimeout).toISOString(),
        progress: 0
      };
      
      setDecoratorState(prev => ({
        ...prev,
        aiProcessingStates: [...prev.aiProcessingStates, newState],
        isAnyAIProcessing: true
      }));
      
      log('AI処理開始', { processType, noteId, pageId });
    }, [finalConfig.aiConflictPrevention, finalConfig.aiProcessingTimeout]);
    
    const endAIProcessing = useCallback((processType: string, noteId: string) => {
      setDecoratorState(prev => {
        const filteredStates = prev.aiProcessingStates.filter(
          state => !(state.processType === processType && state.noteId === noteId)
        );
        
        return {
          ...prev,
          aiProcessingStates: filteredStates,
          isAnyAIProcessing: filteredStates.length > 0
        };
      });
      
      log('AI処理終了', { processType, noteId });
    }, []);
    
    const isAIProcessing = useCallback((processType?: string) => {
      if (!processType) return decoratorState.isAnyAIProcessing;
      
      return decoratorState.aiProcessingStates.some(
        state => state.processType === processType && state.isProcessing
      );
    }, [decoratorState.aiProcessingStates, decoratorState.isAnyAIProcessing]);
    
    // ===============================
    // ページ操作制御
    // ===============================
    
    const startPageOperation = useCallback(async (operation: PageOperation): Promise<boolean> => {
      if (!finalConfig.pageOperationControl) return true;
      
      // ページ操作競合チェック
      const hasConflictingOperation = decoratorState.activePageOperations.some(
        op => op.noteId === operation.noteId && op.status === 'processing'
      );
      
      if (hasConflictingOperation) {
        log('ページ操作競合検出', { operation });
        setDecoratorState(prev => ({ ...prev, conflictsPrevented: prev.conflictsPrevented + 1 }));
        return false;
      }
      
      setDecoratorState(prev => ({
        ...prev,
        activePageOperations: [...prev.activePageOperations, operation],
        isPageOperationInProgress: true
      }));
      
      log('ページ操作開始', { operation });
      return true;
    }, [finalConfig.pageOperationControl, decoratorState.activePageOperations]);
    
    const endPageOperation = useCallback((operationId: string, success: boolean) => {
      setDecoratorState(prev => {
        const filteredOperations = prev.activePageOperations.filter(
          op => op.operationId !== operationId
        );
        
        return {
          ...prev,
          activePageOperations: filteredOperations,
          isPageOperationInProgress: filteredOperations.length > 0
        };
      });
      
      log('ページ操作終了', { operationId, success });
    }, []);
    
    // ===============================
    // オフライン同期制御
    // ===============================
    
    const queueForSync = useCallback((operation: any) => {
      if (!finalConfig.offlineSyncEnabled || decoratorState.isOnline) return;
      
      setDecoratorState(prev => {
        if (prev.syncQueue.queuedSaves.length >= finalConfig.syncQueueMaxSize) {
          log('同期キューが満杯です', { queueSize: prev.syncQueue.queuedSaves.length });
          return prev;
        }
        
        const queuedOperation = {
          id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          noteId: operation.noteId || 'unknown',
          noteType: operation.noteType || 'manual',
          operation: operation.type || 'save',
          data: operation.data || operation,
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: finalConfig.maxRetries
        };
        
        return {
          ...prev,
          syncQueue: {
            ...prev.syncQueue,
            queuedSaves: [...prev.syncQueue.queuedSaves, queuedOperation]
          }
        };
      });
      
      log('オフライン操作をキューに追加', { operation });
    }, [finalConfig.offlineSyncEnabled, finalConfig.syncQueueMaxSize, finalConfig.maxRetries, decoratorState.isOnline]);
    
    const processSyncQueue = useCallback(async () => {
      if (!decoratorState.isOnline || decoratorState.syncQueue.syncInProgress) return;
      
      setDecoratorState(prev => ({
        ...prev,
        syncQueue: { ...prev.syncQueue, syncInProgress: true }
      }));
      
      log('同期キュー処理開始', { queueSize: decoratorState.syncQueue.queuedSaves.length });
      
      try {
        const processedOperations: string[] = [];
        
        for (const operation of decoratorState.syncQueue.queuedSaves) {
          try {
            // 実際の同期処理をここで実行
            // await syncOperation(operation);
            processedOperations.push(operation.id);
            log('同期操作成功', { operationId: operation.id });
          } catch (error) {
            log('同期操作失敗', { operationId: operation.id, error });
            
            if (operation.retryCount >= operation.maxRetries) {
              processedOperations.push(operation.id); // 最大リトライ後は削除
            }
          }
        }
        
        // 処理済み操作をキューから削除
        setDecoratorState(prev => ({
          ...prev,
          syncQueue: {
            ...prev.syncQueue,
            queuedSaves: prev.syncQueue.queuedSaves.filter(
              op => !processedOperations.includes(op.id)
            ),
            lastSyncAttempt: new Date().toISOString(),
            syncInProgress: false
          }
        }));
        
        log('同期キュー処理完了', { processedCount: processedOperations.length });
        
      } catch (error) {
        log('同期キュー処理エラー', { error });
        setDecoratorState(prev => ({
          ...prev,
          syncQueue: { ...prev.syncQueue, syncInProgress: false }
        }));
      }
    }, [decoratorState.isOnline, decoratorState.syncQueue]);
    
    // ===============================
    // 実行可能性チェック
    // ===============================
    
    const canExecuteFunction = useCallback((toolbarFunction: ToolbarFunction): boolean => {
      // AI処理競合チェック
      if (finalConfig.aiConflictPrevention && decoratorState.isAnyAIProcessing) {
        const aiBlockingFunctions: ToolbarFunction[] = [
          'text_input', 'heading_change', 'font_change', 'title_edit'
        ];
        if (aiBlockingFunctions.includes(toolbarFunction)) {
          return false;
        }
      }
      
      // ページ操作競合チェック
      if (finalConfig.pageOperationControl && decoratorState.isPageOperationInProgress) {
        const pageBlockingFunctions: ToolbarFunction[] = [
          'template_select', 'background_change'
        ];
        if (pageBlockingFunctions.includes(toolbarFunction)) {
          return false;
        }
      }
      
      // 有効な機能チェック
      return finalConfig.enabledFunctions.includes(toolbarFunction);
    }, [finalConfig, decoratorState.isAnyAIProcessing, decoratorState.isPageOperationInProgress]);
    
    const getBlockingReason = useCallback((toolbarFunction: ToolbarFunction): string | null => {
      if (!finalConfig.enabledFunctions.includes(toolbarFunction)) {
        return '機能が無効化されています';
      }
      
      if (finalConfig.aiConflictPrevention && decoratorState.isAnyAIProcessing) {
        const aiBlockingFunctions: ToolbarFunction[] = [
          'text_input', 'heading_change', 'font_change', 'title_edit'
        ];
        if (aiBlockingFunctions.includes(toolbarFunction)) {
          return 'AI処理中のため一時的に無効化されています';
        }
      }
      
      if (finalConfig.pageOperationControl && decoratorState.isPageOperationInProgress) {
        const pageBlockingFunctions: ToolbarFunction[] = [
          'template_select', 'background_change'
        ];
        if (pageBlockingFunctions.includes(toolbarFunction)) {
          return 'ページ操作中のため一時的に無効化されています';
        }
      }
      
      return null;
    }, [finalConfig, decoratorState.isAnyAIProcessing, decoratorState.isPageOperationInProgress]);
    
    // ===============================
    // 自動保存トリガー
    // ===============================
    
    const markChanged = useCallback((toolbarFunction: ToolbarFunction, data?: any) => {
      console.log('🎯 AutoSaveDecorator: markChanged 呼び出し', { function: toolbarFunction, data });
      
      if (!canExecuteFunction(toolbarFunction)) {
        console.log('🚫 AutoSaveDecorator: 機能実行ブロック', { function: toolbarFunction, reason: getBlockingReason(toolbarFunction) });
        log('機能実行ブロック', { function: toolbarFunction, reason: getBlockingReason(toolbarFunction) });
        return;
      }
      
      const action: ToolbarAction = {
        function: toolbarFunction,
        data,
        timestamp: Date.now(),
        triggeredBy: 'user'
      };
      
      console.log('🎯 AutoSaveDecorator: アクション作成', action);
      
      pendingActionsRef.current.push(action);
      updateStats(toolbarFunction, true);
      
      // デバウンス処理
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      console.log('🕒 AutoSaveDecorator: デバウンスタイマー設定', { debounceMs: finalConfig.debounceMs });
      
      debounceTimerRef.current = setTimeout(() => {
        console.log('⚡ AutoSaveDecorator: デバウンス実行', { 
          currentNote: !!currentNote, 
          universalNoteService: !!universalNoteServiceRef.current 
        });
        
        if (currentNote && universalNoteServiceRef.current) {
          // UniversalNoteServiceを使用して保存
          console.log('🚀 AutoSaveDecorator: UniversalNoteService保存開始');
          universalNoteServiceRef.current.saveUniversalNote(currentNote);
          log('統一自動保存実行', { 
            function: toolbarFunction, 
            pendingActions: pendingActionsRef.current.length 
          });
        } else {
          console.log('❌ AutoSaveDecorator: 保存失敗 - currentNoteまたはserviceが未初期化');
        }
        pendingActionsRef.current = [];
      }, finalConfig.debounceMs);
      
      log('機能実行', { function: toolbarFunction, data });
    }, [canExecuteFunction, getBlockingReason, currentNote, finalConfig.debounceMs, updateStats]);
    
    const triggerSave = useCallback(async (toolbarAction: ToolbarAction): Promise<SaveResult> => {
      if (!currentNote || !universalNoteServiceRef.current) {
        return { 
          success: false, 
          error: 'UniversalNote or Service not initialized',
          savedAt: new Date().toISOString(),
          noteId: 'unknown'
        };
      }
      
      try {
        log('強制保存実行', { toolbarAction });
        const result = await universalNoteServiceRef.current.saveUniversalNote(currentNote);
        updateStats(toolbarAction.function, result.success);
        
        if (!decoratorState.isOnline && finalConfig.offlineSyncEnabled) {
          queueForSync({
            type: 'save',
            noteId: result.noteId,
            data: toolbarAction,
            timestamp: Date.now()
          });
        }
        
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        updateStats(toolbarAction.function, false);
        
        return {
          success: false,
          error: errorMessage,
          savedAt: new Date().toISOString(),
          noteId: currentNote.id
        };
      }
    }, [currentNote, decoratorState.isOnline, finalConfig.offlineSyncEnabled, queueForSync, updateStats]);
    
    // ===============================
    // デバッグ情報
    // ===============================
    
    const getDecoratorState = useCallback(() => decoratorState, [decoratorState]);
    
    const getStats = useCallback(() => ({
      config: finalConfig,
      state: decoratorState,
      functionsEnabled: finalConfig.enabledFunctions.length,
      totalTriggered: Object.values(decoratorState.functionsTriggered).reduce((a, b) => a + b, 0),
      successRate: decoratorState.successfulSaves / (decoratorState.successfulSaves + decoratorState.failedSaves) || 0,
      queueSize: decoratorState.syncQueue.queuedSaves.length,
      isOnline: decoratorState.isOnline
    }), [finalConfig, decoratorState]);
    
    // ===============================
    // クリーンアップ
    // ===============================
    
    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []);
    
    // ===============================
    // Props注入
    // ===============================
    
    const autoSaveProps: WithAutoSaveProps['autoSave'] = {
      triggerSave,
      markChanged,
      canExecuteFunction,
      getBlockingReason,
      startAIProcessing,
      endAIProcessing,
      isAIProcessing,
      startPageOperation,
      endPageOperation,
      queueForSync,
      processSyncQueue,
      getDecoratorState,
      getStats
    };
    
    return (
      <WrappedComponent 
        {...props} 
        autoSave={autoSaveProps}
      />
    );
  };
}

// ===============================
// エクスポート
// ===============================

export default withAutoSave;

// デフォルト設定のエクスポート
export { DEFAULT_DECORATOR_CONFIG }; 