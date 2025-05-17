#!/usr/bin/env python3
"""
Google Cloud Speech-to-Text APIを使用した簡易テストスクリプト
使用方法:
  1. スクリプトを実行: python3 test_google_stt.py --file test_audio_5sec.wav
"""
import os
import sys
import argparse
import time
import pathlib
from dotenv import load_dotenv
from google.cloud import speech

# .envファイルを読み込む
dotenv_path = pathlib.Path(__file__).parent.parent.parent.parent / '.env'
load_dotenv(dotenv_path)

def transcribe_file(file_path, language_code="ja-JP"):
    """
    音声ファイルを文字起こしする
    """
    print(f"Google Cloud Speech-to-Text APIを使用して {file_path} を文字起こし中...")
    
    # クライアントの初期化
    client = speech.SpeechClient()
    
    # 音声ファイルの読み込み
    with open(file_path, "rb") as audio_file:
        content = audio_file.read()
    
    # 音声の設定
    audio = speech.RecognitionAudio(content=content)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code=language_code,
        enable_automatic_punctuation=True,
    )
    
    # 開始時間を記録
    start_time = time.time()
    
    # 文字起こしリクエスト
    response = client.recognize(config=config, audio=audio)
    
    # 処理時間を計算
    processing_time = time.time() - start_time
    
    # 結果の表示
    print(f"\n文字起こし結果:")
    transcript = ""
    for result in response.results:
        transcript += result.alternatives[0].transcript
        print(f"文字起こし: {result.alternatives[0].transcript}")
        print(f"信頼度: {result.alternatives[0].confidence:.2f}")
    
    print(f"\n処理時間: {processing_time:.2f}秒")
    
    # 結果を返す
    return {
        "transcript": transcript,
        "processing_time": processing_time,
        "confidence": response.results[0].alternatives[0].confidence if response.results else 0,
        "language": language_code
    }

def main():
    parser = argparse.ArgumentParser(description='Google Cloud Speech-to-Text APIテスト')
    parser.add_argument('--file', required=True, help='文字起こしする音声ファイル')
    parser.add_argument('--language', default='ja-JP', help='言語コード (デフォルト: ja-JP)')
    
    args = parser.parse_args()
    
    # ファイルの存在確認
    file_path = args.file
    if not os.path.exists(file_path):
        file_path = os.path.join(os.path.dirname(__file__), args.file)
        if not os.path.exists(file_path):
            print(f"エラー: ファイル {args.file} が見つかりません")
            sys.exit(1)
    
    # 認証情報の確認
    if not os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'):
        print("警告: GOOGLE_APPLICATION_CREDENTIALS環境変数が設定されていません")
        print("テスト実行をスキップします")
        sys.exit(1)
    else:
        print(f"認証情報: {os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')}")
    
    try:
        # 文字起こし実行
        result = transcribe_file(file_path, args.language)
        
        # Word Error Rate (WER) の評価
        # 実際のWER評価には参照テキストが必要ですが、ここでは簡易的に文字数をチェック
        if len(result["transcript"]) > 0:
            print("\nテスト成功: 文字起こし結果が得られました")
            print(f"目標WER: ≤12% (実際のWER評価には参照テキストが必要です)")
        else:
            print("\nテスト失敗: 文字起こし結果が空です")
    
    except Exception as e:
        print(f"エラー: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
