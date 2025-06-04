# Google Cloud Console 設定手順

## 1. プロジェクト設定
- プロジェクトID: `talknote-446306`
- プロジェクト名: TalkNote

## 2. OAuth 2.0 認証情報の設定

### 手順:
1. Google Cloud Console → 認証情報
2. 「認証情報を作成」→「OAuth 2.0 クライアントID」

### 必要な認証情報:

#### ✅ iOSアプリケーション
- **名前**: talknote-ios
- **バンドルID**: `com.talknote.app`
- **Team ID**: `26C27955TZ` (app.jsonから)
- **生成されるクライアントID**: `309882614658-gql2t1kodc74bt80qeaqbq89gsguehm1.apps.googleusercontent.com`

#### ⚠️ Webアプリケーション（要確認・修正）
- **名前**: talknote-web
- **承認済みJavaScript生成元**: 
  - `http://localhost:8081`
  - `http://192.168.0.46:8081`
- **承認済みリダイレクトURI**: 
  - `http://localhost:8081/--/auth/callback`
  - `http://192.168.0.46:8081/--/auth/callback`
  - `com.talknote.app://oauth/callback`
- **期待されるクライアントID**: `309882614658-qsa53noidnbuinjanvpsoivo85cfmj3q.apps.googleusercontent.com`

#### 📱 Androidアプリケーション（必要に応じて）
- **名前**: talknote-android
- **パッケージ名**: `com.talknote.app`
- **SHA-1証明書フィンガープリント**: Expoの開発用証明書

## 3. API有効化
以下のAPIを有効化:
- Firebase Authentication API
- Google Sign-In API
- Identity and Access Management (IAM) API

## 4. Firebase Authentication設定
Firebase Console → Authentication → Sign-in methods:
- ✅ Google (有効化済み)
- ✅ Apple (有効化済み)
- ✅ メール/パスワード (有効化済み)

## 5. 現在の設定値（確認用）
```
iOS Client ID: 309882614658-gql2t1kodc74bt80qeaqbq89gsguehm1.apps.googleusercontent.com
Web Client ID: 309882614658-qsa53noidnbuinjanvpsoivo85cfmj3q.apps.googleusercontent.com
Project ID: talknote-446306
Bundle ID: com.talknote.app
URL Scheme: com.googleusercontent.apps.309882614658-gql2t1kodc74bt80qeaqbq89gsguehm1
``` 