LOG  [Dashboard] データ読み込み完了
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
 LOG  Sending audio chunk size: 9728
 LOG  [RecordScreen] オーディオデータ受信: 9728 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9728 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\uff1f","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これ？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これ？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これ？"}
 LOG  [RecordScreen] 中間結果を更新: これ？
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\uff1f","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは？"}
 LOG  [RecordScreen] 中間結果を更新: これは？
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\uff1f","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これは？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは？"}
 LOG  [RecordScreen] 中間結果を更新: これは？
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これは"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 中間結果を更新: これは
 LOG  [STTSocket] Raw event.data: {"text":" \u6587\u5b57\uff1f","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " 文字？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字？"}
 LOG  [RecordScreen] 中間結果を更新:  文字？
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これは"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 中間結果を更新: これは
 LOG  [STTSocket] Raw event.data: {"text":" \u6587\u5b57\u8d77\u3053\u3057\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " 文字起こし。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字起こし。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字起こし。"}
 LOG  [RecordScreen] 中間結果を更新:  文字起こし。
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これは"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 中間結果を更新: これは
 LOG  [STTSocket] Raw event.data: {"text":" \u6587\u5b57\u8d77\u3053\u3057\u306e\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " 文字起こしの。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字起こしの。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字起こしの。"}
 LOG  [RecordScreen] 中間結果を更新:  文字起こしの。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これは"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 中間結果を更新: これは
 LOG  [STTSocket] Raw event.data: {"text":" \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " 文字起こしのテスト。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字起こしのテスト。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字起こしのテスト。"}
 LOG  [RecordScreen] 中間結果を更新:  文字起こしのテスト。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これは"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 中間結果を更新: これは
 LOG  [STTSocket] Raw event.data: {"text":" \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " 文字起こしのテストです。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字起こしのテストです。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字起こしのテストです。"}
 LOG  [RecordScreen] 中間結果を更新:  文字起こしのテストです。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これは 文字起こしのテストです。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これは"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 中間結果を更新: これは
 LOG  [STTSocket] Raw event.data: {"text":" \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " 文字起こしのテストです。お"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字起こしのテストです。お"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字起こしのテストです。お"}
 LOG  [RecordScreen] 中間結果を更新:  文字起こしのテストです。お
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これは"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは"}
 LOG  [RecordScreen] 中間結果を更新: これは
 LOG  [STTSocket] Raw event.data: {"text":" \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " 文字起こしのテストです。おそらく。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字起こしのテストです。おそらく。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 文字起こしのテストです。おそらく。"}
 LOG  [RecordScreen] 中間結果を更新:  文字起こしのテストです。おそらく。
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
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f\u3002","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これは 文字起こしのテストです。おそらく。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく。
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f a\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく a。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく a。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく a。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく a。
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f ai\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく ai。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく ai。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく ai。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく ai。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル。
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生成
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210\u306e","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生成の
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210\u306e\u6a5f\u80fd\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生成の機能。
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210\u306e\u6a5f\u80fd\u304c\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210\u306e\u6a5f\u80fd\u304c\u5b9f\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210\u306e\u6a5f\u80fd\u304c\u5b9f\u88c5\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装。
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210\u306e\u6a5f\u80fd\u304c\u5b9f\u88c5\u3055\u308c\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装され。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装され。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装され。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装され。
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210\u306e\u6a5f\u80fd\u304c\u5b9f\u88c5\u3055\u308c\u3066\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されて。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されて。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されて。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されて。
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210\u306e\u6a5f\u80fd\u304c\u5b9f\u88c5\u3055\u308c\u3066\u3044\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されてい。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されてい。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されてい。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されてい。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210\u306e\u6a5f\u80fd\u304c\u5b9f\u88c5\u3055\u308c\u3066\u3044\u307e\u305b\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていませ。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていませ。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていませ。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていませ。
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210\u306e\u6a5f\u80fd\u304c\u5b9f\u88c5\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていません。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていません。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていません。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていません。
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
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210\u306e\u6a5f\u80fd\u304c\u5b9f\u88c5\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていません。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていません。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていません。"}
 LOG  [RecordScreen] 中間結果を更新: これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていません。
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f \u6587\u5b57\u8d77\u3053\u3057\u306e\u30c6\u30b9\u30c8\u3067\u3059\u3002\u304a\u305d\u3089\u304f AI \u30bf\u30a4\u30c8\u30eb \u751f\u6210\u306e\u6a5f\u80fd\u304c\u5b9f\u88c5\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002","confidence":0.9769513010978699,"is_final":true,"stability":0.0}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0.9769513010978699, "is_final": true, "stability": 0, "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていません。"}
 LOG  [STTSocket] Converted data: {"confidence": 0.9769513010978699, "isFinal": true, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていません。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0.9769513010978699, "isFinal": true, "language": "ja-JP", "text": "これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていません。"}
 LOG  [RecordScreen] 最終結果を追加: これは 文字起こしのテストです。おそらく AI タイトル 生成の機能が実装されていません。
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\uff1f","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これ？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これ？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これ？"}
 LOG  [RecordScreen] 中間結果を更新: これ？
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\uff1f","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これは？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これは？"}
 LOG  [RecordScreen] 中間結果を更新: これは？
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これはテスト。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテスト。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテスト。"}
 LOG  [RecordScreen] 中間結果を更新: これはテスト。
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これはテストです。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。"}
 LOG  [RecordScreen] 中間結果を更新: これはテストです。
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
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これはテストです。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。"}
 LOG  [RecordScreen] 中間結果を更新: これはテストです。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これはテストです。ただ。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ。"}
 LOG  [RecordScreen] 中間結果を更新: これはテストです。ただ。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u5358","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これはテストです。ただ単"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ単"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ単"}
 LOG  [RecordScreen] 中間結果を更新: これはテストです。ただ単
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u5358\u306b\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "これはテストです。ただ単に。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ単に。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ単に。"}
 LOG  [RecordScreen] 中間結果を更新: これはテストです。ただ単に。
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u5358\u306b","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これはテストです。ただ単に"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ単に"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ単に"}
 LOG  [RecordScreen] 中間結果を更新: これはテストです。ただ単に
 LOG  [STTSocket] Raw event.data: {"text":" \u3067\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " で。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " で。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " で。"}
 LOG  [RecordScreen] 中間結果を更新:  で。
 LOG  [STTSocket] Raw event.data: {"text":" \u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u5358\u306b\u30c7\u30d0\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " これはテストです。ただ単にデバ。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " これはテストです。ただ単にデバ。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " これはテストです。ただ単にデバ。"}
 LOG  [RecordScreen] 中間結果を更新:  これはテストです。ただ単にデバ。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":" \u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u5358\u306b","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": " これはテストです。ただ単に"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " これはテストです。ただ単に"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " これはテストです。ただ単に"}
 LOG  [RecordScreen] 中間結果を更新:  これはテストです。ただ単に
 LOG  [STTSocket] Raw event.data: {"text":" \u30c7\u30d0\u30c3\u30b0\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " デバッグ。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " デバッグ。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " デバッグ。"}
 LOG  [RecordScreen] 中間結果を更新:  デバッグ。
 LOG  [STTSocket] Raw event.data: {"text":" \u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u5358\u306b","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": " これはテストです。ただ単に"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " これはテストです。ただ単に"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " これはテストです。ただ単に"}
 LOG  [RecordScreen] 中間結果を更新:  これはテストです。ただ単に
 LOG  [STTSocket] Raw event.data: {"text":" \u30c7\u30d0\u30c3\u30b0\u30ed\u30b0\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " デバッグログ。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " デバッグログ。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " デバッグログ。"}
 LOG  [RecordScreen] 中間結果を更新:  デバッグログ。
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":" \u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u5358\u306b \u30c7\u30d0\u30c3\u30b0\u30ed\u30b0","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": " これはテストです。ただ単に デバッグログ"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " これはテストです。ただ単に デバッグログ"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " これはテストです。ただ単に デバッグログ"}
 LOG  [RecordScreen] 中間結果を更新:  これはテストです。ただ単に デバッグログ
 LOG  [STTSocket] Raw event.data: {"text":" \u3092\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " を。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " を。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " を。"}
 LOG  [RecordScreen] 中間結果を更新:  を。
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u3001\u5358\u306b\u30c7\u30d0\u30c3\u30b0\u30ed\u30b0","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これはテストです。ただ、単にデバッグログ"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ、単にデバッグログ"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ、単にデバッグログ"}
 LOG  [RecordScreen] 中間結果を更新: これはテストです。ただ、単にデバッグログ
 LOG  [STTSocket] Raw event.data: {"text":" \u3092\u5165\u308c\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " を入れ。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " を入れ。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " を入れ。"}
 LOG  [RecordScreen] 中間結果を更新:  を入れ。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u3001\u5358\u306b\u30c7\u30d0\u30c3\u30b0\u30ed\u30b0","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これはテストです。ただ、単にデバッグログ"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ、単にデバッグログ"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ、単にデバッグログ"}
 LOG  [RecordScreen] 中間結果を更新: これはテストです。ただ、単にデバッグログ
 LOG  [STTSocket] Raw event.data: {"text":" \u3092\u5165\u308c\u305f\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " を入れた。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " を入れた。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " を入れた。"}
 LOG  [RecordScreen] 中間結果を更新:  を入れた。
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u3001\u5358\u306b\u30c7\u30d0\u30c3\u30b0\u30ed\u30b0","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これはテストです。ただ、単にデバッグログ"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ、単にデバッグログ"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ、単にデバッグログ"}
 LOG  [RecordScreen] 中間結果を更新: これはテストです。ただ、単にデバッグログ
 LOG  [STTSocket] Raw event.data: {"text":" \u3092\u5165\u308c\u305f\u3060\u3051\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " を入れただけ。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " を入れただけ。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " を入れただけ。"}
 LOG  [RecordScreen] 中間結果を更新:  を入れただけ。
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u3001\u5358\u306b\u30c7\u30d0\u30c3\u30b0\u30ed\u30b0","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "これはテストです。ただ、単にデバッグログ"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ、単にデバッグログ"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "これはテストです。ただ、単にデバッグログ"}
 LOG  [RecordScreen] 中間結果を更新: これはテストです。ただ、単にデバッグログ
 LOG  [STTSocket] Raw event.data: {"text":" \u3092\u5165\u308c\u305f\u3060\u3051\u3067\u3059\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " を入れただけです。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " を入れただけです。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " を入れただけです。"}
 LOG  [RecordScreen] 中間結果を更新:  を入れただけです。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u3053\u308c\u306f\u30c6\u30b9\u30c8\u3067\u3059\u3002\u305f\u3060\u3001\u5358\u306b\u30c7\u30d0\u30c3\u30b0\u30ed\u30b0 \u3092\u5165\u308c\u305f\u3060\u3051\u3067\u3059\u3002","confidence":0.9802093505859375,"is_final":true,"stability":0.0}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0.9802093505859375, "is_final": true, "stability": 0, "text": "これはテストです。ただ、単にデバッグログ を入れただけです。"}
 LOG  [STTSocket] Converted data: {"confidence": 0.9802093505859375, "isFinal": true, "language": "ja-JP", "text": "これはテストです。ただ、単にデバッグログ を入れただけです。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0.9802093505859375, "isFinal": true, "language": "ja-JP", "text": "これはテストです。ただ、単にデバッグログ を入れただけです。"}
 LOG  [RecordScreen] 最終結果を追加: これはテストです。ただ、単にデバッグログ を入れただけです。
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
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":" \u4f55\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " 何。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 何。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " 何。"}
 LOG  [RecordScreen] 中間結果を更新:  何。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u306a\u3093\uff1f","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "なん？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なん？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なん？"}
 LOG  [RecordScreen] 中間結果を更新: なん？
 LOG  [STTSocket] Raw event.data: {"text":" \u306a\u3093\u3067\uff1f","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " なんで？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " なんで？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " なんで？"}
 LOG  [RecordScreen] 中間結果を更新:  なんで？
 LOG  [STTSocket] Raw event.data: {"text":" \u306a\u3093\u3067\u3053\u3093\u306a\uff1f","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " なんでこんな？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " なんでこんな？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " なんでこんな？"}
 LOG  [RecordScreen] 中間結果を更新:  なんでこんな？
 LOG  [STTSocket] Raw event.data: {"text":"\u306a\u3093\u3067\u3053\u3093\u306a\u7c21\u5358\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "なんでこんな簡単。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単。"}
 LOG  [RecordScreen] 中間結果を更新: なんでこんな簡単。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u306a\u3093\u3067\u3053\u3093\u306a\u7c21\u5358\u306a\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "なんでこんな簡単な。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な。"}
 LOG  [RecordScreen] 中間結果を更新: なんでこんな簡単な。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u306a\u3093\u3067\u3053\u3093\u306a\u7c21\u5358\u306a\u51e6\u7406\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "なんでこんな簡単な処理。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な処理。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な処理。"}
 LOG  [RecordScreen] 中間結果を更新: なんでこんな簡単な処理。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u306a\u3093\u3067\u3053\u3093\u306a\u7c21\u5358\u306a\u51e6\u7406\u3082\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "なんでこんな簡単な処理も。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な処理も。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な処理も。"}
 LOG  [RecordScreen] 中間結果を更新: なんでこんな簡単な処理も。
 LOG  [STTSocket] Raw event.data: {"text":"\u306a\u3093\u3067\u3053\u3093\u306a\u7c21\u5358\u306a\u51e6\u7406\u3082\u3067\u304d\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "なんでこんな簡単な処理もでき。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な処理もでき。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な処理もでき。"}
 LOG  [RecordScreen] 中間結果を更新: なんでこんな簡単な処理もでき。
 LOG  [STTSocket] Raw event.data: {"text":"\u306a\u3093\u3067\u3053\u3093\u306a\u7c21\u5358\u306a\u51e6\u7406\u3082\u3067\u304d\u306a\u3044\u3002","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "なんでこんな簡単な処理もできない。"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な処理もできない。"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な処理もできない。"}
 LOG  [RecordScreen] 中間結果を更新: なんでこんな簡単な処理もできない。
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":" \u306a\u3093\u3067\u3053\u3093\u306a\u7c21\u5358\u306a\u51e6\u7406\u3082\u3067\u304d\u306a\u3044\u3093\uff1f","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " なんでこんな簡単な処理もできないん？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " なんでこんな簡単な処理もできないん？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " なんでこんな簡単な処理もできないん？"}
 LOG  [RecordScreen] 中間結果を更新:  なんでこんな簡単な処理もできないん？
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  [STTSocket] Raw event.data: {"text":" \u306a\u3093\u3067\u3053\u3093\u306a\u7c21\u5358\u306a\u51e6\u7406\u3082\u3067\u304d\u306a\u3044\u3093\u3067\u3057\u3087\u3046\uff1f","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": " なんでこんな簡単な処理もできないんでしょう？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " なんでこんな簡単な処理もできないんでしょう？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": " なんでこんな簡単な処理もできないんでしょう？"}
 LOG  [RecordScreen] 中間結果を更新:  なんでこんな簡単な処理もできないんでしょう？
 LOG  [STTSocket] Raw event.data: {"text":"\u306a\u3093\u3067\u3053\u3093\u306a\u7c21\u5358\u306a\u51e6\u7406\u3082\u3067\u304d\u306a\u3044\u3093\u3067\u3057\u3087\u3046\u304b\uff1f","confidence":0.0,"is_final":false,"stability":0.009999999776482582}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.009999999776482582, "text": "なんでこんな簡単な処理もできないんでしょうか？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な処理もできないんでしょうか？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な処理もできないんでしょうか？"}
 LOG  [RecordScreen] 中間結果を更新: なんでこんな簡単な処理もできないんでしょうか？
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
 LOG  [STTSocket] Raw event.data: {"text":"\u306a\u3093\u3067\u3053\u3093\u306a\u7c21\u5358\u306a\u51e6\u7406\u3082\u3067\u304d\u306a\u3044\u3093\u3067\u3057\u3087\u3046\u304b\uff1f","confidence":0.0,"is_final":false,"stability":0.8999999761581421}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0, "is_final": false, "stability": 0.8999999761581421, "text": "なんでこんな簡単な処理もできないんでしょうか？"}
 LOG  [STTSocket] Converted data: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な処理もできないんでしょうか？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0, "isFinal": false, "language": "ja-JP", "text": "なんでこんな簡単な処理もできないんでしょうか？"}
 LOG  [RecordScreen] 中間結果を更新: なんでこんな簡単な処理もできないんでしょうか？
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  [STTSocket] Raw event.data: {"text":"\u306a\u3093\u3067\u3053\u3093\u306a\u7c21\u5358\u306a\u51e6\u7406\u3082\u3067\u304d\u306a\u3044\u3093\u3067\u3057\u3087\u3046\u304b\uff1f","confidence":0.9948673844337463,"is_final":true,"stability":0.0}
 LOG  [STTSocket] Parsed data (object): {"confidence": 0.9948673844337463, "is_final": true, "stability": 0, "text": "なんでこんな簡単な処理もできないんでしょうか？"}
 LOG  [STTSocket] Converted data: {"confidence": 0.9948673844337463, "isFinal": true, "language": "ja-JP", "text": "なんでこんな簡単な処理もできないんでしょうか？"}
 LOG  [RecordScreen] 文字起こし結果を受信: {"confidence": 0.9948673844337463, "isFinal": true, "language": "ja-JP", "text": "なんでこんな簡単な処理もできないんでしょうか？"}
 LOG  [RecordScreen] 最終結果を追加: なんでこんな簡単な処理もできないんでしょうか？
 LOG  Sending audio chunk size: 9472
 LOG  [RecordScreen] オーディオデータ受信: 9472 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 9472 バイト
 LOG  Sending audio chunk size: 10240
 LOG  [RecordScreen] オーディオデータ受信: 10240 バイト
 LOG  [RecordScreen] WebSocketでオーディオデータを送信
 LOG  [STTSocket] 送信するオーディオデータサイズ: 10240 バイト
 LOG  録音停止: file:///var/mobile/Containers/Data/Application/94AEC625-EDAB-4DD8-B1E7-21785524B652/Library/Caches/ExponentExperienceData/@anonymous/talknote-71d77e15-9367-4bcc-95d8-864f456c0a33/AV/recording-80B5FA35-1C6B-419B-A8DB-67660AF1480B.wav
 LOG  [STTSocket] EndOfStreamシグナルを送信します
 LOG  [STTSocket] WebSocket接続を閉じます (コード: 1000, 理由: Normal closure)
 LOG  Recording saved successfully
 LOG  録音データをデータベースに保存しました
 LOG  Cloud Storageへのアップロードを開始: file:///var/mobile/Containers/Data/Application/94AEC625-EDAB-4DD8-B1E7-21785524B652/Library/Caches/ExponentExperienceData/@anonymous/talknote-71d77e15-9367-4bcc-95d8-864f456c0a33/AV/recording-80B5FA35-1C6B-419B-A8DB-67660AF1480B.wav
 LOG  [STTSocket] WebSocketがコード 1000 で閉じました、理由: Normal closure
 LOG  [RecordScreen] STT WebSocket接続終了
 LOG  アップロード結果: {"gcs_result": {"file_path": "/tmp/talknote_storage/media/test-user-id/7e4b4af0-b677-45eb-a21a-0fb24c45acde.bin", "media_id": "7e4b4af0-b677-45eb-a21a-0fb24c45acde", "status": "success"}, "media_id": "7e4b4af0-b677-45eb-a21a-0fb24c45acde", "status": "success"}
 LOG  Recording updated successfully