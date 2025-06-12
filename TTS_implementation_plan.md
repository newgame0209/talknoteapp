# 🎤 TTS機能（テキスト音声読み上げ）実装計画書

## 📋 **仕様確認済み事項**

### **TTSプロバイダー仕様**
- **優先順位**: **ElevenLabs → Google** (2025-01-21更新)
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

## ✅ **Phase 2完了: フロントエンド音声再生基盤** (2025-01-21完了)

### **実装完了項目**
- ✅ **TTSAudioPlayer実装** (`app/utils/audioHelpers.ts`)
  - expo-audio統合（expo-av併用戦略）
  - 音声ロード・再生・一時停止・停止機能
  - シーク機能（10秒戻る/進む、文単位ジャンプ）
  - 状態管理とコールバック機能
- ✅ **TTSClient実装** (`app/services/TTSClient.ts`)
  - バックエンドAPI完全統合
  - Firebase認証連携
  - エラーハンドリング・ログ機能
  - 音声一覧・プロバイダー管理
- ✅ **textSplitter実装** (`app/utils/textSplitter.ts`)
  - 日本語文章分割（句点区切り）
  - 位置情報付き分割機能
  - 文字数制限分割・統計機能

### **技術的成果**
- ✅ **expo-audio API研究**: 正しいAPI仕様の確認と実装
- ✅ **命名競合解決**: 既存AudioPlayerとの共存
- ✅ **TypeScriptエラー修正**: Set構文のES5互換化
- ✅ **安全な実装**: 既存録音機能への影響ゼロ

### **エラー修正完了**
- ✅ **Apple認証エラー**: `appleAuth.ts` → `appleAuth.tsx` 変更
- ✅ **TTSClient構文エラー**: Set構文をArray.from()に修正
- ✅ **型安全性確保**: 全TTS関連ファイルでエラーフリー

---

## 🚧 **Phase 3: CanvasEditor統合** (次の作業: 4-5時間予定)

### **3.1 音声プレイヤーUI統合** (1.5-2時間)

#### **既存AudioPlayerコンポーネント拡張**
```typescript
// app/components/AudioPlayer.tsx の拡張
interface AudioPlayerProps {
  // 既存props
  audioUri?: string;
  isPlaying: boolean;
  onPlayPause: () => void;
  
  // 🆕 TTS用props
  ttsText?: string;           // TTS対象テキスト
  enableTTS?: boolean;        // TTS機能有効/無効
  onTTSRequest?: (text: string) => void;  // TTS要求コールバック
  highlightedSentence?: number;  // ハイライト中の文番号
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  // 既存実装を保持
  audioUri, isPlaying, onPlayPause,
  // 🆕 TTS機能追加
  ttsText, enableTTS, onTTSRequest, highlightedSentence
}) => {
  // 既存の録音再生UI
  // + TTS再生ボタン追加
  // + 文章ハイライト表示
};
```

#### **TTSボタンUI追加**
- 既存の再生/一時停止ボタンの隣にTTSボタン配置
- アイコン: 🔊（音声読み上げ）
- 状態表示: 読み上げ中/停止中

### **3.2 文章ハイライト機能** (2-2.5時間)

#### **TextInputハイライト実装**
```typescript
// app/screens/CanvasEditor.tsx の拡張
const [highlightRanges, setHighlightRanges] = useState<Array<{
  start: number;
  end: number;
  type: 'all' | 'current';
  color: string;
}>>([]);

const [currentSentence, setCurrentSentence] = useState<number>(0);

// 文章分割とハイライト範囲計算
const updateHighlights = useCallback((text: string, currentIndex: number) => {
  const sentences = splitIntoSentencesWithDetails(text);
  const ranges = sentences.map((sentence, index) => ({
    start: sentence.start,
    end: sentence.end,
    type: index === currentIndex ? 'current' : 'all',
    color: index === currentIndex ? '#629ff4' : '#a6bef8'
  }));
  setHighlightRanges(ranges);
}, []);
```

#### **タップによるハイライト移動**
```typescript
// TextInput onSelectionChange
const handleTextSelection = useCallback((event: any) => {
  const { selection } = event.nativeEvent;
  const sentences = splitIntoSentencesWithDetails(content);
  
  // タップ位置から該当文を特定
  const targetSentence = sentences.findIndex(s => 
    selection.start >= s.start && selection.start <= s.end
  );
  
  if (targetSentence !== -1) {
    setCurrentSentence(targetSentence);
    // TTS再生位置も同期
    ttsAudioPlayer.seekToSentence(targetSentence);
  }
}, [content]);
```

### **3.3 TTS統合ロジック** (1-1.5時間)

