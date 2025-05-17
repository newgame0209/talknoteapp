#!/usr/bin/env python3
"""
テスト用の実際の音声ファイルを生成するスクリプト
gTTS（Google Text-to-Speech）を使用して、日本語のテキストから音声ファイルを生成します。
"""
import os
from gtts import gTTS

def create_speech_file(text, filename, lang='ja'):
    """
    テキストから音声ファイルを生成する
    """
    print(f"テキスト「{text}」から音声ファイルを生成中...")
    
    # gTTSを使用して音声を生成
    tts = gTTS(text=text, lang=lang, slow=False)
    
    # ファイルに保存
    tts.save(filename)
    
    print(f"生成されたファイル: {filename}")
    print(f"サイズ: {os.path.getsize(filename)} bytes")

if __name__ == "__main__":
    # テスト用のテキストと出力ファイル名
    test_texts = [
        "こんにちは、これはテスト用の音声ファイルです。",
        "しゃべるノートは、音声を文字に変換するアプリです。",
        "ディスレクシアやディスグラフィアの方々のための支援ツールです。"
    ]
    
    for i, text in enumerate(test_texts):
        output_file = f"test_speech_{i+1}.mp3"
        create_speech_file(text, output_file)
