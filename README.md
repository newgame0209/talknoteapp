# しゃべるノート

![バージョン](https://img.shields.io/badge/version-0.1.0--alpha-blue)
![ライセンス](https://img.shields.io/badge/license-MIT-green)

ディスレクシア・ディスグラフィアの方向けの音声変換と文字起こしが搭載されたAIノートアプリ

---

## 📋 概要

しゃべるノートは、読み書きに困難を抱える方々のために設計された、マルチモーダルなノートアプリです。音声録音、リアルタイム文字起こし、手書き入力、OCR、AIアシスタントなどの機能を統合し、学習や仕事の効率を向上させます。

### 主な機能

- 🎤 **音声録音と文字起こし**: 最大90分の録音と高精度な文字起こし
- ✏️ **マルチ入力**: ペン、キーボード、音声、画像、PDFなど
- 🤖 **AIチャット**: 校正、要約、辞書、読み仮名、リサーチ機能
- 📱 **オフライン対応**: ローカルでの作業と後のクラウド同期
- 🔍 **OCR & インポート**: 写真からのテキスト抽出、PDF/URL取り込み

---

## 🚀 開発環境セットアップ

### 前提条件

- Node.js 18.x 以上
- Python 3.10 以上
- Docker & Docker Compose
- Git

### インストール手順

1. リポジトリのクローン

```bash
git clone https://github.com/newgame0209/talknoteapp.git
cd talknote
```

2. 環境変数の設定

```bash
cp .env.example .env
# .envファイルを編集して必要なAPIキーを設定
```

3. フロントエンド (React Native)

```bash
cd frontend
npm install
npx expo start
```

4. バックエンド (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## 🔑 API キーの取得方法

### Firebase

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを作成
3. Authentication を有効化 (Google, Apple, Email)
4. プロジェクト設定 > 全般 > マイアプリ > Webアプリ を追加
5. 表示される設定を `.env` ファイルにコピー

### Google Cloud (Speech-to-Text, Text-to-Speech, Vision API)

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成
3. 以下のAPIを有効化:
   - Cloud Speech-to-Text API
   - Cloud Text-to-Speech API
   - Cloud Vision API
   - Cloud Storage
4. 認証情報 > APIキーを作成
5. キーを `.env` ファイルの対応する変数 (`GOOGLE_STT_API_KEY`, `GOOGLE_TTS_API_KEY`) にコピー

### OpenAI

1. [OpenAI Platform](https://platform.openai.com/) にアクセス
2. アカウント作成・ログイン
3. API keys > Create new secret key
4. キーを `.env` ファイルの `OPENAI_API_KEY` にコピー

### Anthropic

1. [Anthropic Console](https://console.anthropic.com/) にアクセス
2. アカウント作成・ログイン
3. API Keys > Create Key
4. キーを `.env` ファイルの `ANTHROPIC_API_KEY` にコピー

---

## 🏗️ プロジェクト構造

```
talknote/
├── .env                  # 環境変数
├── .github/              # GitHub Actions CI/CD
├── docs/                 # プロジェクトドキュメント
├── frontend/             # React Native Expoアプリ
│   ├── app/              # アプリケーションコード
│   ├── assets/           # 画像・フォント
│   └── ...
├── backend/              # FastAPI バックエンド
│   ├── app/              # アプリケーションコード
│   ├── tests/            # テスト
│   └── ...
└── terraform/            # インフラストラクチャコード
```

---

## 📊 開発ロードマップ

詳細な実装計画は [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) を参照してください。

| フェーズ | 内容 | 完了目標 |
|---------|------|---------|
| α (Core) | 録音/STT・キャンバス・ローカル保存 | 2025-07-31 |
| β (Cloud) | クラウド同期・OCR/Import・AIチャット | 2025-09-15 |
| GA | ストア公開・課金基盤 | 2025-11-01 |

---

## 🧪 テスト

### フロントエンド

```bash
cd frontend
npm test               # Jest単体テスト実行
npm run test:coverage  # カバレッジレポート
npm run test:e2e       # Detox E2Eテスト
```

### バックエンド

```bash
cd backend
pytest                 # 全テスト実行
pytest --cov=app       # カバレッジレポート
```

---

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. feature ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

---

## 📝 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

---

## 📞 お問い合わせ

プロジェクト管理者: [your-email@example.com](mailto:your-email@example.com)

---

© 2025 Windsurf Engineering
