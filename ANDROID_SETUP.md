# Android設定手順

## 1. Firebaseコンソールでのandroid設定

### 手順:
1. Firebase Console → プロジェクト設定
2. アプリを追加 → Androidアイコン
3. 以下を入力:
   - **パッケージ名**: `com.talknote.app`
   - **アプリのニックネーム**: talknote-android
   - **デバッグ署名証明書SHA-1**: (下記コマンドで取得)

### SHA-1フィンガープリントの取得:
```bash
# Expo managed workflowの場合
npx expo install expo-dev-client
npx expo run:android

# 開発用証明書のSHA-1を取得
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# または、Expoから取得
npx expo credentials:manager
```

## 2. google-services.jsonの配置

ダウンロードしたgoogle-services.jsonファイルを以下に配置:
```
android/app/google-services.json
```

## 3. 想定されるgoogle-services.jsonの内容

プロジェクトID `talknote-446306` の場合:
```json
{
  "project_info": {
    "project_number": "309882614658",
    "project_id": "talknote-446306",
    "storage_bucket": "talknote-446306.appspot.com"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:309882614658:android:ANDROID_APP_ID",
        "android_client_info": {
          "package_name": "com.talknote.app"
        }
      },
      "oauth_client": [
        {
          "client_id": "WEB_CLIENT_ID.apps.googleusercontent.com",
          "client_type": 3
        }
      ],
      "api_key": [
        {
          "current_key": "ANDROID_API_KEY"
        }
      ]
    }
  ]
}
```

## 4. build.gradleの確認

`android/app/build.gradle`に以下が含まれていることを確認:
```gradle
apply plugin: 'com.google.gms.google-services'
```

## 5. 現在の不足要素
- ❌ google-services.json が未配置
- ❌ Android SHA-1 証明書の登録
- ❌ Firebase Console でのAndroidアプリ追加 