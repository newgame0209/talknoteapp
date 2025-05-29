 LOG  [API] Base URL: http://192.168.0.46:8000/api/v1
 LOG  データベース初期化をスキップしています
 LOG  Recordings table created successfully
 LOG  Imports table created successfully
 LOG  Upload queue table created successfully
 LOG  Database initialized successfully
 LOG  [RecordScreen] 録音開始処理を開始
 LOG  [RecordScreen] マイク権限をリクエスト中...
 LOG  [RecordScreen] マイク権限ステータス: granted
 LOG  [RecordScreen] WebSocket接続を初期化中...
 LOG  [RecordScreen] STTSocket初期化開始
 LOG  [ENV] WebSocket URL: ws://192.168.0.46:8002/api/v1/stt/stream
 WARN  [RecordScreen] ユーザーが認証されていません。デモモードで続行します。
 LOG  [RecordScreen] 新しいSTTSocket接続を作成
 LOG  [RecordScreen] WebSocket接続を開始 (URL: ws://192.168.0.46:8002/api/v1/stt/stream, Token: あり)
 LOG  [STTSocket] STTサーバーへの接続を開始します URL: ws://192.168.0.46:8002/api/v1/stt/stream?token=demo_token_for_development
 LOG  [RecordScreen] 録音を開始中...
 LOG  録音開始
 LOG  [RecordScreen] 録音開始完了
 LOG  [STTSocket] WebSocket接続成功
 LOG  [RecordScreen] STT WebSocket接続完了
 LOG  [STTSocket] 初期設定 JSON を送信しました {"enable_automatic_punctuation": true, "interim_results": true, "language_code": "ja-JP", "sample_rate_hertz": 16000}
 LOG  Sending audio chunk size: 4052
 LOG  [RecordScreen] オーディオデータ受信: 4052 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 4052 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10336
 LOG  [RecordScreen] オーディオデータ受信: 10336 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10336 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3066\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "て。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "て。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "て。"}
 LOG  [RecordScreen] 中間結果を更新: て。
 LOG  [STTSocket] Raw event.data: {"text":"\u30c6\u30b9\u30c8\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "テスト。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テスト。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テスト。"}
 LOG  [RecordScreen] 中間結果を更新: テスト。
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u30c6\u30b9\u30c8\u3066\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "テストて。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テストて。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テストて。"}
 LOG  [RecordScreen] 中間結果を更新: テストて。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u30c6\u30b9\u30c8","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "テスト"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テスト"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テスト"}
 LOG  [RecordScreen] 中間結果を更新: テスト
 LOG  [STTSocket] Raw event.data: {"text":" \u30c6\u30b9\u30c8\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " テスト。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " テスト。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " テスト。"}
 LOG  [RecordScreen] 中間結果を更新:  テスト。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u30c6\u30b9\u30c8 \u30c6\u30b9\u30c8\u3002","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "テスト テスト。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テスト テスト。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テスト テスト。"}
 LOG  [RecordScreen] 中間結果を更新: テスト テスト。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u30c6\u30b9\u30c8\u30c6\u30b9\u30c8\u3066\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "テストテストて。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テストテストて。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テストテストて。"}
 LOG  [RecordScreen] 中間結果を更新: テストテストて。
 LOG  [STTSocket] Raw event.data: {"text":"\u30c6\u30b9\u30c8\u30c6\u30b9\u30c8\u30c6\u30b9\u30c8\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "テストテストテスト。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テストテストテスト。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テストテストテスト。"}
 LOG  [RecordScreen] 中間結果を更新: テストテストテスト。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u30c6\u30b9\u30c8\u30c6\u30b9\u30c8\u30c6\u30b9\u30c8\u3066\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "テストテストテストて。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テストテストテストて。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テストテストテストて。"}
 LOG  [RecordScreen] 中間結果を更新: テストテストテストて。
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u30c6\u30b9\u30c8\u30c6\u30b9\u30c8\u30c6\u30b9\u30c8\u30c6\u30b9\u30c8\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "テストテストテストテスト。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テストテストテストテスト。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "テストテストテストテスト。"}
 LOG  [RecordScreen] 中間結果を更新: テストテストテストテスト。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u30c6\u30b9\u30c8\u30c6\u30b9\u30c8\u30c6\u30b9\u30c8\u30c6\u30b9\u30c8\u3002","confidence":0.7878459692001343,"is_final":true,"stability":0.0}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0.7878459692001343, "is_final": true, "stability": 0, "text": "テストテストテストテスト。"}
 LOG  [STTSocket] Converted data: {"confidence": 0.7878459692001343, "isFinal": true, "language": "ja-JP", "text": "テストテストテストテスト。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0.7878459692001343, "isFinal": true, "language": "ja-JP", "text": "テストテストテストテスト。"}
 LOG  [RecordScreen] 最終結果を追加: テストテストテストテスト。
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  録音一時停止
 LOG  録音再開
 LOG  Sending audio chunk size: 8192
 LOG  [RecordScreen] オーディオデータ受信: 8192 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 8192 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 9376
 LOG  [RecordScreen] オーディオデータ受信: 9376 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9376 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":" \u3066\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " て。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " て。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " て。"}
 LOG  [RecordScreen] 中間結果を更新:  て。
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":" \u30c6\u30b9\u30c8\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " テスト。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " テスト。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " テスト。"}
 LOG  [RecordScreen] 中間結果を更新:  テスト。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  録音一時停止
 LOG  録音再開
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10656
 LOG  [RecordScreen] オーディオデータ受信: 10656 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10656 バイト
 LOG  [STTSocket] Raw event.data: {"text":" \u30c6\u30b9\u30c8\u3066\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " テストて。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " テストて。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " テストて。"}
 LOG  [RecordScreen] 中間結果を更新:  テストて。
 LOG  [STTSocket] Raw event.data: {"text":" \u30c6\u30b9\u30c8","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": " テスト"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " テスト"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " テスト"}
 LOG  [RecordScreen] 中間結果を更新:  テスト
 LOG  [STTSocket] Raw event.data: {"text":" \u30c6\u30b9\u30c8\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " テスト。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " テスト。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " テスト。"}
 LOG  [RecordScreen] 中間結果を更新:  テスト。
 LOG  Sending audio chunk size: 10656
 LOG  [RecordScreen] オーディオデータ受信: 10656 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10656 バイト
 LOG  Sending audio chunk size: 10656
 LOG  [RecordScreen] オーディオデータ受信: 10656 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10656 バイト
 LOG  [STTSocket] Raw event.data: {"text":" \u30c6\u30b9\u30c8 \u30c6\u30b9\u30c8\u3002","confidence":0.5022305250167847,"is_final":true,"stability":0.0}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0.5022305250167847, "is_final": true, "stability": 0, "text": " テスト テスト。"}
 LOG  [STTSocket] Converted data: {"confidence": 0.5022305250167847, "isFinal": true, "language": "ja-JP", "text": " テスト テスト。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0.5022305250167847, "isFinal": true, "language": "ja-JP", "text": " テスト テスト。"}
 LOG  [RecordScreen] 最終結果を追加:  テスト テスト。
 LOG  Sending audio chunk size: 10656
 LOG  [RecordScreen] オーディオデータ受信: 10656 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10656 バイト
 LOG  Sending audio chunk size: 10656
 LOG  [RecordScreen] オーディオデータ受信: 10656 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10656 バイト
 LOG  Sending audio chunk size: 10656
 LOG  [RecordScreen] オーディオデータ受信: 10656 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10656 バイト
 LOG  Sending audio chunk size: 10656
 LOG  [RecordScreen] オーディオデータ受信: 10656 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10656 バイト
 LOG  録音停止: file:///var/mobile/Containers/Data/Application/94AEC625-EDAB-4DD8-B1E7-21785524B652/Library/Caches/ExponentExperienceData/@anonymous/talknote-71d77e15-9367-4bcc-95d8-864f456c0a33/AV/recording-C91738CA-B7E6-4A6C-9DCF-3E7C027127CA.wav
 LOG  [STTSocket] EndOfStreamシグナルを送信します
 LOG  [STTSocket] WebSocket接続を閉じます (コード: 1000, 理由: Normal closure)
 LOG  Recording saved successfully
 LOG  録音データをデータベースに保存しました
 LOG  Cloud Storageへのアップロードを開始: file:///var/mobile/Containers/Data/Application/94AEC625-EDAB-4DD8-B1E7-21785524B652/Library/Caches/ExponentExperienceData/@anonymous/talknote-71d77e15-9367-4bcc-95d8-864f456c0a33/AV/recording-C91738CA-B7E6-4A6C-9DCF-3E7C027127CA.wav
 LOG  [STTSocket] WebSocketがコード 1000 で閉じました、理由: Normal closure
 LOG  [RecordScreen] STT WebSocket接続終了
 LOG  アップロード結果: {"gcs_result": {"file_path": "/tmp/talknote_storage/media/test-user-id/77e47c89-6ca4-4f18-a491-ab9788052a12.bin", "media_id": "77e47c89-6ca4-4f18-a491-ab9788052a12", "status": "success"}, "media_id": "77e47c89-6ca4-4f18-a491-ab9788052a12", "status": "success"}