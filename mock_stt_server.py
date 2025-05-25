#!/usr/bin/env python3
"""
モック STT WebSocket サーバー
クライアントからの音声データを受信し、簡単な文字起こし結果を返します
"""

import asyncio
import json
import logging
import signal
import sys
import uuid
from typing import Dict, List, Optional, Set

import websockets

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

# 接続中のクライアント
CONNECTED_CLIENTS: Set[websockets.WebSocketServerProtocol] = set()

# モックの文字起こし結果（日本語）
MOCK_TRANSCRIPTIONS = [
    "こんにちは、これはテストです。",
    "今日の天気は晴れです。",
    "明日の予定を確認します。",
    "会議の時間を調整しましょう。",
    "このプロジェクトの進捗はどうですか？",
    "新しい機能について説明します。",
    "ユーザーからのフィードバックを共有します。",
    "バグ修正の優先度を上げてください。",
    "次のリリースはいつですか？",
    "Firebase認証も正常に動作しています。",
]

async def handle_client(websocket): 
    """クライアント接続を処理"""
    client_id = id(websocket)
    logging.info(f"handle_client invoked. client_id: {client_id}, websocket_type: {type(websocket)}")
    
    # websocketオブジェクトの属性をログに出力
    try:
        logging.info(f"Attributes of websocket object: {dir(websocket)}")
        if hasattr(websocket, 'request'):
            logging.info(f"Attributes of websocket.request object: {dir(websocket.request)}")
    except Exception as e:
        logging.error(f"Error logging dir(websocket) or dir(websocket.request): {e}")

    path_to_use: Optional[str] = None

    # 一般的な属性名でパスの取得を試みる
    if hasattr(websocket, 'path'):
        path_to_use = websocket.path
        logging.info(f"Path from websocket.path: {path_to_use}")
    elif hasattr(websocket, 'resource_name'):
        path_to_use = websocket.resource_name
        logging.info(f"Path from websocket.resource_name: {path_to_use}")
    elif hasattr(websocket, 'request_uri'): 
        path_to_use = websocket.request_uri
        logging.info(f"Path from websocket.request_uri: {path_to_use}")
    elif hasattr(websocket, 'request') and websocket.request is not None:
        request_obj = websocket.request
        if hasattr(request_obj, 'path'):
            path_to_use = request_obj.path
            logging.info(f"Path from websocket.request.path: {path_to_use}")
        elif hasattr(request_obj, 'url'):
            path_to_use = request_obj.url
            logging.info(f"Path from websocket.request.url: {path_to_use}")
        elif hasattr(request_obj, 'target'): # aiohttpなど
            path_to_use = str(request_obj.target) # targetがURLオブジェクトの場合があるためstrに変換
            logging.info(f"Path from websocket.request.target: {path_to_use}")
        elif hasattr(request_obj, 'raw_path'):
            path_to_use = request_obj.raw_path.decode() if isinstance(request_obj.raw_path, bytes) else request_obj.raw_path
            logging.info(f"Path from websocket.request.raw_path: {path_to_use}")

    # 他にも 'url', 'full_path' など、フレームワークによって異なる可能性あり
    
    if path_to_use is None:
        logging.error("Failed to determine request path from websocket object.")
        # パスが取得できない場合、エラーとして接続を閉じる
        try:
            await websocket.close(code=1008, reason="Server could not determine request path.")
        except Exception as e:
            logging.error(f"Error closing websocket: {e}")
        return

    logging.info(f"Using path for processing: {path_to_use}")
    
    query_params = {}
    if "?" in path_to_use:
        query_string = path_to_use.split("?", 1)[1]
        for param in query_string.split("&"):
            if "=" in param:
                key, value = param.split("=", 1)
                query_params[key] = value
    
    token = query_params.get("token", "no_token")
    logging.info(f"クライアント接続: ID={client_id}, トークン={token}, Path={path_to_use}")
    
    try:
        CONNECTED_CLIENTS.add(websocket)
        logging.info(f"クライアント {client_id} が接続しました。現在の接続数: {len(CONNECTED_CLIENTS)}")
        
        # 初期メッセージ送信
        await websocket.send(json.dumps({
            "transcript": "接続しました。話し始めてください...",
            "isFinal": True,
            "confidence": 0.95,
        }))

        async for message in websocket:
            if isinstance(message, str):
                logging.info(f"クライアント {client_id} からテキストメッセージ受信: {message}")
                if message == "END_OF_STREAM":
                    logging.info(f"クライアント {client_id} からセッション終了を受信")
                    await websocket.send(json.dumps({"transcript": "セッションを終了します。", "isFinal": True}))
                    break 
            elif isinstance(message, bytes):
                logging.info(f"クライアント {client_id} から音声データ受信: {len(message)} バイト")
                # モックサーバーなので、実際の音声処理はせず、ダミーの文字起こしを返す
                import random
                mock_text = random.choice(MOCK_TRANSCRIPTIONS)
                response = {
                    "transcript": mock_text,
                    "isFinal": False, 
                    "confidence": random.uniform(0.7, 0.98)
                }
                await websocket.send(json.dumps(response))
            else:
                logging.warning(f"クライアント {client_id} から不明なタイプのメッセージ受信: {type(message)}")

    except websockets.exceptions.ConnectionClosedError as e:
        logging.info(f"クライアント {client_id} との接続が閉じられました (正常終了の可能性あり): {e.code} {e.reason}")
    except Exception as e:
        logging.error(f"クライアント {client_id} の処理中にエラーが発生: {e}", exc_info=True)
    finally:
        CONNECTED_CLIENTS.discard(websocket)
        logging.info(f"クライアント {client_id} が切断しました。現在の接続数: {len(CONNECTED_CLIENTS)}")

async def main():
    host = "0.0.0.0"
    port = 8000

    # シグナルハンドラ設定
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(shutdown()))
    
    # サーバー起動
    async with websockets.serve(handle_client, host, port, ping_interval=30):
        logging.info(f"STTモックサーバーを起動しました - ws://{host}:{port}/api/v1/stt/stream")
        await asyncio.Future()  

async def shutdown():
    """サーバーを安全にシャットダウン"""
    logging.info("サーバーをシャットダウンしています...")
    # すべてのクライアント接続を閉じるなどのクリーンアップ処理をここに追加可能
    # 現在は特に能動的なクリーンアップはなし
    tasks = [task for task in asyncio.all_tasks() if task is not asyncio.current_task()]
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    asyncio.get_event_loop().stop()

if __name__ == "__main__":
    asyncio.run(main())
