/**
 * AIIntegrationService - AI処理統合サービス
 * AI処理統合制御、処理状況監視、エラー復旧処理を担当
 */

import { 
  UniversalNote,
  AIProcessingState,
  AIProcessType,
  AIProcessResult,
  AIProcessingQueue,
  QueuedAIProcess
} from '../types/UniversalNote';
import { universalNoteService } from './UniversalNoteService';
import { syncQueueService } from './SyncQueueService';

// ===============================
// インターフェース定義
// ===============================

export interface AIIntegrationServiceConfig {
  maxConcurrentProcesses: number;
  enableProcessQueue: boolean;
  enableConflictPrevention: boolean;
  processTimeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  debugMode: boolean;
}

export interface AIProcessContext {
  noteId: string;
  pageId?: string;
  userId: string;
  sessionId: string;
  requestId: string;
}

export interface ProcessingMetrics {
  totalProcesses: number;
  completedProcesses: number;
  failedProcesses: number;
  averageProcessingTime: number;
  activeProcesses: number;
  queuedProcesses: number;
}

export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictingProcesses: AIProcessingState[];
  conflictType: 'same_note' | 'same_page' | 'dependent_process';
  canProceed: boolean;
  suggestedDelay?: number;
}

// ===============================
// AIIntegrationService クラス
// ===============================

export class AIIntegrationService {
  private config: AIIntegrationServiceConfig;
  private processingQueue: AIProcessingQueue;
  private activeProcesses: Map<string, AIProcessingState>;
  private processMetrics: ProcessingMetrics;
  private conflictDetector: ConflictDetector;

  constructor(config: Partial<AIIntegrationServiceConfig> = {}) {
    this.config = {
      maxConcurrentProcesses: 3,
      enableProcessQueue: true,
      enableConflictPrevention: true,
      processTimeoutMs: 300000, // 5分
      retryAttempts: 2,
      retryDelayMs: 5000,
      debugMode: false,
      ...config
    };

    this.processingQueue = {
      activeProcesses: [],
      queuedProcesses: [],
      maxConcurrentProcesses: this.config.maxConcurrentProcesses
    };

    this.activeProcesses = new Map();
    this.processMetrics = {
      totalProcesses: 0,
      completedProcesses: 0,
      failedProcesses: 0,
      averageProcessingTime: 0,
      activeProcesses: 0,
      queuedProcesses: 0
    };

    this.conflictDetector = new ConflictDetector();

    this.log('AIIntegrationService initialized', { config: this.config });
  }

  // ===============================
  // AI処理制御
  // ===============================

