#!/usr/bin/env python3
"""
メディアアップロードAPIのテストスクリプト
1. 署名付きURLを取得
2. 署名付きURLを使用してファイルをアップロード
3. アップロード後のステータスを確認
"""
import os
import sys
import time
import json
import requests
import argparse
from uuid import uuid4

# デフォルト値
DEFAULT_API_URL = "http://localhost:8000"
DEFAULT_AUDIO_FILE = "test_audio_5sec.wav"

def get_upload_url(api_url, notebook_id=None, page_id=None):
    """
    署名付きURLを取得するAPIを呼び出す
    """
    print("1. 署名付きURLを取得中...")
    
    # ノートブックIDとページIDがない場合はダミー値を使用
    if not notebook_id:
        notebook_id = str(uuid4())
    if not page_id:
        page_id = str(uuid4())
    
    # APIリクエストの準備
    endpoint = f"{api_url}/api/v1/media/upload-url"
    headers = {
        "Content-Type": "application/json",
    }
    
    # 開発環境では認証がバイパスされる想定
    # 本番環境では適切な認証トークンが必要
    
    payload = {
        "notebook_id": notebook_id,
        "page_id": page_id,
        "media_type": "audio",
        "filename": os.path.basename(DEFAULT_AUDIO_FILE),
        "content_type": "audio/wav"
    }
    
    # APIリクエスト実行
    try:
        response = requests.post(endpoint, headers=headers, json=payload)
        response.raise_for_status()  # エラーレスポンスの場合は例外を発生
        
        result = response.json()
        print(f"署名付きURL取得成功: {result['upload_url'][:50]}...")
        print(f"メディアID: {result['media_id']}")
        return result
    except requests.exceptions.RequestException as e:
        print(f"エラー: 署名付きURLの取得に失敗しました - {str(e)}")
        if hasattr(e, 'response') and e.response:
            print(f"レスポンス: {e.response.text}")
        sys.exit(1)

def upload_file_to_signed_url(upload_url, file_path):
    """
    署名付きURLを使用してファイルをアップロード
    """
    print(f"2. ファイル {file_path} をアップロード中...")
    
    try:
        with open(file_path, 'rb') as file:
            file_data = file.read()
            
        headers = {
            "Content-Type": "audio/wav",
        }
        
        response = requests.put(upload_url, headers=headers, data=file_data)
        response.raise_for_status()
        
        print(f"ファイルアップロード成功: ステータスコード {response.status_code}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"エラー: ファイルのアップロードに失敗しました - {str(e)}")
        if hasattr(e, 'response') and e.response:
            print(f"レスポンス: {e.response.text}")
        return False
    except IOError as e:
        print(f"エラー: ファイルの読み込みに失敗しました - {str(e)}")
        return False

def check_media_status(api_url, media_id, max_retries=10, retry_delay=2):
    """
    メディア処理のステータスを確認
    """
    print(f"3. メディアID {media_id} の処理ステータスを確認中...")
    
    endpoint = f"{api_url}/api/v1/media/{media_id}/status"
    headers = {
        "Content-Type": "application/json",
    }
    
    for i in range(max_retries):
        try:
            response = requests.get(endpoint, headers=headers)
            response.raise_for_status()
            
            status_data = response.json()
            print(f"試行 {i+1}/{max_retries}: ステータス = {status_data.get('status', 'unknown')}")
            
            # 処理完了または失敗の場合はループを終了
            if status_data.get('status') in ['completed', 'failed']:
                return status_data
            
            # まだ処理中の場合は待機
            print(f"{retry_delay}秒待機中...")
            time.sleep(retry_delay)
            
        except requests.exceptions.RequestException as e:
            print(f"エラー: ステータス確認に失敗しました - {str(e)}")
            if hasattr(e, 'response') and e.response:
                print(f"レスポンス: {e.response.text}")
            time.sleep(retry_delay)
    
    print("最大試行回数に達しました。処理が完了していない可能性があります。")
    return None

def main():
    parser = argparse.ArgumentParser(description='メディアアップロードAPIのテスト')
    parser.add_argument('--api-url', default=DEFAULT_API_URL, help='APIのベースURL')
    parser.add_argument('--file', default=DEFAULT_AUDIO_FILE, help='アップロードする音声ファイル')
    parser.add_argument('--notebook-id', help='既存のノートブックID（オプション）')
    parser.add_argument('--page-id', help='既存のページID（オプション）')
    
    args = parser.parse_args()
    
    # カレントディレクトリにファイルがない場合は、相対パスを調整
    file_path = args.file
    if not os.path.exists(file_path):
        file_path = os.path.join(os.path.dirname(__file__), args.file)
        if not os.path.exists(file_path):
            print(f"エラー: ファイル {args.file} が見つかりません")
            sys.exit(1)
    
    # 1. 署名付きURLを取得
    result = get_upload_url(args.api_url, args.notebook_id, args.page_id)
    upload_url = result['upload_url']
    media_id = result['media_id']
    
    # 2. ファイルをアップロード
    if upload_file_to_signed_url(upload_url, file_path):
        # 3. 処理ステータスを確認
        status_data = check_media_status(args.api_url, media_id)
        if status_data:
            print("\n最終ステータス:")
            print(json.dumps(status_data, indent=2, ensure_ascii=False))
    
    print("\nテスト完了")

if __name__ == "__main__":
    main()