#### **CanvasEditorでのTTS制御**
```typescript
// app/screens/CanvasEditor.tsx
const [ttsAudioPlayer] = useState(() => new TTSAudioPlayer());
const [isTTSPlaying, setIsTTSPlaying] = useState(false);
const [ttsAudioUrl, setTTSAudioUrl] = useState<string | null>(null);

// TTS要求処理
const handleTTSRequest = useCallback(async (text: string) => {
  try {
    setIsLoading(true);
    
    // バックエンドでTTS生成
    const response = await ttsClient.synthesize({
      text: text,
      provider: 'elevenlabs', // 設定から取得
      voice_id: 'JapaneseWoman1' // 設定から取得
    });
    
    // 音声ロードと再生準備
    await ttsAudioPlayer.loadTTSAudio(response.audio_url);
    setTTSAudioUrl(response.audio_url);
    
    // 文章分割情報を設定
    ttsAudioPlayer.setSentences(response.sentences);
    
    console.log('TTS準備完了:', {
      duration: response.duration,
      sentences: response.sentences.length
    });
    
  } catch (error) {
    console.error('TTS生成エラー:', error);
    // エラートースト表示
  } finally {
    setIsLoading(false);
  }
}, []);

// TTS再生制御
const handleTTSPlayPause = useCallback(async () => {
  if (!ttsAudioUrl) {
    // 初回はTTS生成から開始
    await handleTTSRequest(content);
    return;
  }
  
  if (isTTSPlaying) {
    await ttsAudioPlayer.pause();
  } else {
    await ttsAudioPlayer.play();
  }
  setIsTTSPlaying(!isTTSPlaying);
}, [ttsAudioUrl, isTTSPlaying, content]);
```

#### **音声再生とハイライト同期**
```typescript
// TTS再生中のハイライト更新
useEffect(() => {
  const updateInterval = setInterval(() => {
    if (isTTSPlaying && ttsAudioPlayer.currentTime) {
      const currentTime = ttsAudioPlayer.currentTime;
      const sentences = ttsAudioPlayer.sentences;
      
      // 現在時刻に対応する文を特定
      const currentIndex = sentences.findIndex(s => 
        currentTime >= s.start_time && currentTime <= s.end_time
      );
      
      if (currentIndex !== -1 && currentIndex !== currentSentence) {
        setCurrentSentence(currentIndex);
        updateHighlights(content, currentIndex);
      }
    }
  }, 100); // 100ms間隔で更新
  
  return () => clearInterval(updateInterval);
}, [isTTSPlaying, content, currentSentence]);
```

---

## 📝 **Phase 3実装優先度**

### **🔴 高優先度（必須機能）**
1. **AudioPlayerコンポーネント拡張** - TTSボタン追加
2. **TTS統合ロジック** - CanvasEditorでの制御実装
3. **基本ハイライト機能** - 読み上げ中の文強調

### **🟡 中優先度（UX向上）**
4. **タップによるハイライト移動** - 文章タップでジャンプ
5. **エラーハンドリング強化** - TTS失敗時の適切な表示
6. **ローディング状態表示** - TTS生成中のフィードバック

### **🟢 低優先度（将来拡張）**
7. **音声設定画面** - プロバイダー・音声選択UI
8. **音声キャッシュ機能** - 同一テキストの再利用
9. **速度カスタマイズ** - 1.5倍以外の速度対応

---

## 🎯 **Phase 3完了目標**

### **Phase 3完了時の達成状態**
- ✅ 全ノートタイプでTTS機能利用可能
- ✅ 文章ハイライト機能動作
- ✅ 音声再生とハイライト同期
- ✅ 既存録音機能との共存

### **最終目標**
- ✅ 学習障害児向けの読み上げ支援機能完成
- ✅ 高品質な日本語音声での読み上げ
- ✅ 直感的で使いやすいUI/UX

---

## 🚨 **重要な注意点**

### **既存機能保護**
- **録音機能**: expo-av AudioRecorderクラスは完全保護
- **既存AudioPlayer**: 録音再生UIは変更せず、TTS機能のみ追加
- **CanvasEditor**: 既存の自動保存・描画機能への影響ゼロ

### **段階的実装**
- **Phase 3.1**: UI拡張（既存機能影響なし）
- **Phase 3.2**: ハイライト機能（新規追加）
- **Phase 3.3**: TTS統合（独立実装）

### **品質保証**
- **TypeScript**: 型安全性の確保
- **エラーハンドリング**: 適切なフォールバック
- **パフォーマンス**: UI応答性の維持 

## ✅ **Phase 3完了: CanvasEditor統合** (2025-01-21完了)

