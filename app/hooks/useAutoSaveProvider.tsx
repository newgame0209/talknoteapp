import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { UniversalNote, SaveResult } from '../types/UniversalNote';
import { useAutoSave, UseAutoSaveReturn } from './useAutoSave';
import * as database from '../services/database';

// ===============================
// Context型定義
// ===============================

interface AutoSaveContextValue {
  // 現在アクティブなノートの自動保存
  currentAutoSave: UseAutoSaveReturn | null;
  
  // グローバル操作
  enableAutoSaveForNote: (note: UniversalNote) => void;
  disableAutoSave: () => void;
  
  // グローバル状態
  isGloballyEnabled: boolean;
  setGloballyEnabled: (enabled: boolean) => void;
  
  // 統計情報
  globalMetrics: {
    totalNotes: number;
    activeSessions: number;
    totalSaves: number;
    errors: number;
  };
}

// ===============================
// Context作成
// ===============================

const AutoSaveContext = createContext<AutoSaveContextValue | null>(null);

// ===============================
// Provider Props
// ===============================

interface AutoSaveProviderProps {
  children: React.ReactNode;
  globalEnabled?: boolean;
  debugMode?: boolean;
}

// ===============================
// AutoSaveProvider実装
// ===============================

export const AutoSaveProvider: React.FC<AutoSaveProviderProps> = ({
  children,
  globalEnabled = true,
  debugMode = false
}) => {
  
  // ===============================
  // 状態管理
  // ===============================
  
  const [currentNote, setCurrentNote] = useState<UniversalNote | null>(null);
  const [isGloballyEnabled, setIsGloballyEnabled] = useState(globalEnabled);
  const [globalMetrics, setGlobalMetrics] = useState({
    totalNotes: 0,
    activeSessions: 0,
    totalSaves: 0,
    errors: 0
  });
  
  // ===============================
  // 保存関数（データベース統合）
  // ===============================
  
  const handleSave = useCallback(async (note: UniversalNote): Promise<SaveResult> => {
    const startTime = Date.now();
    
    try {
      if (debugMode) {
        console.log('🔄 AutoSaveProvider: 保存開始', { 
          noteId: note.id, 
          type: note.type 
        });
      }
      
             // データベースに保存（既存APIに合わせて調整）
       await database.updateNote(note.id, note.title);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // メトリクス更新
      setGlobalMetrics(prev => ({
        ...prev,
        totalSaves: prev.totalSaves + 1
      }));
      
      if (debugMode) {
        console.log('✅ AutoSaveProvider: 保存成功', { 
          noteId: note.id, 
          duration: `${duration}ms` 
        });
      }
      
      return {
        success: true,
        savedAt: new Date().toISOString(),
        noteId: note.id,
        metrics: {
          saveTime: duration,
          dataSize: JSON.stringify(note).length
        }
      };
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // エラーメトリクス更新
      setGlobalMetrics(prev => ({
        ...prev,
        errors: prev.errors + 1
      }));
      
      const errorMessage = error instanceof Error ? error.message : 'Database save failed';
      
      if (debugMode) {
        console.error('❌ AutoSaveProvider: 保存失敗', { 
          noteId: note.id, 
          error: errorMessage,
          duration: `${duration}ms` 
        });
      }
      
      return {
        success: false,
        error: errorMessage,
        savedAt: new Date().toISOString(),
        noteId: note.id,
        metrics: {
          saveTime: duration,
          dataSize: JSON.stringify(note).length
        }
      };
    }
  }, [debugMode]);
  
  // ===============================
  // useAutoSave Hook統合
  // ===============================
  
  const autoSaveInstance = currentNote ? useAutoSave(
    currentNote,
    handleSave,
    {
      enabled: isGloballyEnabled,
      debugMode
    }
  ) : null;
  
  // ===============================
  // Public API
  // ===============================
  
  const enableAutoSaveForNote = useCallback((note: UniversalNote) => {
    if (debugMode) {
      console.log('🎯 AutoSaveProvider: ノート有効化', { 
        noteId: note.id, 
        type: note.type 
      });
    }
    
    setCurrentNote(note);
    setGlobalMetrics(prev => ({
      ...prev,
      totalNotes: prev.totalNotes + 1,
      activeSessions: 1
    }));
  }, [debugMode]);
  
  const disableAutoSave = useCallback(() => {
    if (debugMode) {
      console.log('🛑 AutoSaveProvider: 自動保存無効化');
    }
    
    setCurrentNote(null);
    setGlobalMetrics(prev => ({
      ...prev,
      activeSessions: 0
    }));
  }, [debugMode]);
  
  const setGloballyEnabledWithLog = useCallback((enabled: boolean) => {
    if (debugMode) {
      console.log(`🌐 AutoSaveProvider: グローバル設定変更 ${enabled ? 'ON' : 'OFF'}`);
    }
    setIsGloballyEnabled(enabled);
  }, [debugMode]);
  
  // ===============================
  // Context Value
  // ===============================
  
  const contextValue: AutoSaveContextValue = {
    currentAutoSave: autoSaveInstance,
    enableAutoSaveForNote,
    disableAutoSave,
    isGloballyEnabled,
    setGloballyEnabled: setGloballyEnabledWithLog,
    globalMetrics
  };
  
  // ===============================
  // Effects
  // ===============================
  
  // グローバル設定変更時のログ
  useEffect(() => {
    if (debugMode) {
      console.log('🔧 AutoSaveProvider: 初期化完了', {
        globalEnabled: isGloballyEnabled,
        debugMode,
        currentNote: currentNote?.id || 'none'
      });
    }
  }, []);
  
  // ===============================
  // Render
  // ===============================
  
  return (
    <AutoSaveContext.Provider value={contextValue}>
      {children}
    </AutoSaveContext.Provider>
  );
};

// ===============================
// Hook for consuming context
// ===============================

export const useAutoSaveContext = (): AutoSaveContextValue => {
  const context = useContext(AutoSaveContext);
  
  if (!context) {
    throw new Error('useAutoSaveContext must be used within an AutoSaveProvider');
  }
  
  return context;
};

// ===============================
// 🚨 REMOVED: withAutoSave HOC (AutoSaveDecoratorと競合するため削除)
// 
// AutoSaveDecoratorの withAutoSave 関数を使用してください:
// import withAutoSave from '../decorators/AutoSaveDecorator';
// ===============================

// ===============================
// エクスポート
// ===============================

export default AutoSaveProvider; 