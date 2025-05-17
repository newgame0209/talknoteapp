#!/usr/bin/env python3
"""
MP3ファイルをWAVファイルに変換するスクリプト
pydubを使用してMP3ファイルをWAVファイルに変換します。
"""
import os
import glob
from pydub import AudioSegment

def convert_mp3_to_wav(mp3_file, wav_file):
    """
    MP3ファイルをWAVファイルに変換する
    """
    print(f"変換中: {mp3_file} -> {wav_file}")
    
    # MP3ファイルを読み込む
    sound = AudioSegment.from_mp3(mp3_file)
    
    # サンプルレートを16kHzに設定（Google STT APIの推奨値）
    sound = sound.set_frame_rate(16000)
    
    # モノラルに変換
    sound = sound.set_channels(1)
    
    # WAVファイルとして保存
    sound.export(wav_file, format="wav")
    
    print(f"変換完了: {wav_file}")
    print(f"サイズ: {os.path.getsize(wav_file)} bytes")

if __name__ == "__main__":
    # カレントディレクトリ内のすべてのMP3ファイルを変換
    mp3_files = glob.glob("test_speech_*.mp3")
    
    if not mp3_files:
        print("MP3ファイルが見つかりません")
        exit(1)
    
    for mp3_file in mp3_files:
        # 出力ファイル名を生成（拡張子をwavに変更）
        wav_file = os.path.splitext(mp3_file)[0] + ".wav"
        
        # 変換を実行
        convert_mp3_to_wav(mp3_file, wav_file)