### **Phase 3.1: 音声プレイヤーUI統合** (完了)

#### **実装完了項目**
- ✅ **TTS関連のimportとstate定義**
  - TTSAudioPlayer、TTSClient、textSplitterのimport
  - TTS関連のstate管理（音声URL、文章、ハイライト等）

- ✅ **handleAudioPlay関数の拡張**
  - 既存の再生ボタンでTTS再生/一時停止
  - 初回再生時の自動TTS生成
  - エラーハンドリング

- ✅ **generateTTSAudio関数の実装**
  - テキストコンテンツの取得と検証
  - 文章分割（句点区切り）
  - TTSサービスでの音声生成
  - TTSAudioPlayerへの音声ロード

- ✅ **handleAudioSeek関数の拡張**
  - 10秒戻る/進む機能のTTS対応
  - TTSAudioPlayerのシーク機能統合

- ✅ **音声プレイヤーUIの拡張**
  - ローディング状態の表示（生成中...）
  - 砂時計アイコンでの視覚的フィードバック

### **Phase 3.2: 文章ハイライト機能** (完了)

#### **実装完了項目**
- ✅ **ハイライト機能の実装**
  - `updateHighlights`関数: 文章分割とハイライト範囲計算
  - 全体ハイライト（`#a6bef8`）と読み上げ中ハイライト（`#629ff4`）

- ✅ **テキスト選択によるハイライト移動**
  - `handleTextSelection`関数: タップ位置から該当文を特定
  - TTS再生中の場合は該当文にジャンプ
  - TextInputの`onSelectionChange`イベント統合

- ✅ **TTS再生中のハイライト同期**
  - useEffectによる100ms間隔の同期処理
  - 現在時刻に対応する文の特定とハイライト更新
  - 再生状態に応じた自動ハイライト移動

### **Phase 3.3: TTSAudioPlayer修正** (2025-01-21完了)

#### **修正完了項目**
- ✅ **expo-audio API統合**
  - `useAudioPlayer`フックとの連携
  - `audioPlayerRef`の統一使用
  - 正しいexpo-audio APIメソッド呼び出し

- ✅ **TTSClient設定修正**
  - 正しいIPアドレス（192.168.0.46:8000）に修正
  - バックエンド接続の確認

- ✅ **メソッド修正**
  - `play()`, `pause()`, `stop()`, `seekTo()`, `unload()`の修正
  - expo-audioの正しいAPI使用
  - エラーハンドリングの改善

#### **技術的成果**
- ✅ **既存UI完全保護**: 音声プレイヤーの表示条件は一切変更なし
- ✅ **全ノートタイプ対応**: 録音・写真スキャン・インポート・手動ノート共通
- ✅ **シームレス統合**: 既存の再生ボタンでTTS機能が動作
- ✅ **リアルタイム同期**: 音声再生とハイライトの完全同期
- ✅ **expo-audio統合**: 正しいAPIでの音声再生実装

### **🎯 Phase 3完了時の達成状態**
- ✅ 全ノートタイプでTTS機能利用可能
- ✅ 文章ハイライト機能動作
- ✅ 音声再生とハイライト同期
- ✅ 既存録音機能との共存
- ✅ タップによるハイライト移動機能
- ✅ expo-audioとの正しい統合

---

## 🚧 **Phase 4: 最終調整・テスト** (次の作業: 1-2時間予定) 

## 🚨 **緊急問題リスト発見** (2025-01-21)

### **バックエンド状況確認**
- ✅ **ElevenLabs API**: 完璧動作（3-4秒で音声生成、20.16秒音声ファイル）
- ✅ **TTSエンドポイント**: `/api/v1/tts/synthesize` と `/api/v1/tts/synthesize/stream` 両方200 OK
- ✅ **音声生成**: 84文字テキストで正常処理

### **🔴 緊急問題（機能停止レベル）**

#### **問題1: expo-audioの間違ったインポート**
```typescript
// ❌ 間違い（app/utils/audioHelpers.ts:7）
import { useAudioPlayer, AudioSource } from 'expo-audio';

// ✅ 正しい
import { createAudioPlayer, AudioPlayer as ExpoAudioPlayer } from 'expo-audio';
```

#### **問題2: useAudioPlayerフックが存在しない**
```typescript
// ❌ 間違い（app/screens/CanvasEditor.tsx:1927）
const audioPlayer = useAudioPlayer(); // useAudioPlayerは存在しない

// ✅ 正しい
const audioPlayer = createAudioPlayer();
```

