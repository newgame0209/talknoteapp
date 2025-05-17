import { Platform } from 'react-native';

// WebSocketのベースURLを環境に応じて設定
const WS_BASE_URL = __DEV__
  ? Platform.OS === 'android'
    ? 'ws://10.0.2.2:8000/api/v1/stt/stream' // Android エミュレータ用
    : 'ws://localhost:8000/api/v1/stt/stream' // iOS シミュレータ用
  : 'wss://api.talknote.app/api/v1/stt/stream'; // 本番環境用

// WebSocketの状態を表す型
type WebSocketState = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';

// STTの結果を表す型
interface STTResult {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
  language?: string;
}

// STTSocketのイベントハンドラ
interface STTSocketHandlers {
  onOpen?: () => void;
  onMessage?: (result: STTResult) => void;
  onError?: (error: any) => void;
  onClose?: () => void;
}

/**
 * リアルタイム音声認識用WebSocketクラス
 */
export class STTSocket {
  private socket: WebSocket | null = null;
  private state: WebSocketState = 'CLOSED';
  private handlers: STTSocketHandlers = {};
  private idToken: string | null = null;

  /**
   * コンストラクタ
   * @param handlers イベントハンドラ
   */
  constructor(handlers: STTSocketHandlers = {}) {
    this.handlers = handlers;
  }

  /**
   * WebSocketの接続を開始
   * @param idToken Firebase認証トークン
   */
  connect(idToken: string): void {
    if (this.socket && (this.state === 'OPEN' || this.state === 'CONNECTING')) {
      console.warn('WebSocket is already connected or connecting');
      return;
    }

    this.idToken = idToken;
    this.socket = new WebSocket(`${WS_BASE_URL}?token=${idToken}`);
    this.state = 'CONNECTING';

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.state = 'OPEN';
      if (this.handlers.onOpen) this.handlers.onOpen();
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.handlers.onMessage) this.handlers.onMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (this.handlers.onError) this.handlers.onError(error);
    };

    this.socket.onclose = () => {
      console.log('WebSocket closed');
      this.state = 'CLOSED';
      this.socket = null;
      if (this.handlers.onClose) this.handlers.onClose();
    };
  }

  /**
   * 音声データをサーバーに送信
   * @param audioChunk 音声データのArrayBuffer
   */
  sendAudioChunk(audioChunk: ArrayBuffer): void {
    if (!this.socket || this.state !== 'OPEN') {
      console.warn('WebSocket is not connected');
      return;
    }

    this.socket.send(audioChunk);
  }

  /**
   * 録音終了を通知
   */
  sendEndOfStream(): void {
    if (!this.socket || this.state !== 'OPEN') {
      console.warn('WebSocket is not connected');
      return;
    }

    this.socket.send(JSON.stringify({ end: true }));
  }

  /**
   * WebSocketの接続を閉じる
   */
  disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.state = 'CLOSING';
    this.socket.close();
  }

  /**
   * WebSocketの状態を取得
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * イベントハンドラを設定
   * @param handlers イベントハンドラ
   */
  setHandlers(handlers: STTSocketHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }
}

export default STTSocket;
