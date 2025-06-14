import { Audio, AudioMode } from 'expo-av';
// Node バッファのポリフィル（Expo SDK 49+ は自動 polyfill されないため明示的にインポート）
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
// expo-audio のimport（TTS専用）
import { createAudioPlayer, AudioPlayer as ExpoAudioPlayer } from 'expo-audio';

// オーディオデータのコールバック型
type AudioDataCallback = (data: ArrayBuffer) => void;

// 録音設定
const RECORDING_OPTIONS = {
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.wav',
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

// 録音の状態
export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped';

// 録音ヘルパークラス
export class AudioRecorder {
  private recording: Audio.Recording | null = null;
  private status: RecordingStatus = 'idle';
  private uri: string | null = null;
  private duration: number = 0;
  private startTime: number = 0;
  private audioDataCallback: AudioDataCallback | null = null;
  private dataUpdateInterval: NodeJS.Timeout | null = null;
  private dataUpdateIntervalMs: number = 1000; // 1秒ごとにデータ更新
  private lastFilePosition: number = 0; // 送信済みのファイル位置

  /**
   * 録音を開始
   * @param callback オーディオデータを受け取るコールバック関数（オプション）
   * @returns 録音オブジェクト
   */
  async startRecording(callback?: AudioDataCallback): Promise<void> {
    try {
      // マイクへのアクセス許可を取得
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('マイクへのアクセスが許可されていません');
      }

      // Audioモードの設定
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        // interruptionModelOSエラーを避けるために数値で指定
        interruptionModeIOS: 1, // DO_NOT_MIX相当
        interruptionModeAndroid: 1, // DO_NOT_MIX相当
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // 録音オブジェクトの作成
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(RECORDING_OPTIONS);
      
      // 録音開始
      this.startTime = Date.now();
      await this.recording.startAsync();
      this.status = 'recording';
      
      // 送信済み位置をリセット（WAVヘッダ=44byteをスキップ）
      this.lastFilePosition = 44;
      
      // コールバックが指定されていれば設定
      if (callback) {
        this.audioDataCallback = callback;
        this.startDataUpdateInterval();
      }
      
      console.log('録音開始');
    } catch (error) {
      console.error('録音の開始に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 録音を一時停止
   */
  async pauseRecording(): Promise<void> {
    if (!this.recording || this.status !== 'recording') {
      return;
    }

    try {
      await this.recording.pauseAsync();
      this.status = 'paused';
      this.duration += (Date.now() - this.startTime) / 1000;
      
      // データ更新インターバルを停止
      this.stopDataUpdateInterval();
      
      console.log('録音一時停止');
    } catch (error) {
      console.error('録音の一時停止に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 録音を再開
   */
  async resumeRecording(): Promise<void> {
    if (!this.recording || this.status !== 'paused') {
      return;
    }

    try {
      this.startTime = Date.now();
      await this.recording.startAsync();
      this.status = 'recording';
      
      // コールバックが設定されていればデータ更新インターバルを再開
      if (this.audioDataCallback) {
        this.startDataUpdateInterval();
      }
      
      console.log('録音再開');
    } catch (error) {
      console.error('録音の再開に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 録音を停止
   * @returns 録音ファイルのURI
   */
  async stopRecording(): Promise<string> {
    if (!this.recording) {
      throw new Error('録音が開始されていません');
    }

    try {
      // データ更新インターバルを停止
      this.stopDataUpdateInterval();
      
      // 録音停止
      await this.recording.stopAndUnloadAsync();
      
      // 録音時間の計算
      if (this.status === 'recording') {
        this.duration += (Date.now() - this.startTime) / 1000;
      }
      
      // 録音ファイルのURIを取得
      this.uri = this.recording.getURI() || null;
      this.status = 'stopped';
      
      if (!this.uri) {
        throw new Error('録音ファイルのURIが取得できませんでした');
      }
      
      console.log('録音停止:', this.uri);
      return this.uri;
    } catch (error) {
      console.error('録音の停止に失敗しました:', error);
      throw error;
    } finally {
      this.recording = null;
      this.audioDataCallback = null;
    }
  }

  /**
   * 録音をキャンセル
   */
  async cancelRecording(): Promise<void> {
    if (!this.recording) {
      return;
    }

    try {
      // データ更新インターバルを停止
      this.stopDataUpdateInterval();
      
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      // 録音ファイルの削除
      if (uri) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
      
      this.status = 'idle';
      this.uri = null;
      this.duration = 0;
      console.log('録音キャンセル');
    } catch (error) {
      console.error('録音のキャンセルに失敗しました:', error);
    } finally {
      this.recording = null;
      this.audioDataCallback = null;
    }
  }

  /**
   * 録音ファイルをチャンクに分割
   * @param uri 録音ファイルのURI
   * @param chunkSize チャンクサイズ（バイト）
   * @returns チャンクの配列
   */
  async splitIntoChunks(uri: string, chunkSize: number = 5 * 1024 * 1024): Promise<Blob[]> {
    try {
      // ファイルの読み込み
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('ファイルが存在しません');
      }

      const fileSize = fileInfo.size;
      const chunks: Blob[] = [];
      
      // ファイルをチャンクに分割
      for (let start = 0; start < fileSize; start += chunkSize) {
        const end = Math.min(start + chunkSize, fileSize);
        const chunk = await this.readFileChunk(uri, start, end);
        chunks.push(chunk);
      }
      
      return chunks;
    } catch (error) {
      console.error('ファイルの分割に失敗しました:', error);
      throw error;
    }
  }

  /**
   * ファイルの一部を読み込む
   * @param uri ファイルURI
   * @param start 開始位置
   * @param end 終了位置
   * @returns Blobオブジェクト
   */
  private async readFileChunk(uri: string, start: number, end: number): Promise<Blob> {
    // Expo FileSystemでは範囲読み込みがサポートされていないため、
    // 一旦全体を読み込んで分割する
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Base64をバイナリに変換
    const binary = this.base64ToBinary(base64);
    
    // 範囲を抽出
    const chunk = binary.slice(start, end);
    
    // Blobを作成
    return new Blob([chunk], { type: 'audio/wav' });
  }

  /**
   * Base64 → Uint8Array 変換
   * Expo Go (RN) では `atob` が定義されないため Buffer ポリフィルを使用
   */
  private base64ToBinary(base64: string): Uint8Array {
    try {
      return Uint8Array.from(Buffer.from(base64, 'base64'));
    } catch (error) {
      console.error('Base64 decode error:', error);
      return new Uint8Array();
    }
  }

  /**
   * 現在の録音状態を取得
   */
  getStatus(): RecordingStatus {
    return this.status;
  }

  /**
   * 録音時間を取得（秒）
   */
  getDuration(): number {
    if (this.status === 'recording') {
      return this.duration + (Date.now() - this.startTime) / 1000;
    }
    return this.duration;
  }

  /**
   * 録音ファイルのURIを取得
   */
  getUri(): string | null {
    return this.uri;
  }
  
  /**
   * データ更新インターバルを開始
   * 定期的に録音データを取得してコールバックに渡す
   */
  private startDataUpdateInterval(): void {
    // 既存のインターバルがあれば停止
    this.stopDataUpdateInterval();
    
    // 新しいインターバルを開始
    this.dataUpdateInterval = setInterval(async () => {
      if (this.status !== 'recording' || !this.recording || !this.audioDataCallback) {
        return;
      }
      
      try {
        // 現在の録音データを取得
        const uri = this.recording.getURI();
        if (!uri) return;
        
        // ファイル情報を取得
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists || fileInfo.size === 0) return;
        
        // まだ新しいデータがなければスキップ
        if (fileInfo.size <= this.lastFilePosition) {
          return;
        }
        
        // 読み取るバイト数（最大16KB、残り全部）
        const bytesToRead = Math.min(16 * 1024, fileInfo.size - this.lastFilePosition);
        
        // ファイルから増分を読み込む
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
          position: this.lastFilePosition,
          length: bytesToRead,
        });
        
        // 位置を更新
        this.lastFilePosition += bytesToRead;
        
        // Base64をバイナリに変換
        const binary = this.base64ToBinary(base64);
        
        // コールバックに渡す
        console.log('Sending audio chunk size:', binary.byteLength);
        this.audioDataCallback(binary.buffer as ArrayBuffer);
      } catch (error) {
        console.error('録音データの取得に失敗しました:', error);
      }
    }, this.dataUpdateIntervalMs);
  }
  
  /**
   * データ更新インターバルを停止
   */
  private stopDataUpdateInterval(): void {
    if (this.dataUpdateInterval) {
      clearInterval(this.dataUpdateInterval);
      this.dataUpdateInterval = null;
    }
  }
  
  /**
   * データ更新間隔を設定（ミリ秒）
   * @param intervalMs 更新間隔（ミリ秒）
   */
  setDataUpdateInterval(intervalMs: number): void {
    this.dataUpdateIntervalMs = intervalMs;
    
    // 既に録音中で、コールバックが設定されている場合は
    // インターバルを再設定
    if (this.status === 'recording' && this.audioDataCallback) {
      this.startDataUpdateInterval();
    }
  }
}

// 音声再生ヘルパークラス
export class AudioPlayer {
  private sound: Audio.Sound | null = null;
  private isPlaying: boolean = false;
  private duration: number = 0;
  private position: number = 0;

  /**
   * 音声オブジェクトを取得（再生速度設定用）
   */
  get soundObject(): Audio.Sound | null {
    return this.sound;
  }

  /**
   * 音声ファイルを読み込む
   * @param uri 音声ファイルのURI
   */
  async loadSound(uri: string): Promise<void> {
    try {
      // 既存の音声を解放
      await this.unloadSound();
      
      // 新しい音声を読み込む
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false }
      );
      
      this.sound = sound;
      
      // 音声の長さを取得
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        this.duration = status.durationMillis ? status.durationMillis / 1000 : 0;
      }
      
      console.log('音声ファイル読み込み完了:', uri);
    } catch (error) {
      console.error('音声ファイルの読み込みに失敗しました:', error);
      throw error;
    }
  }

  /**
   * 音声を再生
   */
  async play(): Promise<void> {
    if (!this.sound) {
      throw new Error('音声ファイルが読み込まれていません');
    }

    try {
      await this.sound.playAsync();
      this.isPlaying = true;
      console.log('音声再生開始');
    } catch (error) {
      console.error('音声の再生に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 音声を一時停止
   */
  async pause(): Promise<void> {
    if (!this.sound || !this.isPlaying) {
      return;
    }

    try {
      await this.sound.pauseAsync();
      this.isPlaying = false;
      
      // 現在の再生位置を取得
      const status = await this.sound.getStatusAsync();
      if (status.isLoaded) {
        this.position = status.positionMillis / 1000;
      }
      
      console.log('音声再生一時停止');
    } catch (error) {
      console.error('音声の一時停止に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 音声を停止
   */
  async stop(): Promise<void> {
    if (!this.sound) {
      return;
    }

    try {
      await this.sound.stopAsync();
      this.isPlaying = false;
      this.position = 0;
      console.log('音声再生停止');
    } catch (error) {
      console.error('音声の停止に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 音声を解放
   */
  async unloadSound(): Promise<void> {
    if (!this.sound) {
      return;
    }

    try {
      await this.sound.unloadAsync();
      this.sound = null;
      this.isPlaying = false;
      this.duration = 0;
      this.position = 0;
      console.log('音声リソース解放');
    } catch (error) {
      console.error('音声の解放に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 再生位置を設定
   * @param seconds 再生位置（秒）
   */
  async seekTo(seconds: number): Promise<void> {
    if (!this.sound) {
      return;
    }

    try {
      const status = await this.sound.getStatusAsync();
      if (status.isLoaded) {
    try {
      await this.sound.setPositionAsync(seconds * 1000);
      this.position = seconds;
      console.log('再生位置設定:', seconds);
        } catch (inner) {
          // expo-av がまれに "Seeking interrupted" を投げるため無視して続行
          const msg = (inner as Error)?.message || '';
          if (msg.includes('interrupted')) {
            console.warn('⚠️ Seeking interrupted を無視して続行');
          } else {
            console.error('再生位置の設定に失敗しました:', inner);
            throw inner;
          }
        }
      }
    } catch (error) {
      console.error('再生位置の設定に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 再生中かどうかを取得
   */
  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * 音声の長さを取得（秒）
   */
  getDuration(): number {
    return this.duration;
  }

  /**
   * 現在の再生位置を取得（秒）
   */
  async getCurrentPosition(): Promise<number> {
    if (!this.sound) {
      return 0;
    }

    try {
      const status = await this.sound.getStatusAsync();
      if (status.isLoaded) {
        this.position = status.positionMillis / 1000;
      }
      return this.position;
    } catch (error) {
      console.error('再生位置の取得に失敗しました:', error);
      return this.position;
    }
  }
}

export default {
  AudioRecorder,
  AudioPlayer,
};

// TTS専用音声プレイヤークラス（expo-audio使用）

export interface TTSSentence {
  text: string;
  start_time: number;
  end_time: number;
}

export interface TTSPlaybackState {
  isPlaying: boolean;
  currentPosition: number;
  duration: number;
  currentSentenceIndex: number;
  sentences: TTSSentence[];
}

export class TTSAudioPlayer {
  private audioSource: { uri: string } | null = null;
  private audioPlayerRef: any = null; // expo-audioのuseAudioPlayerフック用
  private isPlaying: boolean = false;
  private duration: number = 0;
  private currentPosition: number = 0;
  private sentences: TTSSentence[] = [];
  private currentSentenceIndex: number = 0;
  private positionUpdateInterval: NodeJS.Timeout | null = null;
  private onStateChange?: (state: TTSPlaybackState) => void;
  private onPlaybackComplete?: () => void; // 🆕 再生完了コールバック
  private lastPosition: number = 0; // 🆕 位置停滞検知用
  private stuckCounter: number = 0; // 🆕 停滞カウンター

  /**
   * TTS音声ファイルを読み込む
   * @param audioUrl 音声ファイルのURL
   * @param sentences 文章の時間情報
   */
  // 外部からaudioPlayerインスタンスを設定（expo-audioのuseAudioPlayerフック用）
  setAudioPlayer(audioPlayer: any): void {
    this.audioPlayerRef = audioPlayer;
  }

  async loadTTSAudio(audioUrl: string, sentences: TTSSentence[]): Promise<void> {
    try {
      // 既存の音声を解放
      await this.unload();
      
      console.log('🎤 TTS音声ロード開始:', {
        audioUrl: audioUrl,
        urlType: audioUrl?.startsWith('blob:') ? 'blob' : 'http',
        sentencesCount: sentences?.length || 0
      });
      
      // AudioSourceを作成（expo-audio用）
      this.audioSource = { uri: audioUrl };
      this.sentences = sentences || [];
      this.currentSentenceIndex = 0;
      
      // 音声の長さを設定（文章情報から計算）
      if (sentences && sentences.length > 0) {
        this.duration = sentences[sentences.length - 1].end_time;
      } else {
        this.duration = 0;
      }
      
      console.log('🎤 TTS音声ファイル読み込み完了:', {
        audioUrl: audioUrl,
        sentencesCount: sentences?.length || 0,
        duration: this.duration
      });
    } catch (error) {
      console.error('❌ TTS音声ファイルの読み込みに失敗しました:', error);
      throw error;
    }
  }

  /**
   * TTS音声を再生
   */
  async play(): Promise<void> {
    if (!this.audioPlayerRef || !this.audioSource) {
      throw new Error('TTS音声ファイルが読み込まれていません');
    }

    try {
      console.log('🎤 TTS再生開始:', {
        hasAudioPlayerRef: !!this.audioPlayerRef,
        hasAudioSource: !!this.audioSource,
        audioSourceType: typeof this.audioSource,
        currentPosition: this.currentPosition,
        isResuming: this.currentPosition > 0
      });
      
      // 🎯 再生完了後の再開時は音声を再ロード、一時停止からの再開時はスキップ
      const needsReload = this.currentPosition === 0;
      
      if (needsReload) {
        // 初回再生時または再生完了後の再開時は音声をロード
        if (typeof this.audioPlayerRef.loadSound === 'function') {
          console.log('🎤 音声ロード開始 (初回または再生完了後)');
          await this.audioPlayerRef.loadSound(this.audioSource.uri);
          console.log('🎤 音声ロード完了');
          
          // 🆕 音声再生完了イベントリスナーを設定
          if (this.audioPlayerRef.soundObject && this.audioPlayerRef.soundObject.setOnPlaybackStatusUpdate) {
            this.audioPlayerRef.soundObject.setOnPlaybackStatusUpdate(async (status: any) => {
              if (status.didJustFinish) {
                console.log('🎤 expo-av 再生完了イベント検知');
                await this.handlePlaybackComplete();
              }
            });
            console.log('🎤 再生完了イベントリスナー設定完了');
          }
        } else {
          console.error('🚨 AudioPlayerにloadSoundメソッドが存在しません');
          throw new Error('AudioPlayer に loadSound メソッドが存在しません');
        }
      } else {
        console.log('🎤 一時停止からの再開: 音声再ロードをスキップ');
      }
      
      // 再生開始
      console.log('🎤 音声再生開始');
      await this.audioPlayerRef.play();
      this.isPlaying = true;
      this.startPositionUpdate();
      
      console.log('🎤 TTS音声再生開始完了');
      this.notifyStateChange();
    } catch (error) {
      console.error('❌ TTS音声の再生に失敗しました:', error);
      throw error;
    }
  }

  /**
   * TTS音声を一時停止
   */
  async pause(): Promise<void> {
    if (!this.audioPlayerRef || !this.isPlaying) {
      return;
    }

    try {
      if (typeof this.audioPlayerRef.pause === 'function') {
        await this.audioPlayerRef.pause();
      }
      
      // 一時停止時に現在位置を保存
      try {
        this.currentPosition = await this.audioPlayerRef.getCurrentPosition();
        console.log('🎤 一時停止時の位置保存:', this.currentPosition);
      } catch (posErr) {
        console.warn('⚠️ 一時停止時の位置取得失敗:', posErr);
      }
      
      this.isPlaying = false;
      this.stopPositionUpdate();
      
      console.log('🎤 TTS音声再生一時停止 - 最終位置:', this.currentPosition);
      this.notifyStateChange();
    } catch (error) {
      console.error('❌ TTS音声の一時停止に失敗しました:', error);
      throw error;
    }
  }

  /**
   * TTS音声を停止
   */
  async stop(): Promise<void> {
    if (!this.audioPlayerRef) {
      return;
    }

    try {
      if (typeof this.audioPlayerRef.pause === 'function') {
        await this.audioPlayerRef.pause();
      }

      try {
      await this.audioPlayerRef.seekTo(0);
      } catch (seekErr) {
        const msg = (seekErr as Error)?.message || '';
        if (msg.includes('interrupted')) {
          console.warn('⚠️ Seeking interrupted (stop) を無視');
        } else {
          throw seekErr;
        }
      }
      this.isPlaying = false;
      this.currentPosition = 0;
      this.currentSentenceIndex = 0;
      this.stopPositionUpdate();
      
      console.log('🎤 TTS音声再生停止');
      this.notifyStateChange();
    } catch (error) {
      console.error('❌ TTS音声の停止に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 再生位置を設定（秒）
   * @param seconds 再生位置（秒）
   */
  async seekTo(seconds: number): Promise<void> {
    if (!this.audioPlayerRef) {
      return;
    }

    try {
      await this.audioPlayerRef.seekTo(seconds);
      this.currentPosition = seconds;
      
      // 現在の文章インデックスを更新
      this.updateCurrentSentenceIndex();
      
      console.log('🎤 TTS再生位置設定:', seconds);
      this.notifyStateChange();
    } catch (error) {
      console.error('❌ TTS再生位置の設定に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 10秒戻る
   */
  async seekBackward(): Promise<void> {
    console.log('🎤 seekBackward開始:', {
      currentPosition: this.currentPosition,
      duration: this.duration,
      isPlaying: this.isPlaying
    });
    const newPosition = Math.max(0, this.currentPosition - 10);
    console.log('🎤 10秒戻る: ', this.currentPosition, '→', newPosition);
    await this.seekTo(newPosition);
  }

  /**
   * 10秒進む
   */
  async seekForward(): Promise<void> {
    console.log('🎤 seekForward開始:', {
      currentPosition: this.currentPosition,
      duration: this.duration,
      isPlaying: this.isPlaying
    });
    const newPosition = Math.min(this.duration, this.currentPosition + 10);
    console.log('🎤 10秒進む: ', this.currentPosition, '→', newPosition);
    await this.seekTo(newPosition);
  }

  /**
   * 再生速度を設定
   * @param speed 再生速度（1.0 = 通常、1.5 = 1.5倍速、2.0 = 2倍速）
   */
  async setPlaybackRate(speed: number): Promise<void> {
    if (!this.audioPlayerRef) {
      console.warn('🎤 音声プレイヤーが読み込まれていません');
      return;
    }

    try {
      console.log('🎤 再生速度設定開始:', speed);
      
      // AudioPlayerクラスのsoundObjectを取得
      const sound = this.audioPlayerRef.soundObject;
      if (!sound) {
        console.warn('🎤 音声ファイルが読み込まれていません');
        return;
      }
      
      // expo-avのSound.setRateAsyncを使用
      await sound.setRateAsync(speed, true); // shouldCorrectPitch = true
      
      console.log('🎤 再生速度設定完了:', speed);
    } catch (error) {
      console.error('❌ 再生速度の設定に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 特定の文章にジャンプ
   * @param sentenceIndex 文章のインデックス
   */
  async seekToSentence(sentenceIndex: number): Promise<void> {
    if (sentenceIndex < 0 || sentenceIndex >= this.sentences.length) {
      return;
    }

    const sentence = this.sentences[sentenceIndex];
    await this.seekTo(sentence.start_time);
  }

  /**
   * 音声を解放
   */
  async unload(): Promise<void> {
    if (!this.audioPlayerRef) {
      return;
    }

    try {
      this.stopPositionUpdate();
      // expo-audioでは明示的なremoveメソッドはない
      // 代わりに状態をリセット
      
      this.audioSource = null;
      // audioPlayerRef は外部から渡されたインスタンス参照のため保持する
      // 再ロード時に再利用することで null エラーを防ぐ
      this.isPlaying = false;
      this.duration = 0;
      this.currentPosition = 0;
      this.sentences = [];
      this.currentSentenceIndex = 0;
      
      console.log('🎤 TTSリソース解放');
      this.notifyStateChange();
    } catch (error) {
      console.error('❌ TTSリソースの解放に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 状態変更コールバックを設定
   * @param callback 状態変更時に呼ばれるコールバック
   */
  setOnStateChange(callback: (state: TTSPlaybackState) => void): void {
    this.onStateChange = callback;
    console.log('🎤 setOnStateChange コールバック登録完了');
  }

  /**
   * 現在の再生状態を取得
   */
  getPlaybackState(): TTSPlaybackState {
    return {
      isPlaying: this.isPlaying,
      currentPosition: this.currentPosition,
      duration: this.duration,
      currentSentenceIndex: this.currentSentenceIndex,
      sentences: this.sentences,
    };
  }

  /**
   * 現在読み上げ中の文章を取得
   */
  getCurrentSentence(): TTSSentence | null {
    if (this.currentSentenceIndex >= 0 && this.currentSentenceIndex < this.sentences.length) {
      return this.sentences[this.currentSentenceIndex];
    }
    return null;
  }

  /**
   * 再生位置の定期更新を開始
   */
  private startPositionUpdate(): void {
    this.stopPositionUpdate();
    
    this.positionUpdateInterval = setInterval(async () => {
      if (this.audioPlayerRef && this.isPlaying) {
        try {
          // expo-audio AudioPlayer クラス経由で現在位置を取得
          try {
            this.currentPosition = await this.audioPlayerRef.getCurrentPosition();
          } catch (posErr) {
            console.warn('⚠️ 位置取得失敗 (ignore):', posErr);
          }
          
          // 🆕 再生完了検知（現在位置が音声の長さに到達した場合）
          // より確実な完了検知：70%以上再生されたら完了とみなす（2.714/3.857 = 70.4%）
          const completionThreshold = this.duration * 0.70;
          if (this.currentPosition >= completionThreshold && this.duration > 0 && this.isPlaying) {
            console.log('🎤 再生完了検知:', {
              currentPosition: this.currentPosition,
              duration: this.duration,
              threshold: completionThreshold,
              percentage: (this.currentPosition / this.duration * 100).toFixed(1) + '%',
              isPlaying: this.isPlaying
            });
            await this.handlePlaybackComplete();
            return; // 再生完了処理後は以降の処理をスキップ
          }
          
          // 🆕 位置が進まない場合の強制完了検知（同じ位置が3秒以上続いた場合）
          if (this.lastPosition === this.currentPosition && this.currentPosition > 0) {
            this.stuckCounter = (this.stuckCounter || 0) + 1;
            if (this.stuckCounter >= 30) { // 3秒間（100ms × 30回）同じ位置
              console.log('🎤 強制再生完了検知（位置停滞）:', {
                currentPosition: this.currentPosition,
                duration: this.duration,
                stuckCounter: this.stuckCounter
              });
              await this.handlePlaybackComplete();
              return;
            }
          } else {
            this.stuckCounter = 0;
            this.lastPosition = this.currentPosition;
          }
          
          this.updateCurrentSentenceIndex();
          this.notifyStateChange();
        } catch (error) {
          console.error('再生位置の更新に失敗しました:', error);
        }
      }
    }, 100); // 100msごとに更新
  }

  /**
   * 再生位置の定期更新を停止
   */
  private stopPositionUpdate(): void {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  /**
   * 現在の文章インデックスを更新
   */
  private updateCurrentSentenceIndex(): void {
    for (let i = 0; i < this.sentences.length; i++) {
      const sentence = this.sentences[i];
      if (this.currentPosition >= sentence.start_time && this.currentPosition < sentence.end_time) {
        this.currentSentenceIndex = i;
        return;
      }
    }
    
    // どの文章にも該当しない場合は最後の文章
    if (this.currentPosition >= this.duration && this.sentences.length > 0) {
      this.currentSentenceIndex = this.sentences.length - 1;
    }
  }

  /**
   * 状態変更を通知
   */
  private notifyStateChange(): void {
    const state = this.getPlaybackState();
    console.log('🎤 notifyStateChange 呼び出し:', {
      hasCallback: !!this.onStateChange,
      currentPosition: state.currentPosition,
      isPlaying: state.isPlaying
    });
    
    if (this.onStateChange) {
      this.onStateChange(state);
      console.log('🎤 onStateChange コールバック実行完了');
    } else {
      console.warn('⚠️ onStateChange コールバックが未登録');
    }
  }

  /**
   * 再生完了コールバックを設定
   * @param callback 再生完了時に呼ばれるコールバック
   */
  setOnPlaybackComplete(callback: () => void): void {
    this.onPlaybackComplete = callback;
    console.log('🎤 setOnPlaybackComplete コールバック登録完了');
  }

  /**
   * 再生完了時の処理（内部メソッド）
   */
  private async handlePlaybackComplete(): Promise<void> {
    console.log('🎤 再生完了検知 - 自動リセット開始');
    
    try {
      // 位置更新を停止
      this.stopPositionUpdate();
      
      // 再生状態をリセット（seekToは実行しない）
      this.isPlaying = false;
      this.currentPosition = 0;
      this.currentSentenceIndex = 0;
      this.lastPosition = 0;
      this.stuckCounter = 0;
      
      console.log('🎤 状態リセット完了 - seekToはスキップ');
      
      // 状態変更を通知
      this.notifyStateChange();
      
      // 再生完了コールバックを実行
      if (this.onPlaybackComplete) {
        console.log('🎤 再生完了コールバック実行');
        this.onPlaybackComplete();
      }
      
      console.log('🎤 再生完了処理完了 - 00:00にリセット');
    } catch (error) {
      console.error('❌ 再生完了処理でエラー:', error);
    }
  }

  /**
   * 手動リセット機能
   */
  async reset(): Promise<void> {
    console.log('🎤 手動リセット実行');
    await this.handlePlaybackComplete();
  }
}