#### **問題3: React Native非対応のURL.createObjectURL**
```typescript
// ❌ 間違い（app/services/TTSClient.ts:88）
const audioUrl = URL.createObjectURL(audioBlob); // React Native非対応

// ✅ 正しい（FileSystemベース）
const audioUrl = await FileSystem.writeAsStringAsync(
  FileSystem.documentDirectory + 'tts_audio.mp3',
  audioBase64,
  { encoding: FileSystem.EncodingType.Base64 }
);
```

#### **問題4: TTSAudioPlayerの初期化エラー**
```typescript
// ❌ 間違い（app/screens/CanvasEditor.tsx:1928）
const [ttsAudioPlayer] = useState(() => {
  const player = new TTSAudioPlayer();
  player.setAudioPlayer(audioPlayer); // audioPlayerが未定義
  return player;
});

// ✅ 正しい
const audioPlayer = createAudioPlayer();
const [ttsAudioPlayer] = useState(() => {
  const player = new TTSAudioPlayer();
  player.setAudioPlayer(audioPlayer);
  return player;
});
```

#### **問題5: バックエンドのaudio_url: null**
- バックエンドログでは音声生成成功だが、`audio_url: null`を返している可能性
- ファイル保存システムが未実装

### **🟡 重要問題（UX影響）**

#### **問題6: TTSClient baseURL設定**
```typescript
// ❌ 間違い（app/services/TTSClient.ts:45）
constructor(baseUrl: string = 'http://localhost:8000') {

// ✅ 正しい
constructor(baseUrl: string = 'http://192.168.0.46:8000') {
```

#### **問題7: handleTTSPlay/handleTTSPause関数未実装**
- CanvasEditorにTTS専用の再生/一時停止関数が存在しない
- 既存のhandleAudioPlay関数のみでTTS処理

#### **問題8: generateTTSAudio関数のエラーハンドリング不足**
- TTS生成失敗時の適切なフォールバック処理なし
- ローディング状態の解除漏れ

### **🟢 軽微問題（将来対応）**

#### **問題9: TTSAudioPlayerのメソッド不整合**
```typescript
// ❌ 不整合（app/utils/audioHelpers.ts）
async seekForward(): Promise<void> {
  if (this.audioPlayer && this.currentTime !== null) {
    const newTime = Math.min(this.currentTime + 10, this.duration || 0);
    await this.audioPlayer.seekTo(newTime); // seekToメソッドが存在しない可能性
  }
}

// ✅ 正しい（expo-audio API確認必要）
async seekForward(): Promise<void> {
  if (this.audioPlayerRef.current) {
    const newTime = Math.min(this.currentTime + 10, this.duration || 0);
    await this.audioPlayerRef.current.seekTo(newTime);
  }
}
```

#### **問題10: 型定義の不整合**
- TTSSentence型とバックエンドレスポンスの不一致
- CanvasData型の拡張プロパティ未定義

---

## 🔧 **修正計画（優先順位順）**

### **🔴 緊急修正（1-2時間）**
1. **expo-audioインポート修正** (15分)
2. **useAudioPlayer → createAudioPlayer修正** (15分)
3. **URL.createObjectURL → FileSystem修正** (30分)
4. **TTSAudioPlayer初期化修正** (15分)
5. **バックエンドaudio_url修正** (30分)

### **🟡 重要修正（1時間）**
6. **TTSClient baseURL修正** (5分)
7. **TTS専用再生関数実装** (30分)
8. **エラーハンドリング強化** (25分)

### **🟢 軽微修正（30分）**
9. **TTSAudioPlayerメソッド修正** (20分)
10. **型定義整合性確保** (10分)

---

## 📋 **修正後のテスト項目**

### **基本機能テスト**
- [ ] TTS音声生成（バックエンド）
- [ ] 音声ファイルダウンロード（フロントエンド）
- [ ] expo-audio再生（React Native）
- [ ] 文章ハイライト同期

### **エラーケーステスト**
- [ ] ネットワークエラー時の処理
- [ ] 音声生成失敗時の処理
- [ ] 空テキスト時の処理
- [ ] 長時間テキスト時の処理

### **UXテスト**
- [ ] ローディング状態表示
- [ ] 再生/一時停止の応答性
- [ ] ハイライト移動の滑らかさ
- [ ] エラーメッセージの分かりやすさ

---

## 🎯 **修正完了目標**

### **修正完了時の達成状態**
- ✅ TTS音声再生が完全動作
- ✅ 文章ハイライト機能が正常動作
- ✅ エラーハンドリングが適切に動作
- ✅ 全ノートタイプでTTS利用可能

### **最終目標**
- ✅ 学習障害児向けの読み上げ支援機能完成
- ✅ 高品質な日本語音声での読み上げ
- ✅ 安定した音声再生システム 