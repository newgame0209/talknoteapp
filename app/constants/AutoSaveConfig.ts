/**
 * 統一自動保存システム - 設定定数
 * しゃべるノートの自動保存機能の各種設定値
 */

import { AutoSaveConfig } from '../types/UniversalNote';

// ===============================
// 自動保存設定定数
// ===============================

export const DEFAULT_AUTO_SAVE_CONFIG: AutoSaveConfig = {
  enabled: true,
  intervalMs: 5000,           // 5秒間隔
  maxRetries: 3,              // 最大3回リトライ
  retryDelayMs: 1000,         // 1秒後にリトライ
  conflictResolution: 'client-wins',
  
  // パフォーマンス設定
  batchSize: 10,              // バッチ処理サイズ
  compressionEnabled: true,   // 圧縮有効
  largeContentThreshold: 1024 * 100, // 100KB以上で大容量扱い
};

// ===============================
// タイミング定数
// ===============================

export const TIMING = {
  // 自動保存間隔
  AUTO_SAVE_INTERVAL: 5000,           // 5秒
  IMMEDIATE_SAVE_DELAY: 100,          // 即座保存時の遅延（デバウンス）
  
  // タイムアウト
  SAVE_TIMEOUT: 10000,                // 10秒で保存タイムアウト
  SYNC_TIMEOUT: 30000,                // 30秒で同期タイムアウト
  AI_PROCESSING_TIMEOUT: 60000,       // 60秒でAI処理タイムアウト
  
  // リトライ間隔
  RETRY_DELAY_BASE: 1000,             // 1秒ベース
  RETRY_DELAY_MULTIPLIER: 2,          // 指数バックオフ係数
  MAX_RETRY_DELAY: 30000,             // 最大30秒
  
  // ポーリング間隔
  SYNC_STATUS_POLL_INTERVAL: 5000,    // 同期状況5秒間隔
  MEDIA_STATUS_POLL_INTERVAL: 2000,   // メディア処理2秒間隔
} as const;

// ===============================
// サイズ制限定数
// ===============================

export const SIZE_LIMITS = {
  // データサイズ制限
  MAX_CANVAS_DATA_SIZE: 1024 * 1024 * 5,      // 5MB
  MAX_TEXT_CONTENT_SIZE: 1024 * 1024,         // 1MB
  MAX_DRAWING_PATHS: 10000,                   // 最大パス数
  MAX_TEXT_ELEMENTS: 1000,                    // 最大テキスト要素数
  
  // チャンク分割
  CHUNK_SIZE: 1024 * 1024 * 5,                // 5MB チャンク
  MAX_CHUNKS: 100,                            // 最大100チャンク
  
  // 圧縮しきい値
  COMPRESSION_THRESHOLD: 1024 * 10,           // 10KB以上で圧縮
  COMPRESSION_LEVEL: 6,                       // 圧縮レベル（1-9）
} as const;

// ===============================
// パフォーマンス定数
// ===============================

export const PERFORMANCE = {
  // 許容レスポンス時間
  TARGET_SAVE_TIME: 100,                      // 100ms以内
  TARGET_UI_BLOCK_TIME: 0,                    // UIブロック0ms
  WARNING_SAVE_TIME: 500,                     // 500ms超で警告
  ERROR_SAVE_TIME: 2000,                      // 2秒超でエラー
  
  // メモリ制限
  MAX_MEMORY_USAGE: 1024 * 1024 * 50,         // 50MB
  CACHE_SIZE_LIMIT: 1024 * 1024 * 10,         // 10MB キャッシュ
  
  // 同期処理制限
  MAX_CONCURRENT_SAVES: 3,                    // 最大3並列保存
  MAX_CONCURRENT_AI_PROCESSES: 2,             // 最大2並列AI処理
  MAX_QUEUE_SIZE: 100,                        // 最大キューサイズ
} as const;

// ===============================
// エラー処理定数
// ===============================

export const ERROR_HANDLING = {
  // リトライ設定
  MAX_SAVE_RETRIES: 3,
  MAX_SYNC_RETRIES: 5,
  MAX_AI_RETRIES: 2,
  
  // エラー分類
  RECOVERABLE_ERRORS: [
    'NetworkError',
    'TimeoutError',
    'TemporaryServerError',
  ],
  
  FATAL_ERRORS: [
    'AuthenticationError',
    'PermissionError',
    'DataCorruptionError',
  ],
  
  // ログレベル
  LOG_LEVELS: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  },
} as const;

