/**
 * 文章を句点「。」で分割するユーティリティ
 */

export interface SplitSentence {
  text: string;
  index: number;
  startPosition: number;
  endPosition: number;
}

/**
 * テキストを句点「。」で文章に分割
 * @param text 分割対象のテキスト
 * @returns 分割された文章の配列
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // 句点「。」で分割
  const sentences = text.split('。')
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0)
    .map(sentence => sentence + '。'); // 句点を再追加

  // 最後の文章が「。」で終わっていない場合は句点を除去
  if (sentences.length > 0) {
    const lastSentence = sentences[sentences.length - 1];
    if (!text.trim().endsWith('。')) {
      sentences[sentences.length - 1] = lastSentence.slice(0, -1);
    }
  }

  return sentences;
}

/**
 * テキストを句点「。」で文章に分割（詳細情報付き）
 * @param text 分割対象のテキスト
 * @returns 分割された文章の詳細情報配列
 */
export function splitIntoSentencesWithDetails(text: string): SplitSentence[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const sentences: SplitSentence[] = [];
  let currentPosition = 0;
  let sentenceIndex = 0;

  // 句点「。」の位置を検索
  const periodPositions: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '。') {
      periodPositions.push(i);
    }
  }

  let startPosition = 0;

  for (const periodPosition of periodPositions) {
    const sentenceText = text.substring(startPosition, periodPosition + 1).trim();
    
    if (sentenceText.length > 0) {
      sentences.push({
        text: sentenceText,
        index: sentenceIndex,
        startPosition: startPosition,
        endPosition: periodPosition + 1,
      });
      sentenceIndex++;
    }
    
    startPosition = periodPosition + 1;
  }

  // 最後の文章（句点で終わっていない場合）
  if (startPosition < text.length) {
    const remainingText = text.substring(startPosition).trim();
    if (remainingText.length > 0) {
      sentences.push({
        text: remainingText,
        index: sentenceIndex,
        startPosition: startPosition,
        endPosition: text.length,
      });
    }
  }

  return sentences;
}

/**
 * 文章配列を元のテキストに結合
 * @param sentences 文章配列
 * @returns 結合されたテキスト
 */
export function joinSentences(sentences: string[]): string {
  return sentences.join('');
}

/**
 * 文章の文字数を計算
 * @param sentences 文章配列
 * @returns 総文字数
 */
export function countCharacters(sentences: string[]): number {
  return sentences.reduce((total, sentence) => total + sentence.length, 0);
}

/**
 * 指定した文字数以下になるように文章を分割
 * @param text 分割対象のテキスト
 * @param maxLength 最大文字数
 * @returns 分割されたテキスト配列
 */
export function splitByLength(text: string, maxLength: number): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  if (text.length <= maxLength) {
    return [text];
  }

  const sentences = splitIntoSentences(text);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    // 1つの文章が最大文字数を超える場合
    if (sentence.length > maxLength) {
      // 現在のチャンクを保存
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // 長い文章を強制的に分割
      for (let i = 0; i < sentence.length; i += maxLength) {
        chunks.push(sentence.substring(i, i + maxLength));
      }
    } else {
      // 現在のチャンクに追加できるかチェック
      if (currentChunk.length + sentence.length <= maxLength) {
        currentChunk += sentence;
      } else {
        // 現在のチャンクを保存して新しいチャンクを開始
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }
        currentChunk = sentence;
      }
    }
  }

  // 最後のチャンクを保存
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * テキストの統計情報を取得
 * @param text 対象テキスト
 * @returns 統計情報
 */
export function getTextStats(text: string): {
  totalCharacters: number;
  totalSentences: number;
  averageSentenceLength: number;
  sentences: string[];
} {
  const sentences = splitIntoSentences(text);
  const totalCharacters = text.length;
  const totalSentences = sentences.length;
  const averageSentenceLength = totalSentences > 0 ? totalCharacters / totalSentences : 0;

  return {
    totalCharacters,
    totalSentences,
    averageSentenceLength: Math.round(averageSentenceLength * 100) / 100,
    sentences,
  };
} 