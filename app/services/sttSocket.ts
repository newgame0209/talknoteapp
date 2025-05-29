// app/services/sttSocket.ts

// WebSocketの設定
const WS_BASE_URL = __DEV__ 
  ? 'ws://192.168.0.46:8002'  // 開発環境（実機用IPアドレス）
  : 'wss://api.talknote.app';  // 本番環境

// WebSocketの状態を表す型
type WebSocketState = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';

// STTの結果を表す型
export interface STTResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
  language?: string;
}

// STTSocketのイベントハンドラ型
type OnOpenCallback = () => void;
type OnMessageCallback = (data: STTResult) => void;
type OnErrorCallback = (error: Error) => void;
type OnCloseCallback = (code: number, reason: string) => void;

// 初期設定の型
interface STTConfig {
  sample_rate_hertz: number;
  language_code: string;
  enable_automatic_punctuation: boolean;
  interim_results: boolean;
}

export class STTSocket {
  private ws: WebSocket | null = null;
  private state: WebSocketState = 'CLOSED';
  private url: string;
  private token: string | null;
  private initialConfig: STTConfig;

  // Callbacks
  private onOpenCallback?: OnOpenCallback;
  private onMessageCallback?: OnMessageCallback;
  private onErrorCallback?: OnErrorCallback;
  private onCloseCallback?: OnCloseCallback;

  constructor(
    url: string,
    token: string | null,
    initialConfig: STTConfig,
    onOpen?: OnOpenCallback,
    onMessage?: OnMessageCallback,
    onError?: OnErrorCallback,
    onClose?: OnCloseCallback,
  ) {
    this.url = url;
    this.token = token;
    this.initialConfig = initialConfig;
    this.onOpenCallback = onOpen;
    this.onMessageCallback = onMessage;
    this.onErrorCallback = onError;
    this.onCloseCallback = onClose;
  }

  private get urlWithToken(): string {
    return this.token ? `${this.url}?token=${this.token}` : this.url;
  }

  public connect(): void {
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED && this.ws.readyState !== WebSocket.CLOSING) {
      console.warn('[STTSocket] WebSocket is already connected or connecting/closing.');
      return;
    }

    console.log('[STTSocket] STTサーバーへの接続を開始します URL:', this.urlWithToken);
    this.state = 'CONNECTING';
    try {
      this.ws = new WebSocket(this.urlWithToken);
    } catch (error) {
      console.error('[STTSocket] WebSocket constructor failed:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error instanceof Error ? error : new Error('WebSocket instantiation failed'));
      }
      this.state = 'CLOSED';
      return;
    }

    this.ws.onopen = () => {
      this.state = 'OPEN';
      console.log('[STTSocket] WebSocket接続成功');
      if (this.onOpenCallback) {
        this.onOpenCallback();
      }
      // 接続成功後、初期設定JSONを送信
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.initialConfig) {
        try {
          this.ws.send(JSON.stringify(this.initialConfig));
          console.log('[STTSocket] 初期設定 JSON を送信しました', this.initialConfig);
        } catch (error) {
          console.error('[STTSocket] Failed to send initial config:', error);
          if (this.onErrorCallback) {
            this.onErrorCallback(error instanceof Error ? error : new Error('Failed to send initial config'));
          }
        }
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        console.log('[STTSocket] Raw event.data:', event.data); // For debugging
        const rawData = JSON.parse(String(event.data));
        console.log('[STTSocket] Parsed data (object):', rawData); // For debugging
        
        // サーバーからのデータをSTTResult型に変換
        const parsedData: STTResult = {
          text: rawData.text || '',
          isFinal: rawData.is_final || false,
          confidence: rawData.confidence,
          language: rawData.language_code || 'ja-JP'
        };
        
        console.log('[STTSocket] Converted data:', parsedData); // For debugging
        if (this.onMessageCallback) {
          this.onMessageCallback(parsedData);
        }
      } catch (error) {
        console.error('[STTSocket] WebSocketメッセージ処理エラー:', error, '受信データ:', event.data);
        if (this.onErrorCallback) {
          this.onErrorCallback(error instanceof Error ? error : new Error('Error processing message'));
        }
      }
    };

    this.ws.onerror = (event: Event) => {
      // The Event object itself is often not very informative for WebSocket errors.
      // The browser console usually logs more detailed information.
      console.error('[STTSocket] WebSocketエラーが発生しました。詳細はブラウザコンソールを確認してください。', event);
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error('WebSocket error occurred. See browser console for details.'));
      }
      // Ensure state is updated and ws is cleaned up if error leads to closure
      if (this.ws && (this.ws.readyState === WebSocket.CLOSING || this.ws.readyState === WebSocket.CLOSED)) {
        this.state = 'CLOSED';
        this.ws = null;
      } else {
        // If error doesn't close, state might remain OPEN or CONNECTING, which might be an issue
        // Consider explicitly closing if an error occurs and it's not already closing
         this.closeConnection(1011, 'WebSocket error'); // 1011: Internal Error
      }
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.state = 'CLOSED';
      console.log(`[STTSocket] WebSocketがコード ${event.code} で閉じました、理由: ${event.reason || 'N/A'}`);
      if (this.onCloseCallback) {
        this.onCloseCallback(event.code, event.reason || '');
      }
      this.ws = null; // Clean up WebSocket instance
    };
  }

  public sendAudioData(data: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        console.log('[STTSocket] 送信するオーディオデータサイズ:', data.byteLength, 'バイト');
        this.ws.send(data);
      } catch (error) {
        console.error('[STTSocket] Failed to send audio data:', error);
        if (this.onErrorCallback) {
          this.onErrorCallback(error instanceof Error ? error : new Error('Failed to send audio data'));
        }
      }
    } else {
      console.warn('[STTSocket] WebSocket is not open. Cannot send audio data. State:', this.getReadyState());
    }
  }

  public sendEndOfStream(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        console.log('[STTSocket] EndOfStreamシグナルを送信します');
        this.ws.send(JSON.stringify({ event: 'EOS' })); // Server should expect this format
      } catch (error) {
        console.error('[STTSocket] Failed to send EndOfStream:', error);
        if (this.onErrorCallback) {
          this.onErrorCallback(error instanceof Error ? error : new Error('Failed to send EndOfStream'));
        }
      }
    } else {
      console.warn('[STTSocket] WebSocket is not open. Cannot send EndOfStream. State:', this.getReadyState());
    }
  }

  public closeConnection(code: number = 1000, reason: string = 'Normal closure'): void {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        console.log(`[STTSocket] WebSocket接続を閉じます (コード: ${code}, 理由: ${reason})`);
        this.state = 'CLOSING';
        this.ws.close(code, reason);
      } else {
        console.warn('[STTSocket] WebSocket is not in a state that can be closed (e.g. already closed or closing). State:', this.getReadyState());
      }
    } else {
        console.warn('[STTSocket] No WebSocket instance to close.');
    }
  }

  public getReadyState(): WebSocketState {
    if (!this.ws) return 'CLOSED';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'CLOSED'; // Should not happen
    }
  }
}