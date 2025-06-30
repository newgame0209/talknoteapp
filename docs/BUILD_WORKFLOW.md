# しゃべるノート  
## 開発ビルド & 動作確認マニュアル

> **目的**: React Native ／ Expo プロジェクトでファイル破損を避けつつ、素早く安全に PDCA を回すためのワークフローを標準化します。

---

## 0. 前提・ルール

| 項目 | 内容 |
| --- | --- |
| バージョン管理 | `git` を使用し **1 タスク → 1 コミット** を徹底する |
| ios / android ディレクトリ | **Git に追加しない**（`.gitignore` 済み） |
| Node バージョン | `nvm use 20` で固定 |
| パッケージ管理 | `npm`（必要に応じて `--legacy-peer-deps`） |
| 環境変数 | `.env.<environment>` と `eas.json` に集約 |

---

## 1. 日常開発（JS だけ変更する場合）

```bash
# 1. 依存が増えたらインストール
nvm use 20
npm install

# 2. Metro をクリーンに起動（キャッシュ破損防止）
# 自宅ネットワーク
NODE_ENV=home   npx expo start --clear
# オフィスネットワーク
NODE_ENV=office npx expo start --clear

# 3. 実機またはシミュレータで確認
#   - Expo Go でも開発ビルド(dev-client)でも OK
#   - 修正後は自動リロードで即確認

# 4. 問題なければコミット
git add .
git commit -m "feat: ✨ xxx を実装"
```

### 1-A. うまく起動しないときの "3 点セット"

```bash
watchman watch-del-all            # Watchman キャッシュ削除
rm -rf "$TMPDIR/metro-*"          # Metro キャッシュ削除
npx expo start --clear            # Metro 再起動
```

---

## 2. ネイティブ変更が必要なとき（ライブラリ追加・権限変更など）

```bash
# 0. 新しいブランチを作成
git switch -c feat/xxx-native-change

# 1. 例）expo-camera を追加
npm install expo-camera

# 2. Prebuild を 1 回だけ実行（--clean 推奨）
npx expo prebuild --clean
#    → ios/ と android/ ディレクトリが生成される (Git 管理外)

# 3. Xcode / gradle 設定(Info.plist など)を編集
#    編集が終わったら必ずコミット

# 4. ローカル開発ビルドを作成
eas build --local --profile development --platform ios   # or android

# 5. 生成された .ipa / .apk を端末にインストール
#    以後 JS だけの修正は expo start --dev-client で OK

# 6. もう一度ネイティブを触る場合は 2. から繰り返し

# 7. 完了したら main にマージ
```

---

## 3. 開発用 npm スクリプト例（`package.json`）

```json
{
  "scripts": {
    "start:home":    "NODE_ENV=home   expo start --clear",
    "start:office":  "NODE_ENV=office expo start --clear",
    "start:dev":     "expo start --dev-client --clear",
    "prebuild":      "expo prebuild --clean",
    "build:ios":     "eas build --local --profile development --platform ios",
    "build:android": "eas build --local --profile development --platform android",
    "clean":         "watchman watch-del-all && rimraf $TMPDIR/metro-*"
  }
}
```

---

## 4. トラブルシューティング早見表

| 症状 | コマンド | 備考 |
| --- | --- | --- |
| Metro が起動しない | `npm run clean && npm run start:home` | `--clear` がポイント |
| Xcode ビルドエラー | Delete DerivedData → `expo prebuild --clean` → 再ビルド | |
| パッケージ競合 | `npm ls <pkg>` で依存チェック → `npm dedupe` | |

---

## 5. CI / 本番ビルドのプロファイル

| Profile | 用途 | コマンド例 |
| --- | --- | --- |
| development | dev-client, ローカル動作確認 | `npm run build:ios` |
| preview | 社内テスト配布 | `eas build --profile preview --platform ios` |
| production | App Store / Play 配布 | `eas build --profile production --platform ios` |

---

## まとめ

1. **JS だけなら `expo start --clear` のみ**
2. **ネイティブ変更時だけ** Prebuild & Build
3. **Git commit を細かく** → 事故っても `git reset --hard` で復旧

このフローを守れば、ファイル破損やキャッシュ汚染によるビルド失敗を最小化し、開発サイクルを高速化できます。 