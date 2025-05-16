
# しゃべるノート – フロントエンド実装仕様 (修正版 / Expo)

## 1. プロジェクト構成
```
/app
  /assets               # 画像・フォント
  /components           # UI atom / molecule
  /hooks                # カスタムフック
  /navigation           # React Navigation stacks
  /screens              # 14 画面
  /services
     api.ts             # axios wrapper (ID Token付き)
     sttSocket.ts       # WebSocket ↔ Google STT Proxy
  /store                # Zustand + React Query
  /utils
     audioHelpers.ts    # expo-av 録音ラッパ + wav encoder
app.json / eas.json
```

## 2. 音声フロー & ライブラリ
| フェーズ | ライブラリ | 説明 |
|----------|-----------|------|
| **録音・再生** | **expo-av** | デバイスマイクで WAV/FLAC 16 kHz をローカルにバッファし、プレビュー再生も提供 |
| **エンコード・アップロード** | `audioHelpers.ts` + `expo-file-system` | 録音停止時にファイル保存 → `/media/upload-url` で署名 URL を取得 → PUT |
| **文字起こし / 音声合成** | *(サーバ側)* Google Speech‑to‑Text / Text‑to‑Speech | Frontend は REST で結果取得 & 再生用 mp3 URI を受領 |
| **リアルタイムSTT (≤60 s)** | **WebSocket** (`/stt/stream`) | マイクの PCM チャンクを 250 ms ごとに送出し、変換結果を即時挿入 |

> ➜ **expo-av は “ローカル録音 & 再生” のみ** に使用し、  
> **Google API 呼び出しはすべてバックエンド経由**。クライアントから直接 Google Cloud API を呼び出すことはありません。

## 3. Firebase 認証
```ts
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithIdp } from 'firebase/auth';
import axios from './services/api';

const firebaseConfig = { /* .env */ };
initializeApp(firebaseConfig);
const auth = getAuth();

async function googleLogin() {
  const credential = await GoogleAuthProvider.credential(/* ... */);
  const userCred = await signInWithCredential(auth, credential);
  const idToken = await userCred.user.getIdToken();
  axios.defaults.headers.common['Authorization'] = `Bearer ${idToken}`;
}
```

## 4. オフライン同期
* SQLite (expo-sqlite) で `notebooks`, `pages` をキャッシュ  
* `SyncQueue` (Zustand slice) が offline → online で差分 PUT  
* `OfflineToast` で `queue.length` と失敗通知を表示  

## 5. アクセシビリティ
| 機能 | 実装ポイント |
|------|--------------|
| UD フォント | `expo-font` preload “UD Digi教科書” & “OpenDyslexic” |
| 行間調整 | Tailwind dynamic `leading-[n]` via Slider |
| 高コントラスト | `ColorSchemeContext` + Tailwind class merge |
| リーディングルーラー | `react-native-skia` Overlay mask, pinch resize |

## 6. スクリーン一覧とナビゲーション

### ナビゲーションスタック
```
AppRoot
 ├─ AuthStack
 │   ├─ Onboarding
 │   └─ WelcomeLogin
 └─ MainStack (authenticated)
     ├─ Dashboard
     ├─ CanvasEditor
     ├─ VoiceOverlay
     ├─ PhotoScan
     ├─ ImportData
     ├─ PageSettingsSheet (modal)
     ├─ VoiceSettings (modal)
     ├─ ImportExportCenter
     └─ Settings
```

### 主要スクリーンとコンポーネント
| スクリーン名 | 特徴 | 主要コンポーネント |
|------------|------|----------------|
| `Onboarding` | 初回起動時の機能説明 | `OnboardingSlider`, `FontSelector` |
| `WelcomeLogin` | SSO認証 | `GoogleSignInButton`, `AppleSignInButton` |
| `Dashboard` | ノート一覧 | `NoteCard`, `FolderList`, `SearchBar` |
| `CanvasEditor` | ノート編集 | `SkiaCanvas`, `ToolBar`, `AIChatWidget` |
| `VoiceOverlay` | 録音・再生 | `RecordButton`, `WaveformVisualizer` |
| `PhotoScan` | OCR機能 | `CameraView`, `CropOverlay` |
| `PageSettingsSheet` | ページ設定 | `PageList`, `TemplateSelector` |
| `VoiceSettings` | TTS音声設定 | `VoiceSelector`, `SpeedControl` |

## 7. テスト & ビルド
* Unit: Jest + RTL  
* E2E: Detox – "record → stop → transcript表示" シナリオ  
* `eas build --profile production --platform ios,android`  
* OTA: `eas update --branch production`  

---
