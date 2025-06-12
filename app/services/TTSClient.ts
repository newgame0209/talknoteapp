import { getCurrentIdToken } from './auth';
import * as FileSystem from 'expo-file-system';
import { getApiBaseUrl } from '../config/env';

export interface TTSRequest {
  text: string;
  provider_name?: 'google' | 'minimax' | 'gemini';
  /**
   * @deprecated CanvasEditor からは provider_name を使用してください。
   * provider は後方互換用に残していますが、2025-08 には削除予定です。
   */
  provider?: 'google' | 'minimax' | 'gemini';
  voice_id?: string;
  speed?: number;
  audio_format?: 'mp3' | 'wav';
}

export interface TTSSentence {
  text: string;
  start_time: number;
  end_time: number;
}

export interface TTSResponse {
  audio_url: string;
  duration: number;
  sentences: TTSSentence[];
  provider: string;
  voice_name: string;
  processing_time: number;
}

export interface TTSVoice {
  id: string;
  name: string;
  provider: string;
  language: string;
  gender: string;
}

export interface TTSStatus {
  primary_provider: string;
  fallback_providers: string[];
  available_voices: TTSVoice[];
}

export class TTSClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // 優先順位: 明示引数 > EXPO_PUBLIC_API_URL(env経由 getApiBaseUrl) > デフォルトlocalhost
    const resolvedBase = baseUrl || getApiBaseUrl() || 'http://localhost:8000';
    this.baseUrl = resolvedBase.replace(/\/$/, ''); // 末尾スラッシュを除去して一貫性保持
    console.log('🎤 TTSClient初期化:', { baseUrl: this.baseUrl });
  }

  /**
   * テキストを音声に変換
   * @param request TTS変換リクエスト
   * @returns TTS変換結果
   */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    try {
      const token = await getCurrentIdToken();
      
      console.log('🎤 TTS API(JSON)呼び出し開始:', {
        baseUrl: this.baseUrl,
        textLength: request.text.length,
        provider: request.provider || 'elevenlabs'
      });
      
      // --- リクエストボディ整形 -----------------------------
      const providerName = (request.provider_name || request.provider) ?? undefined;

      const { provider, provider_name, ...rest } = request;

      const reqBody: Record<string, any> = {
        ...rest,
        audio_format: request.audio_format || 'mp3',
      };

      if (providerName) {
        reqBody["provider_name"] = providerName;
      }

      const response = await fetch(`${this.baseUrl}/api/v1/tts/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(reqBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`TTS Synthesize API Error: ${response.status} - ${errorText}`);
      }

      let ttsResponse: TTSResponse = await response.json();

      if (!ttsResponse.audio_url) {
        throw new Error('Server did not return an audio_url.');
      }

      // 🎯 ホスト補正: サーバーが誤ったホスト(IP)で返す場合にbaseUrlを適用
      try {
        const base = this.baseUrl.replace(/\/$/, ''); // 末尾スラッシュ除去
        const urlObj = new URL(ttsResponse.audio_url);
        const baseObj = new URL(base);

        if (urlObj.host !== baseObj.host) {
          const corrected = `${base}${urlObj.pathname}`;
          console.log('⚠️ audio_urlホスト補正:', {
            original: ttsResponse.audio_url,
            corrected,
          });
          ttsResponse = { ...ttsResponse, audio_url: corrected };
        }
      } catch (urlFixError) {
        console.log('⚠️ audio_url補正処理失敗（無視可）:', urlFixError);
      }

      console.log('🎤 TTS合成レスポンス(JSON)詳細:', {
        audioUrl: ttsResponse.audio_url,
        duration: ttsResponse.duration,
        provider: ttsResponse.provider,
      });

      return ttsResponse;
      
    } catch (error) {
      console.error('🚨 TTS合成エラー:', error);
      throw error;
    }
  }

  /**
   * テキストから文章タイムスタンプを生成（簡易版）
   */
  private generateSentenceTimestamps(text: string): TTSSentence[] {
    const sentences = text.split(/[。！？]/).filter(s => s.trim().length > 0);
    const avgDurationPerChar = 0.15; // 1文字あたり約0.15秒
    
    let currentTime = 0;
    return sentences.map((sentence, index) => {
      const duration = sentence.length * avgDurationPerChar;
      const result: TTSSentence = {
        text: sentence + (index < sentences.length - 1 ? '。' : ''),
        start_time: currentTime,
        end_time: currentTime + duration,
      };
      currentTime += duration;
      return result;
    });
  }

  /**
   * テキストから音声の長さを推定
   */
  private estimateAudioDuration(text: string): number {
    // 日本語の平均読み上げ速度: 約400文字/分 = 6.67文字/秒 = 0.15秒/文字
    return text.length * 0.15;
  }

  /**
   * TTSシステムの状態を取得
   * @returns TTSシステムの状態
   */
  async getStatus(): Promise<TTSStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/tts/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`TTS Status API Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log('TTS状態取得成功:', {
        primary_provider: data.primary_provider,
        fallback_providers: data.fallback_providers,
        voice_count: data.available_voices?.length || 0,
      });

      return data;
    } catch (error) {
      console.error('TTS状態取得エラー:', error);
      throw error;
    }
  }

  /**
   * 利用可能な音声一覧を取得
   * @returns 音声一覧
   */
  async getVoices(): Promise<TTSVoice[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/tts/voices`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`TTS Voices API Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      // プロバイダー一覧を取得（重複除去）
      const providerSet = new Set<string>();
      data.forEach((v: TTSVoice) => providerSet.add(v.provider));
      const providers = Array.from(providerSet);

      console.log('TTS音声一覧取得成功:', {
        voice_count: data.length,
        providers: providers,
      });

      return data;
    } catch (error) {
      console.error('TTS音声一覧取得エラー:', error);
      throw error;
    }
  }

  /**
   * 特定プロバイダーの音声一覧を取得
   * @param provider プロバイダー名
   * @returns 音声一覧
   */
  async getVoicesByProvider(provider: string): Promise<TTSVoice[]> {
    const allVoices = await this.getVoices();
    return allVoices.filter(voice => voice.provider === provider);
  }

  /**
   * デフォルト音声IDを取得
   * @param provider プロバイダー名（省略時は現在のプライマリプロバイダー）
   * @returns デフォルト音声ID
   */
  async getDefaultVoiceId(provider?: string): Promise<string> {
    if (!provider) {
      const status = await this.getStatus();
      provider = status.primary_provider;
    }

    const voices = await this.getVoicesByProvider(provider);
    
    if (voices.length === 0) {
      throw new Error(`No voices available for provider: ${provider}`);
    }

    // 女性音声を優先、なければ最初の音声
    const femaleVoice = voices.find(voice => voice.gender === 'female');
    return femaleVoice ? femaleVoice.id : voices[0].id;
  }
}

// シングルトンインスタンス
export const ttsClient = new TTSClient(); 