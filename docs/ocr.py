from flask import jsonify, request
from google.cloud import vision
import io
import base64
from . import notes_bp
from auth_middleware import require_auth
from database import Session
from models import Note
import json
import logging
import os

logger = logging.getLogger(__name__)

def init_vision_client():
    """Vision APIクライアントの初期化"""
    try:
        return vision.ImageAnnotatorClient()
    except Exception as e:
        logger.error(f"Vision APIクライアントの初期化エラー: {str(e)}")
        raise

@notes_bp.route('/notes/<int:note_id>/pages/<int:page_number>/ocr', methods=['POST'])
@require_auth
def perform_ocr(note_id, page_number):
    """画像からテキストを抽出するエンドポイント"""
    try:
        logger.info(f"OCRリクエストを受信: note_id={note_id}, page_number={page_number}")
        
        # 認証済みユーザーからユーザーIDを取得
        user_id = request.firebase_token.get('uid')
        if not user_id:
            logger.error("ユーザーIDが取得できません")
            return jsonify({'error': '認証エラー'}), 401
        
        # ノートの所有権を確認
        db = Session()
        note = db.query(Note).filter(Note.id == note_id).first()
        
        if not note:
            logger.warning(f"ノートが見つかりません: ID={note_id}")
            return jsonify({'error': '指定されたノートが見つかりません'}), 404
            
        # ノートの所有者チェック
        if note.user_id != user_id:
            logger.warning(f"ノートへのアクセス権限がありません: ID={note_id}, リクエストユーザー={user_id}, ノート所有者={note.user_id}")
            return jsonify({'error': 'このノートへのアクセス権限がありません'}), 403
        
        # リクエストデータの取得
        data = request.get_json()
        logger.info("リクエストデータを取得")
        
        if not data or 'image' not in data:
            logger.error("画像データが見つかりません")
            return jsonify({'error': '画像データが必要です'}), 400
            
        # Base64デコード
        logger.info("Base64デコードを開始")
        try:
            base64_data = data['image']
            if base64_data.startswith('data:'):
                base64_data = base64_data.split(',', 1)[1]
            
            image_bytes = base64.b64decode(base64_data)
            logger.info(f"デコードされた画像データのサイズ: {len(image_bytes)} bytes")
            
            # デバッグ: 受信した画像を保存
            debug_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'utils', 'debug')
            os.makedirs(debug_dir, exist_ok=True)
            with open(os.path.join(debug_dir, 'received_image.png'), 'wb') as f:
                f.write(image_bytes)
            logger.info("受信した画像を保存しました: received_image.png")
            
        except Exception as e:
            logger.error(f"Base64デコードでエラー: {str(e)}")
            return jsonify({'error': 'Base64デコードに失敗しました'}), 400

        # Vision APIクライアントの初期化
        client = init_vision_client()
        logger.info("Vision APIクライアントの初期化成功")
        
        # OCR実行
        logger.info("document_text_detectionを使用してテキスト検出を開始...")
        image = vision.Image(content=image_bytes)
        
        # 言語ヒントを追加
        image_context = vision.ImageContext(
            language_hints=['ja']
        )
        
        # OCR実行
        response = client.document_text_detection(
            image=image,
            image_context=image_context
        )
        
        # レスポンスの詳細をログ出力
        logger.info("Vision APIレスポンスの詳細:")
        logger.info("1. text_annotations:")
        if response.text_annotations:
            logger.info(f"検出されたテキスト数: {len(response.text_annotations)}")
            for i, text in enumerate(response.text_annotations):
                logger.info(f"テキスト{i}: {text.description}")
                logger.info(f"信頼度: {text.confidence if hasattr(text, 'confidence') else 'N/A'}")
                logger.info(f"バウンディングボックス: {[(vertex.x, vertex.y) for vertex in text.bounding_poly.vertices]}")
        else:
            logger.info("テキストが検出されませんでした")
        
        logger.info("\n2. full_text_annotation:")
        if response.full_text_annotation:
            logger.info(f"全テキスト: {response.full_text_annotation.text}")
            logger.info("ページ情報:")
            for page in response.full_text_annotation.pages:
                logger.info(f"- 信頼度: {page.confidence}")
                logger.info(f"- 幅: {page.width}, 高さ: {page.height}")
        else:
            logger.info("full_text_annotationが空です")
        
        logger.info("\n3. エラー情報:")
        if response.error.message:
            logger.error(f"APIエラー: {response.error.message}")
        else:
            logger.info("エラーはありません")
            
        logger.info("\n4. 生レスポンス:")
        logger.info(str(response))
        
        # テキスト抽出結果の処理
        if response.text_annotations:
            # 最初の要素が全体のテキスト
            extracted_text = response.text_annotations[0].description
            logger.info(f"抽出されたテキスト: {extracted_text}")
            return jsonify({
                'text': extracted_text,
                'success': True
            })
        else:
            logger.info("テキストが検出されませんでした")
            logger.info("レスポンスの詳細:")
            logger.info(f"- full_text_annotation: {response.full_text_annotation}")
            logger.info(f"- text_annotations: {response.text_annotations}")
            logger.info(f"- error: {response.error}")
            return jsonify({
                'text': '',
                'success': False,
                'message': 'テキストが検出されませんでした'
            })
            
    except Exception as e:
        logger.error(f"OCR処理エラー: {str(e)}")
        return jsonify({
            'error': 'OCR処理に失敗しました',
            'details': str(e)
        }), 500

@notes_bp.route('/test_ocr', methods=['GET'])
def test_ocr():
    """テスト用のJPG画像でOCRをテスト"""
    try:
        # テスト画像を読み込み
        with open('test_image.jpg', 'rb') as image_file:
            content = image_file.read()
        
        # Vision APIクライアントの初期化
        client = init_vision_client()
        
        # OCR実行
        image = vision.Image(content=content)
        image_context = vision.ImageContext(
            language_hints=['ja']
        )
        
        response = client.document_text_detection(
            image=image,
            image_context=image_context
        )
        
        # レスポンスの詳細をログ出力
        logger.info("Vision APIレスポンスの詳細:")
        logger.info("1. text_annotations:")
        if response.text_annotations:
            logger.info(f"検出されたテキスト数: {len(response.text_annotations)}")
            for i, text in enumerate(response.text_annotations):
                logger.info(f"テキスト{i}: {text.description}")
                logger.info(f"信頼度: {text.confidence if hasattr(text, 'confidence') else 'N/A'}")
        else:
            logger.info("テキストが検出されませんでした")
            
        return jsonify({
            'success': True,
            'text': response.text_annotations[0].description if response.text_annotations else ''
        })
        
    except Exception as e:
        logger.error(f"テストOCRエラー: {str(e)}")
        return jsonify({'error': str(e)}), 500