// ===============================
// オフライン同期定数
// ===============================

export const OFFLINE_SYNC = {
  // キュー制限
  MAX_QUEUE_OPERATIONS: 1000,                 // 最大1000操作
  QUEUE_CLEANUP_INTERVAL: 1000 * 60 * 60,     // 1時間間隔でクリーンアップ
  
  // 保持期間
  OPERATION_RETENTION_DAYS: 7,                // 7日間保持
  ERROR_RETENTION_DAYS: 30,                   // エラーログ30日間保持
  
  // 同期戦略
  SYNC_STRATEGIES: {
    IMMEDIATE: 'immediate',                   // 即座同期
    BATCH: 'batch',                          // バッチ同期
    SCHEDULED: 'scheduled',                  // スケジュール同期
  },
  
  // バッチサイズ
  BATCH_SIZE: 20,                            // 20操作ずつ処理
  BATCH_INTERVAL: 1000 * 30,                 // 30秒間隔
} as const;

// ===============================
// AI処理定数
// ===============================

export const AI_PROCESSING = {
  // プロセスタイプ別タイムアウト
  TIMEOUTS: {
    summarize: 30000,                        // 要約: 30秒
    correct_grammar: 20000,                  // 校正: 20秒
    add_furigana: 15000,                     // 読み仮名: 15秒
    convert_characters: 10000,               // 文字変換: 10秒
    dictionary_lookup: 5000,                 // 辞書: 5秒
    research: 45000,                         // リサーチ: 45秒
    enhance_scanned_text: 25000,             // テキスト整形: 25秒
    voice_input: 60000,                      // 音声入力: 60秒
  },
  
  // 優先度
  PRIORITIES: {
    voice_input: 1,                          // 最高優先
    enhance_scanned_text: 2,
    correct_grammar: 3,
    add_furigana: 4,
    convert_characters: 5,
    summarize: 6,
    dictionary_lookup: 7,
    research: 8,                             // 最低優先
  },
  
  // 処理制限
  MAX_INPUT_LENGTH: 10000,                   // 最大10,000文字
  MAX_CONCURRENT: 2,                         // 最大2並列
} as const;

// ===============================
// デバッグ・監視定数
// ===============================

export const DEBUG = {
  // ログ出力制御
  ENABLE_PERFORMANCE_LOGS: true,
  ENABLE_SAVE_LOGS: true,
  ENABLE_SYNC_LOGS: true,
  ENABLE_AI_LOGS: true,
  
  // 詳細ログしきい値
  DETAILED_LOG_THRESHOLD: 500,               // 500ms超で詳細ログ
  
  // メトリクス収集
  COLLECT_METRICS: true,
  METRICS_RETENTION_HOURS: 24,               // 24時間保持
  
  // エラー追跡
  TRACK_ERRORS: true,
  MAX_ERROR_REPORTS: 100,                    // 最大100エラー保持
} as const;

// ===============================
// 環境別設定
// ===============================

export const getEnvironmentConfig = () => {
  // React Nativeの開発環境判定（__DEV__が定義されていない場合のフォールバック）
  const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    return {
      ...DEFAULT_AUTO_SAVE_CONFIG,
      intervalMs: 3000,                      // 開発時は3秒間隔
      maxRetries: 5,                         // 開発時は多めにリトライ
      compressionEnabled: false,             // 開発時は圧縮無効
    };
  }
  
  return DEFAULT_AUTO_SAVE_CONFIG;
};

// ===============================
// バリデーション関数
// ===============================

export const validateConfig = (config: Partial<AutoSaveConfig>): boolean => {
  if (config.intervalMs && config.intervalMs < 1000) {
    console.warn('⚠️ 自動保存間隔が短すぎます（最小1秒）');
    return false;
  }
  
  if (config.maxRetries && config.maxRetries > 10) {
    console.warn('⚠️ 最大リトライ回数が多すぎます（最大10回）');
    return false;
  }
  
  if (config.largeContentThreshold && config.largeContentThreshold < 1024) {
    console.warn('⚠️ 大容量しきい値が小さすぎます（最小1KB）');
    return false;
  }
  
  return true;
};

// ===============================
// エクスポート
// ===============================

export default DEFAULT_AUTO_SAVE_CONFIG; 