  /**
   * AI処理を開始
   */
  async startAIProcess(
    processType: AIProcessType,
    context: AIProcessContext,
    inputData: any
  ): Promise<string> {
    try {
      const processId = `ai-${processType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      this.log('AI process request', { 
        processId,
        processType,
        noteId: context.noteId,
        pageId: context.pageId
      });

      // 競合検出
      if (this.config.enableConflictPrevention) {
        const conflictResult = await this.detectConflicts(processType, context);
        if (conflictResult.hasConflict && !conflictResult.canProceed) {
          throw new Error(`Process conflict detected: ${conflictResult.conflictType}`);
        }
        
        if (conflictResult.suggestedDelay) {
          await this.delay(conflictResult.suggestedDelay);
        }
      }

      // プロセス状態作成
      const processState: AIProcessingState = {
        isProcessing: true,
        processType,
        noteId: context.noteId,
        pageId: context.pageId,
        startTime: new Date().toISOString(),
        progress: 0.0
      };

      // キューまたは即座実行
      if (this.shouldQueueProcess()) {
        await this.queueProcess(processId, processType, context, inputData);
        this.log('Process queued', { processId, queueSize: this.processingQueue.queuedProcesses.length });
      } else {
        await this.executeProcess(processId, processState, inputData);
      }

      return processId;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Failed to start AI process', { 
        processType, 
        noteId: context.noteId,
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * AI処理を停止
   */
  async stopAIProcess(processId: string): Promise<boolean> {
    try {
      this.log('Stopping AI process', { processId });

      // アクティブプロセスから削除
      if (this.activeProcesses.has(processId)) {
        const process = this.activeProcesses.get(processId)!;
        process.isProcessing = false;
        this.activeProcesses.delete(processId);
        
        // キューから次のプロセスを実行
        this.processNextInQueue();
        
        this.log('Process stopped', { processId });
        return true;
      }

      // キューからの削除
      const queueIndex = this.processingQueue.queuedProcesses.findIndex(
        p => p.id === processId
      );
      if (queueIndex !== -1) {
        this.processingQueue.queuedProcesses.splice(queueIndex, 1);
        this.log('Process removed from queue', { processId });
        return true;
      }

      this.log('Process not found', { processId });
      return false;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Failed to stop process', { processId, error: errorMessage });
      return false;
    }
  }

  /**
   * 処理状況取得
   */
  getProcessStatus(processId: string): AIProcessingState | null {
    return this.activeProcesses.get(processId) || null;
  }

  /**
   * 全処理状況取得
   */
  getAllActiveProcesses(): AIProcessingState[] {
    return Array.from(this.activeProcesses.values());
  }

  // ===============================
  // プロセス実行
  // ===============================

  private async executeProcess(
    processId: string,
    processState: AIProcessingState,
    inputData: any
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      // アクティブプロセスに追加
      this.activeProcesses.set(processId, processState);
      this.processingQueue.activeProcesses.push(processState);
      this.updateMetrics('start');

      this.log('Process execution started', { 
        processId,
        processType: processState.processType,
        noteId: processState.noteId
      });

      // プロセスタイプ別実行
      const result = await this.executeProcessByType(
        processState.processType,
        inputData,
        (progress) => this.updateProcessProgress(processId, progress)
      );

      // 完了処理
      processState.isProcessing = false;
      processState.progress = 1.0;

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      this.log('Process completed', { 
        processId,
        processingTime: `${processingTime.toFixed(2)}ms`,
        success: result.success
      });

      // 結果をノートに反映
      if (result.success && result.modifiedContent) {
        await this.applyResultToNote(processState, result);
      }

      this.updateMetrics('complete', processingTime);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      processState.isProcessing = false;
      this.log('Process failed', { processId, error: errorMessage });
      this.updateMetrics('failed');

      // リトライ処理
      if (this.shouldRetry(processId)) {
        await this.retryProcess(processId, processState, inputData);
      }

    } finally {
      // クリーンアップ
      this.activeProcesses.delete(processId);
      this.removeFromActiveQueue(processState);
      
      // 次のプロセスを実行
      this.processNextInQueue();
    }
  }

  private async executeProcessByType(
    processType: AIProcessType,
    inputData: any,
    progressCallback: (progress: number) => void
  ): Promise<AIProcessResult> {
    // プロセスタイプ別の実装（モック）
    progressCallback(0.1);

    switch (processType) {
      case 'summarize':
        return await this.processSummarize(inputData, progressCallback);
      case 'correct_grammar':
        return await this.processGrammarCorrection(inputData, progressCallback);
      case 'enhance_scanned_text':
        return await this.processTextEnhancement(inputData, progressCallback);
      case 'voice_input':
        return await this.processVoiceInput(inputData, progressCallback);
      default:
        return await this.processGeneric(processType, inputData, progressCallback);
    }
  }

  // ===============================
  // プロセスタイプ別実装
  // ===============================

  private async processSummarize(
    inputData: any,
    progressCallback: (progress: number) => void
  ): Promise<AIProcessResult> {
    progressCallback(0.3);
    await this.delay(1000); // シミュレート処理時間
    progressCallback(0.7);
    await this.delay(1000);
    progressCallback(1.0);

    return {
      processType: 'summarize',
      success: true,
      result: {
        summary: 'AI生成された要約テキスト',
        keyPoints: ['重要ポイント1', '重要ポイント2']
      },
      timestamp: new Date().toISOString()
    };
  }

  private async processGrammarCorrection(
    inputData: any,
    progressCallback: (progress: number) => void
  ): Promise<AIProcessResult> {
    progressCallback(0.4);
    await this.delay(800);
    progressCallback(0.8);
    await this.delay(500);
    progressCallback(1.0);

    return {
      processType: 'correct_grammar',
      success: true,
      result: {
        correctedText: inputData.text + ' (文法修正済み)',
        corrections: []
      },
      timestamp: new Date().toISOString()
    };
  }

  private async processTextEnhancement(
    inputData: any,
    progressCallback: (progress: number) => void
  ): Promise<AIProcessResult> {
    progressCallback(0.2);
    await this.delay(1500);
    progressCallback(0.6);
    await this.delay(1000);
    progressCallback(1.0);

    return {
      processType: 'enhance_scanned_text',
      success: true,
      result: {
        enhancedText: inputData.text + ' (AI整形済み)',
        confidence: 0.95
      },
      timestamp: new Date().toISOString()
    };
  }

  private async processVoiceInput(
    inputData: any,
    progressCallback: (progress: number) => void
  ): Promise<AIProcessResult> {
    progressCallback(0.25);
    await this.delay(2000);
    progressCallback(0.75);
    await this.delay(1000);
    progressCallback(1.0);

    return {
      processType: 'voice_input',
      success: true,
      result: {
        transcription: '音声認識結果テキスト',
        confidence: 0.92
      },
      timestamp: new Date().toISOString()
    };
  }

  private async processGeneric(
    processType: AIProcessType,
    inputData: any,
    progressCallback: (progress: number) => void
  ): Promise<AIProcessResult> {
    progressCallback(0.5);
    await this.delay(1000);
    progressCallback(1.0);

    return {
      processType,
      success: true,
      result: { processed: true },
      timestamp: new Date().toISOString()
    };
  }

  // ===============================
  // 競合検出
  // ===============================

  private async detectConflicts(
    processType: AIProcessType,
    context: AIProcessContext
  ): Promise<ConflictDetectionResult> {
    return this.conflictDetector.detectConflicts(
      processType,
      context,
      Array.from(this.activeProcesses.values())
    );
  }

  // ===============================
  // ユーティリティメソッド
  // ===============================

  private shouldQueueProcess(): boolean {
    return this.config.enableProcessQueue && 
           this.processingQueue.activeProcesses.length >= this.config.maxConcurrentProcesses;
  }

  private async queueProcess(
    processId: string,
    processType: AIProcessType,
    context: AIProcessContext,
    inputData: any
  ): Promise<void> {
    const queuedProcess: QueuedAIProcess = {
      id: processId,
      processType,
      noteId: context.noteId,
      pageId: context.pageId,
      inputData,
      priority: this.calculatePriority(processType),
      queuedAt: new Date().toISOString()
    };

    this.processingQueue.queuedProcesses.push(queuedProcess);
    this.processingQueue.queuedProcesses.sort((a, b) => b.priority - a.priority);
  }

  private calculatePriority(processType: AIProcessType): number {
    const priorities = {
      'voice_input': 10,
      'enhance_scanned_text': 8,
      'correct_grammar': 6,
      'summarize': 4,
      'add_furigana': 3,
      'convert_characters': 2,
      'dictionary_lookup': 1,
      'research': 1
    };
    return priorities[processType] || 1;
  }

  private async processNextInQueue(): Promise<void> {
    if (this.processingQueue.queuedProcesses.length === 0 ||
        this.processingQueue.activeProcesses.length >= this.config.maxConcurrentProcesses) {
      return;
    }

    const nextProcess = this.processingQueue.queuedProcesses.shift();
    if (!nextProcess) return;

    const processState: AIProcessingState = {
      isProcessing: true,
      processType: nextProcess.processType,
      noteId: nextProcess.noteId,
      pageId: nextProcess.pageId,
      startTime: new Date().toISOString(),
      progress: 0.0
    };

    await this.executeProcess(nextProcess.id, processState, nextProcess.inputData);
  }

  private updateProcessProgress(processId: string, progress: number): void {
    const process = this.activeProcesses.get(processId);
    if (process) {
      process.progress = Math.min(Math.max(progress, 0), 1);
      this.log('Process progress updated', { processId, progress });
    }
  }

  private async applyResultToNote(
    processState: AIProcessingState,
    result: AIProcessResult
  ): Promise<void> {
    try {
      // ノートへの結果反映（モック実装）
      this.log('Applying result to note', { 
        noteId: processState.noteId,
        processType: processState.processType
      });

      // 実際の実装では universalNoteService を使用してノートを更新
      // const note = await universalNoteService.loadUniversalNote(processState.noteId);
      // if (note && result.modifiedContent) {
      //   note.pages[note.currentPageIndex].canvasData = result.modifiedContent;
      //   await universalNoteService.saveUniversalNote(note);
      // }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Failed to apply result to note', { 
        noteId: processState.noteId,
        error: errorMessage
      });
    }
  }

  private shouldRetry(processId: string): boolean {
    // リトライロジック（簡易実装）
    return false; // 現在はリトライなし
  }

  private async retryProcess(
    processId: string,
    processState: AIProcessingState,
    inputData: any
  ): Promise<void> {
    await this.delay(this.config.retryDelayMs);
    await this.executeProcess(processId, processState, inputData);
  }

  private removeFromActiveQueue(processState: AIProcessingState): void {
    const index = this.processingQueue.activeProcesses.findIndex(
      p => p.noteId === processState.noteId && 
           p.processType === processState.processType &&
           p.startTime === processState.startTime
    );
    if (index !== -1) {
      this.processingQueue.activeProcesses.splice(index, 1);
    }
  }

  private updateMetrics(operation: 'start' | 'complete' | 'failed', processingTime?: number): void {
    this.processMetrics.totalProcesses++;
    
    if (operation === 'complete') {
      this.processMetrics.completedProcesses++;
      if (processingTime !== undefined) {
        this.processMetrics.averageProcessingTime = 
          (this.processMetrics.averageProcessingTime * (this.processMetrics.completedProcesses - 1) + processingTime) / 
          this.processMetrics.completedProcesses;
      }
    } else if (operation === 'failed') {
      this.processMetrics.failedProcesses++;
    }

    this.processMetrics.activeProcesses = this.activeProcesses.size;
    this.processMetrics.queuedProcesses = this.processingQueue.queuedProcesses.length;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.log(`🤖 AIIntegrationService: ${message}`, data || '');
    }
  }

  // ===============================
  // パブリックメソッド
  // ===============================

  /**
   * 処理統計取得
   */
  getProcessingMetrics(): ProcessingMetrics {
    return { ...this.processMetrics };
  }

  /**
   * キュー状況取得
   */
  getQueueStatus(): {
    active: number;
    queued: number;
    maxConcurrent: number;
  } {
    return {
      active: this.processingQueue.activeProcesses.length,
      queued: this.processingQueue.queuedProcesses.length,
      maxConcurrent: this.config.maxConcurrentProcesses
    };
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<AIIntegrationServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.processingQueue.maxConcurrentProcesses = this.config.maxConcurrentProcesses;
    this.log('Config updated', { config: this.config });
  }

  /**
   * サービスクリア
   */
  clear(): void {
    this.activeProcesses.clear();
    this.processingQueue.activeProcesses = [];
    this.processingQueue.queuedProcesses = [];
    this.log('AIIntegrationService cleared');
  }
}

// ===============================
// 競合検出器クラス
// ===============================

class ConflictDetector {
  detectConflicts(
    processType: AIProcessType,
    context: AIProcessContext,
    activeProcesses: AIProcessingState[]
  ): ConflictDetectionResult {
    // 簡易競合検出実装
    const conflictingProcesses = activeProcesses.filter(process => 
      process.noteId === context.noteId && 
      (process.pageId === context.pageId || !process.pageId)
    );

    const hasConflict = conflictingProcesses.length > 0;
    const canProceed = !hasConflict || conflictingProcesses.every(p => 
      this.isCompatibleProcess(processType, p.processType)
    );

    return {
      hasConflict,
      conflictingProcesses,
      conflictType: hasConflict ? 'same_page' : 'same_note',
      canProceed,
      suggestedDelay: hasConflict && !canProceed ? 2000 : undefined
    };
  }

  private isCompatibleProcess(type1: AIProcessType, type2: AIProcessType): boolean {
    // 互換性のあるプロセスタイプの組み合わせ
    const compatibleCombinations = [
      ['dictionary_lookup', 'research'],
      ['voice_input', 'correct_grammar']
    ];

    return compatibleCombinations.some(combo => 
      (combo.includes(type1) && combo.includes(type2))
    );
  }
}

// ===============================
// シングルトンインスタンス
// ===============================

export const aiIntegrationService = new AIIntegrationService({
  maxConcurrentProcesses: 3,
  enableProcessQueue: true,
  enableConflictPrevention: true,
  processTimeoutMs: 300000,
  retryAttempts: 2,
  debugMode: true
}); 