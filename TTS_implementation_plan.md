# 🎤 TTS機能（テキスト音声読み上げ）実装計画書

## 📋 **仕様確認済み事項**

### **TTSプロバイダー仕様**
- **優先順位**: ~~MiniMax → ElevenLabs → Google~~ **ElevenLabs → Google** (2025-01-21更新)
- **ユーザー選択**: 音声設定で切り替え可能
- **言語対応**: 日本語のみ
- **音声種類**: 男性/女性、デフォルトタイプ選択可能

### **音声再生仕様**
- **速度**: 1.5倍速のみ（既存UIに合わせて）
- **プレイヤー**: 既存AudioPlayerクラス活用
- **操作**: 再生/一時停止、10秒戻る/進む、1.5x速度

### **ハイライト仕様**
- **単位**: 文単位（句点「。」区切り）
- **全体ハイライト**: `#a6bef8`
- **読み上げ中**: `#629ff4`
- **文章タップ**: タップ箇所にハイライト移動
- **同期**: プロバイダー再生速度と同期

### **対応ノートタイプ**
1. **録音ノート**: 文字起こしテキスト読み上げ
2. **写真スキャンノート**: OCR変換テキスト読み上げ
3. **インポートノート**: インポートテキスト読み上げ
4. **手動ノート**: 手書き+入力テキスト読み上げ

---

## ✅ **Phase 1完了: バックエンドTTS API実装** (2025-01-21完了)

### **実装完了項目**
- ✅ TTSプロバイダー抽象化（BaseTTSProvider）
- ✅ ElevenLabsTTSProvider実装（日本語音声7種類対応）
- ✅ GoogleTTSProvider実装（フォールバック用）
- ✅ TTSService統合（プロバイダー切り替え・フォールバック機能）
- ✅ REST API実装（/api/v1/tts/synthesize, /api/v1/tts/status, /api/v1/tts/voices）
- ✅ 日本語音声設定（JapaneseMan1-5, JapaneseWoman1-2）

### **最終設定**
```bash
# 環境変数設定
TTS_PROVIDER=elevenlabs
TTS_FALLBACK_PROVIDERS=["google"]
ELEVENLABS_API_KEY=sk_c51ad893a84f5ed76c496333f21bce5263352eff5d4b0663
GOOGLE_APPLICATION_CREDENTIALS=/Users/mishimayu/Desktop/jsonkey/talknoteapp-459511-319c3d4492f0.json
```

### **テスト結果**
- ✅ ElevenLabs日本語女性音声（JapaneseWoman1）: 1.81秒処理時間
- ✅ ElevenLabs日本語男性音声（JapaneseMan1）: 1.53秒処理時間
- ✅ フォールバック機能: Google TTS正常動作確認
- ✅ 音声品質: confidence 0.92（高品質）

### **重要な変更点**
1. **MiniMax除外**: API key問題により完全削除
2. **ElevenLabsメイン化**: 高品質日本語音声を優先
3. **URL修正**: ElevenLabs APIのURL重複バグ修正（`/v1/v1/` → `/v1/`）

---

## 🚨 **今回の反省点と注意点**

### **作業時間の問題**
- **予定**: 2-3時間
- **実際**: 3時間以上（デバッグ・設定調整含む）
- **原因**: 
  1. 複数プロバイダーの同時設定による混乱
  2. 環境変数設定の複雑さ
  3. APIキー管理の不備
  4. URL設定ミス

### **技術的な注意点**
1. **環境変数の優先順位**:
   - 環境変数 > settings.py のデフォルト値
   - サーバー再起動が必要（設定変更時）

2. **ElevenLabs API仕様**:
   - Base URL: `https://api.elevenlabs.io/v1`
   - エンドポイント: `/text-to-speech/{voice_id}` （`/v1/`重複注意）
   - APIキー形式: `sk_` で始まる長い文字列

3. **Google TTS認証**:
   - サービスアカウントキーファイルが必須
   - `GOOGLE_APPLICATION_CREDENTIALS`環境変数で指定

### **今後の改善点**
1. **設定管理の簡素化**: .envファイル活用
2. **エラーハンドリング強化**: より詳細なログ出力
3. **テスト自動化**: プロバイダー切り替えテストの自動化
4. **ドキュメント整備**: 設定手順の明文化

---

## 🏗️ **次のPhase 2: フロントエンド音声再生基盤** (予定: 3-4時間)

### **2.1 expo-audio移行**
```typescript
// app/utils/audioHelpers.ts の修正
import { Audio } from 'expo-audio'; // expo-av から変更

export class AudioPlayer {
  private audio: Audio.AudioPlayer | null = null;
  
  async loadSound(uri: string): Promise<void> {
    this.audio = new Audio.AudioPlayer(uri);
    // 新しいAPIに合わせて修正
  }
  
  // 既存メソッドを新API仕様に合わせて修正
}
```

### **2.2 TTSクライアントサービス**
```typescript
// app/services/TTSClient.ts
export interface TTSRequest {
  text: string;
  provider?: 'elevenlabs' | 'google';
  voice_id?: string;
  speed?: number;
}

export interface TTSResponse {
  audio_url: string;
  duration: number;
  sentences: Array<{
    text: string;
    start_time: number;
    end_time: number;
  }>;
}

export class TTSClient {
  async requestTTS(request: TTSRequest): Promise<TTSResponse> {
    const response = await fetch('/api/v1/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    return response.json();
  }
}
```

### **2.3 文章分割ユーティリティ**
```typescript
// app/utils/textSplitter.ts
export function splitIntoSentences(text: string): string[] {
  // 句点「。」で文章を分割
  return text.split('。').filter(sentence => sentence.trim().length > 0);
}
```

---

### **Phase 3: CanvasEditor統合** (予定: 4-5時間)

#### **3.1 音声プレイヤーUI統合**
- 既存AudioPlayerコンポーネントの拡張
- TTSボタンの追加
- ハイライト表示機能

#### **3.2 文章ハイライト機能**
- 読み上げ中の文章ハイライト
- タップによるハイライト移動
- 再生位置同期

#### **3.3 音声設定画面**
- プロバイダー選択UI
- 音声タイプ選択
- 速度設定（1.5倍固定）

---

## 📝 **実装優先度**

### **高優先度（必須機能）**
1. ✅ バックエンドTTS API（完了）
2. 🔄 フロントエンド音声再生基盤
3. 🔄 CanvasEditor統合

### **中優先度（UX向上）**
4. 音声設定画面
5. ハイライト機能
6. エラーハンドリング強化

### **低優先度（将来拡張）**
7. 音声キャッシュ機能
8. オフライン音声合成
9. 音声速度カスタマイズ

---

## 🎯 **完了目標**

### **Phase 2完了時**
- expo-audio移行完了
- TTSクライアント実装完了
- 基本的な音声再生機能動作

### **Phase 3完了時**
- 全ノートタイプでTTS機能利用可能
- 文章ハイライト機能動作
- 音声設定画面実装完了

### **最終目標**
- 学習障害児向けの読み上げ支援機能完成
- 高品質な日本語音声での読み上げ
- 直感的で使いやすいUI/UX 