
# しゃべるノート – 機能詳細仕様

## 1. 音声文字起こし機能
| 項目 | 詳細 |
|------|------|
| **ユーザーストーリー** | “私は 90 分の講義を録音し、終了後すぐにテキスト化したい。” |
| **フロー** | ①録音開始 → ②一時停止/再開 → ③停止 → ④Cloud Storage へアップロード → ⑤非同期 STT → ⑥Transcript 保存 → ⑦ノート自動生成 |
| **API** | `POST /media/upload-url` で署名付き URL 取得 → PUT でアップロード |
| **AC (受入条件)** | *最大90分*録音可 / WER≤12 % / ノート生成まで5 分以内 |
| **依存** | Google Cloud Speech‑to‑Text Async |

## 2. リアルタイム音声入力 (≤60 s)
| 項目 | 詳細 |
|------|------|
| **ユーザーストーリー** | “私は会議中に要点を声で入力し、即座にノートに反映したい。” |
| **フロー** | WebSocket 📡 → 同期 STT → キャンバスにテキスト挿入 |
| **AC** | 待機時間 ≤ 500 ms / 変換結果編集可 |

## 3. インポート機能 (URL / PDF / TXT)
| 項目 | 詳細 |
|------|------|
| **処理手順** | ①リンク/ファイル受領 → ②Cloud Run Worker が抽出 → ③Markdown 整形 → ④ノート生成 |
| **依存 API** | `html2text`, `pdfplumber`, GPT‑4o Cleanup |

## 4. 写真スキャン & OCR
| **AC** | 日本語精度 ≥ 95 % (文字サイズ ≥10 pt) |
| **UX** | 撮影直後にガイド付きクロッピング → Vision API OCR → テキスト/音声 |

## 5. AI チャットウィジェット
| Sub‑Feature | Prompt/モデル | 出力 |
|-------------|--------------|------|
| 校正 | `system:You are a proofreader…` GPT‑4o | 修正文 (diff) |
| 要約 | `system:Summarize …` GPT‑4o | 箇条書き概要 |
| 読み仮名 | Yahoo！かな漢字 API | ルビ付きテキスト |
| 辞書 | Yahoo！辞書 API | 語義 |
| リサーチ | Anthropic Search API → Claude | 要約＋ソース |

## 6. キャンバスツール
* **描画**: react‑native‑skia Inking (FPS ≥ 60)  
* **テキスト**: Dyslexia‑friendly font, adjustable spacing  
* **Undo/Redo**: Max 100 スタック (RAM ≈ 30 MB/page)

## 7. ダッシュボード
* ノート/フォルダ CRUD (Soft‑Delete, TTL 30 days)  
* AI タグ (Zero‑shot GPT categorization)  
* 応援リマインダー (Firebase Cloud Messaging, Cron daily 19:00 JST)

## 8. オフライン同期
* ローカル SQLite → `expo‑sqlite`  
* Incremental Sync Queue → Cloud Run REST  
* Conflict policy: `updated_at` winner + merge for canvases

---

## 付録: 画面 ⇄ 機能マッピング
| Screen ID | 主要機能 |
|-----------|----------|
| `welcomelogin` | SSO 認証 |
| `dashboard` | ノート一覧・検索・タグ |
| `canvaseditor` | キャンバス + AI Chat |
| `voiceoverlay` | 録音→STT |
| `photoscan` | OCR |
| `importdata` | URL/PDF Import |
| `aichatpanel` | AI サポート |
| `pagesettingssheet` | ページ管理 |
| `voicesettings` | TTS Voice |
| `importexportcenter` | Export / Drive 連携 |

---

