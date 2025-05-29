#!/usr/bin/env python3
"""
Google STT WebSocketエンドポイントのテストスクリプト
"""
import asyncio
import websockets
import json
import wave
import sys
import os

async def test_websocket_stt():
    """WebSocketでSTTテストを実行"""
    try:
        uri = "ws://192.168.0.46:8002/api/v1/stt/stream"
        
        async with websockets.connect(uri) as websocket:
            print("WebSocket接続成功！")
            
            # 最初に設定をJSONで送信
            config = {
                "language_code": "ja-JP",
                "sample_rate_hertz": 16000,
                "interim_results": True,
                "enable_automatic_punctuation": True
            }
            
            await websocket.send(json.dumps(config))
            print("設定送信完了")
            
            # 短い待機
            await asyncio.sleep(0.1)
            
            # テスト用の音声ファイルを読み込む
            # 注意: 実際の音声ファイルのパスを指定してください
            test_audio_path = "test_audio.wav"
            
            if os.path.exists(test_audio_path):
                with wave.open(test_audio_path, 'rb') as wav_file:
                    # 音声データを読み込む
                    audio_data = wav_file.readframes(wav_file.getnframes())
                    
                    # 音声データをチャンクに分割して送信
                    chunk_size = 1024  # 1KBごとに分割
                    for i in range(0, len(audio_data), chunk_size):
                        chunk = audio_data[i:i+chunk_size]
                        await websocket.send(chunk)
                        print(f"音声チャンク {i//chunk_size + 1} (バイナリ) 送信完了")
                        
                        # レスポンスを待機
                        try:
                            response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                            print(f"レスポンス受信: {response}")
                        except asyncio.TimeoutError:
                            print("タイムアウト: レスポンスなし")
            else:
                # 音声ファイルがない場合はダミーデータを使用
                print(f"警告: テスト音声ファイル '{test_audio_path}' が見つかりません。ダミーデータを使用します。")
                dummy_audio = b'\x00' * 1024  # 1KB の無音データ
                
                for i in range(3):
                    await websocket.send(dummy_audio)
                    print(f"音声チャンク {i+1} (ダミー) 送信完了")
                    
                    # レスポンスを待機
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                        print(f"レスポンス受信: {response}")
                    except asyncio.TimeoutError:
                        print("タイムアウト: レスポンスなし")
            
            # ストリーム終了
            end_message = {"type": "end"}
            await websocket.send(json.dumps(end_message))
            print("ストリーム終了信号送信完了")
            
            # 最終レスポンスを待機
            try:
                final_response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"最終レスポンス: {final_response}")
            except asyncio.TimeoutError:
                print("最終レスポンス待機タイムアウト")
                    
    except websockets.exceptions.ConnectionClosed as e:
        print(f"WebSocket接続が閉じられました: {e}")
    except Exception as e:
        print(f"エラー発生: {e}")
        
if __name__ == "__main__":
    print("Google STT WebSocketテスト開始...")
    asyncio.run(test_websocket_stt())
    print("テスト完了") 