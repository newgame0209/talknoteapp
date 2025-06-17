/**
 * 🎤 TTS前処理ユーティリティ
 * 全てのTTSパターン（手書き・テキスト・写真スキャン・録音・インポート）で共通使用
 */

// 🚫 読み上げ時にスキップする記号リスト
const SKIP_SYMBOLS = [
  // 基本記号
  '※', '★', '☆', '◆', '◇', '●', '○', '■', '□', '▲', '△', '▼', '▽',
  // Markdown記号
  '*', '#', '_', '`', '~',
  // 矢印・方向
  '・', '→', '←', '↑', '↓', '⇒', '⇐', '⇑', '⇓', '⇔', '↔',
  // 括弧類（一部）
  '【', '】', '『', '』', '〈', '〉', '《', '》',
  // 装飾記号
  '◎', '◉', '◐', '◑', '◒', '◓', '✓', '✔', '✗', '✘',
  // 数学・単位記号
  '±', '×', '÷', '∞', '∑', '∏', '∫', '√', '∂', '∇',
  // その他よく使用される記号
  '§', '¶', '†', '‡', '‰', '‱', '℃', '℉', '€', '£', '¥', '$',
  // 特殊空白・制御文字
  '\u00A0', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005',
  '\u2006', '\u2007', '\u2008', '\u2009', '\u200A', '\u200B', '\u200C', '\u200D',
];

// 🔤 読み方改善マップ（よくある誤読対策）
const READING_IMPROVEMENTS: Record<string, string> = {
  // 数字の読み方統一
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
  
  // アルファベットの読み方統一
  'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｄ': 'D', 'Ｅ': 'E',
  'Ｆ': 'F', 'Ｇ': 'G', 'Ｈ': 'H', 'Ｉ': 'I', 'Ｊ': 'J',
  'Ｋ': 'K', 'Ｌ': 'L', 'Ｍ': 'M', 'Ｎ': 'N', 'Ｏ': 'O',
  'Ｐ': 'P', 'Ｑ': 'Q', 'Ｒ': 'R', 'Ｓ': 'S', 'Ｔ': 'T',
  'Ｕ': 'U', 'Ｖ': 'V', 'Ｗ': 'W', 'Ｘ': 'X', 'Ｙ': 'Y', 'Ｚ': 'Z',
  
  // 小文字
  'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e',
  'ｆ': 'f', 'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j',
  'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o',
  'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r', 'ｓ': 's', 'ｔ': 't',
  'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x', 'ｙ': 'y', 'ｚ': 'z',
  
  // よくある誤読単語（必要に応じて追加）
  '〜': 'から', // 波ダッシュ → 「から」
  '～': 'から', // 全角チルダ → 「から」
  '…': '。', // 三点リーダ → 句点
  '‥': '。', // 二点リーダ → 句点
};

/**
 * 🎤 TTS用テキスト前処理メイン関数
 * @param text 元のテキスト
 * @returns TTS用に最適化されたテキスト
 */
export function preprocessTextForTTS(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let processedText = text;

  // 1️⃣ 記号除去
  processedText = removeSkipSymbols(processedText);

  // 2️⃣ 読み方改善
  processedText = improveReadings(processedText);

  // 3️⃣ 空白・改行の正規化
  processedText = normalizeWhitespace(processedText);

  // 4️⃣ 最終クリーンアップ
  processedText = finalCleanup(processedText);

  return processedText;
}

/**
 * 🚫 記号除去処理
 */
function removeSkipSymbols(text: string): string {
  let result = text;
  
  // 各記号を削除
  SKIP_SYMBOLS.forEach(symbol => {
    // 正規表現で特殊文字をエスケープ
    const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedSymbol, 'g'), '');
  });
  
  return result;
}

/**
 * 🔤 読み方改善処理
 */
function improveReadings(text: string): string {
  let result = text;
  
  // 読み方改善マップを適用
  Object.entries(READING_IMPROVEMENTS).forEach(([from, to]) => {
    const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedFrom, 'g'), to);
  });
  
  return result;
}

/**
 * 🔄 空白・改行の正規化
 */
function normalizeWhitespace(text: string): string {
  return text
    // 連続する改行を単一改行に統一
    .replace(/\n{3,}/g, '\n\n')
    // 連続する空白を単一スペースに統一
    .replace(/[ \t]{2,}/g, ' ')
    // タブを空白に変換
    .replace(/\t/g, ' ')
    // 行頭・行末の空白を除去
    .replace(/^[ \t]+|[ \t]+$/gm, '');
}

/**
 * 🧹 最終クリーンアップ
 */
function finalCleanup(text: string): string {
  return text
    // 先頭・末尾の空白・改行を除去
    .trim()
    // 空の行を除去
    .replace(/^\s*\n/gm, '')
    // 最終的な連続空白の除去
    .replace(/\s+/g, ' ');
}

/**
 * 📊 前処理結果のデバッグ情報
 * @param originalText 元のテキスト
 * @param processedText 処理後のテキスト
 * @returns デバッグ情報
 */
export function getTTSPreprocessDebugInfo(originalText: string, processedText: string) {
  const removedSymbols = SKIP_SYMBOLS.filter(symbol => 
    originalText.includes(symbol)
  );
  
  const appliedImprovements = Object.entries(READING_IMPROVEMENTS).filter(([from]) => 
    originalText.includes(from)
  );

  return {
    originalLength: originalText.length,
    processedLength: processedText.length,
    removedCharacters: originalText.length - processedText.length,
    removedSymbols,
    appliedImprovements: appliedImprovements.map(([from, to]) => ({ from, to })),
    hasChanges: originalText !== processedText,
  };
}

/**
 * 🎯 開発用：前処理のテスト関数
 */
export function testTTSPreprocessor() {
  const testCases = [
    '※これは重要な情報です★',
    '山田→田中（変更）',
    '価格：１００円・税込み',
    '【注意】この商品は…売り切れです。',
    'ＡＢＣ１２３あいうえお',
  ];

  console.log('🧪 TTS前処理テスト結果:');
  testCases.forEach((testCase, index) => {
    const processed = preprocessTextForTTS(testCase);
    const debugInfo = getTTSPreprocessDebugInfo(testCase, processed);
    
    console.log(`テストケース ${index + 1}:`);
    console.log(`  元テキスト: "${testCase}"`);
    console.log(`  処理後: "${processed}"`);
    console.log(`  変更: ${debugInfo.hasChanges ? 'あり' : 'なし'}`);
    console.log(`  削除文字数: ${debugInfo.removedCharacters}`);
    console.log('---');
  });
} 