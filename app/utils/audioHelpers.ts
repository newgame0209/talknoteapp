import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

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

  /**
   * 録音を開始
   * @returns 録音オブジェクト
   */
  async startRecording(): Promise<void> {
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
   * Base64をバイナリに変換
   * @param base64 Base64文字列
   * @returns バイナリデータ
   */
  private base64ToBinary(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
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
}

// 音声再生ヘルパークラス
export class AudioPlayer {
  private sound: Audio.Sound | null = null;
  private isPlaying: boolean = false;
  private duration: number = 0;
  private position: number = 0;

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
      await this.sound.setPositionAsync(seconds * 1000);
      this.position = seconds;
      console.log('再生位置設定:', seconds);
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
