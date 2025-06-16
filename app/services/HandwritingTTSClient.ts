import { getCurrentIdToken } from './auth';
import { getApiBaseUrl } from '../config/env';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';

export interface HandwritingTTSOptions {
  voiceId?: string; // Google TTSの voice_id
  speakingRate?: number; // 話速 0.25-4.0
}

export default class HandwritingTTSClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || getApiBaseUrl() || 'http://localhost:8000').replace(/\/$/, '');
  }

  /**
   * 🔧 フロントエンドでのRGBA→RGB変換は削除
   * バックエンドで確実にOpenCVによる変換を実行
   * React NativeにはCanvas APIが存在しないため
   */

  /**
   * 🔧 Base64形式でJSONリクエストを送信
   * FormDataの互換性問題を回避
   */

  /**
   * Base64 画像文字列から OCR→TTS を実行し、音声データ(blob) を返す
   * @param base64Image "data:image/png;base64,..." 形式
   */
  async synthesizeFromBase64(base64Image: string, options?: HandwritingTTSOptions): Promise<string> {
    try {
      // 🔧 Base64形式でJSONリクエストを送信（FormData問題を回避）
      console.log('🖼️ Sending Base64 image to backend for OCR processing...');

      const idToken = await getCurrentIdToken();

      // JSONリクエストボディを構築
      const requestBody = {
        image_data: base64Image,
        voice: options?.voiceId,
        speaking_rate: options?.speakingRate
      };

      console.log('🖊️ Sending handwriting image to TTS API (Base64)...');
      const response = await fetch(`${this.baseUrl}/api/v1/handwriting/tts-base64`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken || 'demo_token_for_development'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'unknown error');
        throw new Error(`Handwriting TTS API Error: ${response.status} - ${errText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log(`🎵 Received audio data: ${arrayBuffer.byteLength} bytes`);
      
      // MP3 をローカルファイルに保存
      const mp3Path = FileSystem.cacheDirectory + `hand_tts_${Date.now()}.mp3`;
      // ArrayBuffer → Base64 変換
      const buffer = Buffer.from(arrayBuffer);
      const base64Audio = buffer.toString('base64');
      await FileSystem.writeAsStringAsync(mp3Path, base64Audio, { encoding: FileSystem.EncodingType.Base64 });

      console.log('🎉 Handwriting TTS completed successfully');
      return mp3Path;
    } catch (error) {
      console.error('🚨 Handwriting TTS error:', error);
      throw error;
    }
  }
} 