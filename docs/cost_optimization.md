# しゃべるノート – コスト最適化運用ガイド

> 最終更新: 2025-05-20
>
> 本ドキュメントは、音声系 API・クラウドインフラ費用を段階的に抑制しながら可用性と UX を維持するための運用方針をまとめたものです。

---

## 1. 成功指標 (Cost KPIs)
| 指標 | 目標値 | 備考 |
|------|-------|------|
| 月間クラウドコスト / 課金ユーザー | ≤ 40 % (ARPU 比) | ARPU = 2,000 円想定 |
| STT + TTS がコスト全体に占める割合 | ≤ 70 % | キャッシュ効率改善で削減 |
| Budget Alert 発火回数 | 0 / 月 | 予算内運用 |

---

## 2. プロバイダー抽象化 & 自動ルーティング
```
ITTSProvider
  ├── GoogleTTSProvider
  ├── MiniMaxTTSProvider
  ├── LocalTTSProvider (Coqui / VITS)
ISTTProvider
  ├── GoogleSTTProvider
  ├── WhisperProvider (gpu)
  └── ParakeetProvider
```
- `cost(sec|text)` メソッドを実装しリアルタイムで見積
- ルーティング条件（Config / FeatureFlag）
  1. **残予算 < 20 %** → OSS / ローカルにフェイルオーバー
  2. **障害発生** → 第二候補へ自動切替え
  3. **短文 (≤120 文字)** → ローカル TTS 優先
- 実装箇所: `app/services/audioRouter.ts` & `aiRouter.py`

---

## 3. キャッシュによる再利用
### 3.1 TTS mp3 キャッシュ
| ステップ | 処理 |
|----------|------|
| ① | `sha256(text)` をキーに SQLite (端末) で検索 |
| ② | ヒット→ローカル or GCS から mp3 取得 |
| ③ | ミス→TTS API 生成→GCS `tts/{hash}.mp3` 保存→キー登録 |

- mp3 推定 48 kbps → 1 分 ≈ 250 KB
- 毎月 10 万分キャッシュしても 25 GB ≒ 0.5 USD/月

### 3.2 STT キャッシュ
- `audio_sha256` + `model` をキーに Cloud SQL `stt_cache` テーブル
- 録音編集時は diff 抽出し **追加分のみ** 再変換

---

## 4. データ前処理によるコスト削減
| 手法 | 期待削減 | 実装 | Sprint |
|------|---------|-----|--------|
| **無音カット** | STT 秒数 −20〜40 % | `sox silence/-l` (media-worker) | 4 |
| **重要箇所のみ TTS** | TTS 秒数 −30 % | UI でハイライト再生 | 6 |
| **音声倍速再生** | ユーザー体験向上 + 時間圧縮 | expo-av rate調整 | 5 |

---

## 5. OSS / 自社モデルの活用
| モデル | 用途 | コスト | 条件 |
|--------|------|-------|------|
| Whisper.cpp | 短文 STT | 無料 (CPU) | 品質許容で使用 |
| Parakeet | 英語 長文 STT | GPU Spot | Sprint 8 Spike |
| Coqui / VITS | 日本語 TTS | CPU / GPU | 高速化要検証 |

- GPU ノードは **spot + scale-to-0** で月 < 30 USD を目標

---

## 6. 監視 & ガードレール
1. **BigQuery usage_log**
   - event: `tts_call`, `stt_call`, `ocr_call` …
   - dimensions: `uid`, `provider`, `sec`, `cost_usd`
2. **Budget Alert** (GCP / MiniMax)
   - 日次: 予算 80 % 突破で Slack 通知 → 自動ルーティング低コストモード
3. **Grafana Dashboard**
   - KPI: API 秒数, キャッシュ HitRate, Cost/ARPU

---

## 7. プラン・料金階層の連動
| プラン | 学習時間 (TTS再生) | 月額 (税込) | 技術制御 |
|--------|------------------|-------------|---------|
| Free | 30 分 / 月 | ¥0 | 低品質 TTS, 広告表示 |
| Basic | 5 時間 / 月 | ¥1,000 | MiniMax Starter, キャッシュ共有 |
| Pro | 30 時間 / 月 | ¥2,000 | MiniMax Developer, 高品質 TTS |
| Premium | 100 時間 / 月 | ¥4,000 | MiniMax Pro + GPT 拡張 |

- 上限超過時は購読アップセル or 低品質モードに自動移行

---

## 8. ロードマップ反映
| Sprint | タスク | 担当 |
|--------|--------|------|
| 4 | 無音カット / TTS キャッシュ | BE |
| 5 | 音声倍速 & 部分 TTS UI | FE |
| 6 | Router 実装 / コストダッシュボード | BE/DevOps |
| 8 | Parakeet GPU Spike | ML |
| 10 | MiniMax ⇄ Google 自動ルーティング | BE |
| 12 | OSS TTS 検証 / 本番適用 | ML |

---

## 9. 参考リンク
- Google Cloud Pricing: https://cloud.google.com/pricing
- MiniMax Audio Pricing: https://www.minimax.io/price
- Whisper.cpp: https://github.com/ggerganov/whisper.cpp
- Coqui TTS: https://github.com/coqui-ai/TTS

---

### Appendix: コスト試算 quick sheet
```
STT  : sec × 0.0004 USD   (Google Standard)
TTS  : sec × 0.0002 USD   (Google WaveNet)
OCR  : images × 0.0015 USD
GPT  : tokens × 0.00001 USD (合算)
GCS  :   GB × 0.02  USD / month
```

これらのポリシーと手順に従うことで、学習時間が長いユースケースでも API コストを **最大 60–70 % 削減** しつつ、高品質なユーザー体験を維持できます。