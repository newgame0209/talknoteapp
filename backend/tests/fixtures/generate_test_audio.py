#!/usr/bin/env python3
"""
テスト用の音声ファイルを生成するスクリプト
"""
import numpy as np
import wave
import struct
import os

def generate_sine_wave(freq=440.0, duration=3.0, sample_rate=16000):
    """指定された周波数のサイン波を生成する"""
    samples = np.sin(2 * np.pi * np.arange(sample_rate * duration) * freq / sample_rate)
    return samples

def save_wav(filename, samples, sample_rate=16000):
    """サンプルデータをWAVファイルとして保存する"""
    # -1.0～1.0の範囲を16bitの整数に変換
    samples = (samples * 32767).astype(np.int16)
    
    with wave.open(filename, 'w') as wav_file:
        # モノラル、16bit、サンプルレート設定
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        # サンプルデータを書き込み
        for sample in samples:
            wav_file.writeframes(struct.pack('h', sample))
    
    print(f"生成されたファイル: {filename}")
    print(f"サイズ: {os.path.getsize(filename)} bytes")
    print(f"長さ: {duration} 秒")

if __name__ == "__main__":
    # 3種類のテストファイルを生成
    durations = [1.0, 5.0, 10.0]
    
    for duration in durations:
        # 440Hz（A音）のサイン波を生成
        samples = generate_sine_wave(freq=440.0, duration=duration)
        
        # ファイル名を設定
        filename = f"test_audio_{int(duration)}sec.wav"
        
        # WAVファイルとして保存
        save_wav(filename, samples)
