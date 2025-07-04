/**
 * 統一自動保存システム - 型定義
 * しゃべるノートの全ノートタイプに対応した統一データモデル
 */

// ===============================
// 基本型定義
// ===============================

export type NoteType = 'recording' | 'photo_scan' | 'import' | 'manual';

export interface UniversalNote {
  id: string;
  type: NoteType;
  title: string;
  
  // 🆕 複数ページ対応（将来機能準備）
  pages: UniversalPage[];
  currentPageIndex: number;
  
  // メタデータ
  metadata: NoteMetadata;
  
  // 自動保存関連
  lastModified: string;
  lastSaved: string;
  autoSaveEnabled: boolean;
}

export interface UniversalPage {
  pageId: string;
  pageNumber: number;
  canvasData: CanvasData;
  lastModified: string;
  
  // ページ固有メタデータ
  pageMetadata?: {
    photoUri?: string;        // 写真スキャン用
    audioUri?: string;        // 録音用
    transcriptText?: string;  // 文字起こしテキスト
    enhancedText?: string;    // AI整形済みテキスト
  };
}

export interface CanvasData {
  type: 'canvas';
  version: '1.0';
  content: string;
  drawingPaths: DrawingPath[];
  textElements: TextElement[];
  canvasSettings: CanvasSettings;
  
  // データサイズ（パフォーマンス最適化用）
  contentLength: number;
  pathsCount: number;
  elementsCount: number;
  
  // 🆕 複数ページデータ（オプショナル）
  multiPageData?: {
    pages: Array<{
      id: string;
      title: string;
      content: string;
      drawingPaths: DrawingPath[];
      canvasData?: CanvasData;
    }>;
    currentPageIndex: number;
    totalPages: number;
  };
}

export interface DrawingPath {
  path: string;
  color: string;
  strokeWidth: number;
  tool: 'pen' | 'pencil' | 'marker' | 'eraser';
  timestamp: number;
}

export interface TextElement {
  id: string;
  type: 'heading1' | 'heading2' | 'heading3' | 'body';
  content: string;
  position: Point;
  style: TextStyle;
  timestamp: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  lineHeight: number;
  letterSpacing: number;
}

export interface CanvasSettings {
  selectedTool: 'pen' | 'keyboard' | 'voice' | null;
  selectedPenTool: 'pen' | 'pencil' | 'eraser' | 'marker' | null;
  selectedColor: string;
  strokeWidth: number;
  textSettings: {
    fontSize: number;
    textColor: string;
    selectedFont: string;
    selectedTextType: string;
    isBold: boolean;
    lineSpacing: number;
    letterSpacing: number;
  };
}

export interface NoteMetadata {
  createdAt: string;
  updatedAt: string;
  tags: string[];
  folder?: string;
  
  // 🆕 複数ページ対応
  totalPages?: number;
  
  // ノートタイプ別メタデータ
  recordingMetadata?: RecordingMetadata;
  photoScanMetadata?: PhotoScanMetadata;
  importMetadata?: ImportMetadata;
  manualMetadata?: ManualMetadata;
}

export interface RecordingMetadata {
  originalAudioUri: string;
  duration: number;
  sttProvider: string;
  sttConfidence: number;
  language: string;
}

export interface PhotoScanMetadata {
  originalPhotoUris: string[];
  ocrProvider: string;
  ocrConfidence: number;
  language: string;
  croppedRegions?: CropRegion[];
}

export interface ImportMetadata {
  sourceType: 'pdf' | 'url' | 'text';
  sourceUri: string;
  originalTitle?: string;
  importedAt: string;
  processedPages: number;
}

