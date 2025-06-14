from flask import jsonify, request, send_file
from google.cloud import texttospeech
from . import notes_bp
from auth_middleware import require_auth
import tempfile
import os
import logging

logger = logging.getLogger(__name__)

def init_tts_client():
    """Text-to-Speech APIクライアントの初期化"""
    try:
        return texttospeech.TextToSpeechClient()
    except Exception as e:
        logger.error(f"Text-to-Speech APIクライアントの初期化エラー: {str(e)}")
        raise Exception(f"Text-to-Speech APIクライアントの初期化に失敗しました: {str(e)}")

@notes_bp.route('/tts', methods=['POST'])
@require_auth
def synthesize_speech():
    """
    テキストを音声に変換するエンドポイント
    
    Expected JSON:
    {
        "text": "読み上げるテキスト",
        "voice": {
            "language_code": "ja-JP",
            "name": "ja-JP-Neural2-B",  # オプション
            "ssml_gender": "FEMALE"      # オプション
        },
        "audio_config": {
            "speaking_rate": 1.0,        # オプション
            "pitch": 0.0                 # オプション
        }
    }
    """
    try:
        # 認証済みユーザーからユーザーIDを取得
        user_id = request.firebase_token.get('uid')
        if not user_id:
            logger.error("ユーザーIDが取得できません")
            return jsonify({'error': '認証エラー'}), 401
            
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'テキストが必要です'}), 400
            
        # クライアントの初期化
        client = init_tts_client()
        
        # 音声設定の準備
        voice_config = data.get('voice', {})
        synthesis_input = texttospeech.SynthesisInput(text=data['text'])
        
        # 音声設定
        voice = texttospeech.VoiceSelectionParams(
            language_code=voice_config.get('language_code', 'ja-JP'),
            name=voice_config.get('name', 'ja-JP-Neural2-B'),
            ssml_gender=getattr(
                texttospeech.SsmlVoiceGender,
                voice_config.get('ssml_gender', 'FEMALE')
            )
        )
        
        # オーディオ設定
        audio_config = data.get('audio_config', {})
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=audio_config.get('speaking_rate', 1.0),
            pitch=audio_config.get('pitch', 0.0)
        )
        
        # 音声合成の実行
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        # 一時ファイルに音声データを保存
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as temp_audio:
            temp_audio.write(response.audio_content)
            temp_audio_path = temp_audio.name
            
        # 音声ファイルを送信
        return send_file(
            temp_audio_path,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name='speech.mp3'
        )
        
    except Exception as e:
        return jsonify({
            'error': f'音声合成中にエラーが発生しました: {str(e)}'
        }), 500
        
    finally:
        # 一時ファイルの削除
        if 'temp_audio_path' in locals():
            try:
                os.unlink(temp_audio_path)
            except Exception:
                pass