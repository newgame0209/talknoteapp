#!/bin/bash

# しゃべるノート 環境切り替えスクリプト
# 使用方法: ./switch-env.sh [office|home]

ENV_TYPE=${1:-office}

if [ "$ENV_TYPE" = "office" ]; then
    echo "🏢 オフィス環境に切り替え中..."
    rm -f .env
    ln -s .env.office .env
    echo "✅ オフィス環境に切り替え完了 (.env.office)"
elif [ "$ENV_TYPE" = "home" ]; then
    echo "🏠 自宅環境に切り替え中..."
    rm -f .env
    ln -s .env.home .env
    echo "✅ 自宅環境に切り替え完了 (.env.home)"
else
    echo "❌ エラー: 不正な環境タイプです"
    echo "使用方法: ./switch-env.sh [office|home]"
    exit 1
fi

# 現在のIP設定を表示
echo ""
echo "📋 現在の設定:"
grep -E "(API_URL|STT_BASE_URL)" .env || echo "設定ファイルが見つかりません"
echo ""
echo "🔄 開発サーバーを再起動してください："
echo "  cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo "  python3 stt_server.py" 