export interface ManualMetadata {
  templateUsed?: string;
  collaborators?: string[];
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ===============================
// オフライン同期対応型
// ===============================

export interface SyncQueue {
  queuedSaves: QueuedSaveOperation[];
  queuedDeletes: QueuedDeleteOperation[];
  lastSyncAttempt: string;
  syncInProgress: boolean;
}

export interface QueuedSaveOperation {
  id: string;
  noteId: string;
  noteType: NoteType;
  operation: 'save' | 'update';
  data: UniversalNote;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  error?: string;
}

export interface QueuedDeleteOperation {
  id: string;
  noteId: string;
  noteType: NoteType;
  operation: 'delete';
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  error?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSync: string;
  pendingOperations: number;
  syncErrors: SyncError[];
}

export interface SyncError {
  operationId: string;
  error: string;
  timestamp: string;
  resolved: boolean;
}

// ===============================
// ページ操作対応型
// ===============================

export interface PageOperation {
  operationId: string;
  type: 'copy' | 'paste' | 'delete' | 'move' | 'add';
  noteId: string;
  sourcePageId?: string;
  targetPageId?: string;
  targetIndex?: number;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface PageOperationData {
  operation: PageOperation;
  pageData?: UniversalPage;
  relatedPageIds?: string[];
  validationResult?: PageValidationResult;
}

export interface PageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  dependencies: string[];
}

// ===============================
// AI処理競合防止型
// ===============================

export interface AIProcessingState {
  isProcessing: boolean;
  processType: AIProcessType;
  noteId: string;
  pageId?: string;
  startTime: string;
  estimatedCompletion?: string;
  progress: number; // 0.0 - 1.0
}

export type AIProcessType = 
  | 'summarize'
  | 'correct_grammar'
  | 'add_furigana'
  | 'convert_characters'
  | 'dictionary_lookup'
  | 'research'
  | 'enhance_scanned_text'
  | 'voice_input';

export interface AIProcessResult {
  processType: AIProcessType;
  success: boolean;
  result?: any;
  error?: string;
  modifiedContent?: CanvasData;
  timestamp: string;
}

export interface AIProcessingQueue {
  activeProcesses: AIProcessingState[];
  queuedProcesses: QueuedAIProcess[];
  maxConcurrentProcesses: number;
}

export interface QueuedAIProcess {
  id: string;
  processType: AIProcessType;
  noteId: string;
  pageId?: string;
  inputData: any;
  priority: number;
  queuedAt: string;
}

// ===============================
// メディア処理対応型
// ===============================

export interface MediaProcessingState {
  mediaId: string;
  noteId: string;
  type: 'audio' | 'image' | 'pdf';
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number; // 0.0 - 1.0
  chunkInfo?: ChunkUploadInfo;
  processingStartTime?: string;
  estimatedCompletion?: string;
}

export interface ChunkUploadInfo {
  totalChunks: number;
  uploadedChunks: number;
  totalSize: number;
  uploadedSize: number;
  chunkSize: number;
}

// ===============================
// 自動保存設定型
// ===============================

export interface AutoSaveConfig {
  enabled: boolean;
  intervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
  conflictResolution: 'server-wins' | 'client-wins' | 'merge';
  
  // パフォーマンス設定
  batchSize: number;
  compressionEnabled: boolean;
  largeContentThreshold: number;
}

export interface AutoSaveState {
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  lastSaveAttempt: string;
  saveCount: number;
  errorCount: number;
  lastError?: string;
}

// ===============================
// 統計・監視型
// ===============================

export interface AutoSaveMetrics {
  totalSaves: number;
  successfulSaves: number;
  failedSaves: number;
  averageSaveTime: number;
  largestSaveSize: number;
  lastPerformanceCheck: string;
}

export interface PerformanceMetrics {
  saveResponseTime: number;
  uiBlockingTime: number;
  memoryUsage: number;
  cacheHitRate: number;
}

// ===============================
// ユーティリティ型
// ===============================

export interface SaveResult {
  success: boolean;
  savedAt: string;
  noteId: string;
  error?: string;
  metrics?: {
    saveTime: number;
    dataSize: number;
    compressionRatio?: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// ===============================
// 型ガード関数
// ===============================

export function isRecordingNote(note: UniversalNote): note is UniversalNote & { type: 'recording' } {
  return note.type === 'recording';
}

export function isPhotoScanNote(note: UniversalNote): note is UniversalNote & { type: 'photo_scan' } {
  return note.type === 'photo_scan';
}

export function isImportNote(note: UniversalNote): note is UniversalNote & { type: 'import' } {
  return note.type === 'import';
}

export function isManualNote(note: UniversalNote): note is UniversalNote & { type: 'manual' } {
  return note.type === 'manual';
}

export function hasAIProcessing(state: AIProcessingState[]): boolean {
  return state.some(process => process.isProcessing);
}

export function hasMediaProcessing(states: MediaProcessingState[]): boolean {
  return states.some(state => state.status === 'uploading' || state.status === 'processing');
}

// ===============================
// エクスポート
// ===============================

export default UniversalNote; 