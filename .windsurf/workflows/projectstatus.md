---
description: しゃべるノートの進捗管理ドキュメント
---

# PROJECT_STATUS.md
しゃべるノート – プロジェクトステータス  
最終更新: 2025-05-16 22:45 JST

---

このドキュメントはタスクの進捗を管理するためのものです。
実装計画に従い、タスクを実行していき、完了したら更新していきます。

更新手順
1. 毎週月曜 stand-up 後に **進捗 % / チェックボックス** を編集  
2. ブロッカーが発生したら即座に **Status = 🟥 Blocked** に変更  
3. マイルストーン達成時は進捗を 100 % にし、次フェーズを ⚪→🟢 へ変更 

## 1. ダッシュボード概況
| 指標 | 現状 | 目標 | 状態 |
|------|------|------|------|
| α フェーズ進捗 | **30 %** | 100 % | 🟡 |
| バックエンド Unit Test Cover | 0 % | ≥ 80 % | 🔴 |
| フロントエンド Unit Test Cover | 0 % | ≥ 80 % | 🔴 |
| ブロッカー Issue | 0 | 0 | 🟢 |
| 直近クラッシュ率(TestFlight) | – | < 1 % | ⚪ |

> 🟢=On-track 🟡=Watch 🔴=Action needed ⚪=未計測

---

## 2. マイルストーン進捗
| フェーズ | Due | 進捗 | 状態 | 残タスク例 |
|----------|------|------|------|-------------|
| α(Core) | 2025-07-31 | **30 %** | 🟡 | Recorder 📈, Auth 🟢, SQLite cache 🔴 |
| β(Cloud) | 2025-09-15 | 0 % | ⚪ | – |
| GA | 2025-11-01 | 0 % | ⚪ | – |

---

## 3. 現行スプリントボード（Sprint 0: 05/05–05/18）
| ID | タスク | Owner | Status | Issue/PR |
|----|--------|-------|--------|----------|
| S0-1 | Monorepo レイアウト作成 | DevOps | ✅ Done | #12 |
| S0-2 | ESLint/Prettier/Black 設定 | DevOps | 🔄 In Progress | #14 |
| S0-3 | GitHub Actions CI 雛形 | DevOps | ⬜ Todo | #17 |
| S0-4 | Terraform skeleton push | DevOps | ⬜ Todo | #18 |
| S0-5 | バックエンドスケルトン作成 | Backend | ✅ Done | - |
| S0-6 | データベースモデル定義 | Backend | ✅ Done | - |
| S0-7 | Alembicマイグレーション設定 | Backend | ✅ Done | - |
| S0-8 | ノートブックAPI実装 | Backend | ✅ Done | - |
| S0-9 | ノートブックタイトル重複時連番付加機能 | Backend | ✅ Done | - |
| S0-10 | ページAPI実装 | Backend | ✅ Done | - |
| S0-11 | メディアアセットAPI実装 | Backend | ✅ Done | - |
| S0-12 | 文字起こしAPI実装 | Backend | ✅ Done | - |

**凡例**: ⬜ Todo / 🔄 In Progress / ✅ Done / 🟥 Blocked

---

## 4. リスクリスト & イシュー
| ID | 内容 | P* | I* | 状態 | 対応策 |
|----|------|----|----|------|--------|
| R-1 | STT 精度低下 | M | H | Open | Custom vocab 検証 & UI 編集 |
| R-2 | Expo OTA & AppStore ガイドライン衝突 | L | M | Open | Apple review 事前相談 |

> *P=Probability, I=Impact (H/M/L)

---

## 5. 主要決定ログ (ADR 簡易版)
| 日付 | 決定事項 | 理由 | 参照 |
|------|----------|------|------|
| 2025-05-05 | モノレポ (frontend+backend) 採用 | CI/CD シンプル化 | ADR-001 |
| 2025-05-16 | Firebase ID Token認証方式の詳細化 | ESPv2 → FastAPI の検証済みクレーム転送方式を采用 | - |
| 2025-05-16 | データベースモデル構造の検証完了 | ERD仕様に準拠、SQLAlchemy 2.0互換性確保 | - |
| 2025-05-16 | ノートブックタイトル重複時の連番付加実装 | ユーザー体験向上、一意性制約の維持 | - |
| 2025-05-16 | ページ、メディア、文字起こしAPI実装 | ノートアプリの中核機能を提供 | - |

---

## 6. 次アクション & メモ
* 05/08: Sprint 0 Mid-Check (15 min)
* 05/18: Sprint 0 Review & Retrospective
* Expo OTA channel 名称を `staging` / `production` で統一
* バックエンドドキュメントに `BYPASS_AUTH` 設定を追記予定
* ノートブックAPI実装完了（CRUD操作、タイトル重複時連番付加機能含む）
* ページ、メディアアセット、文字起こしAPI実装完了

### 次のステップ (優先順)
1. **バックエンド**:
   - `media-worker` の実装 (STT処理の非同期ワーカー)
   - Google STT Providerの統合
   - STT WebSocketプロキシの実装
   - AIエンドポイント実装（要約、校正、リサーチ機能）

2. **フロントエンド**:
   - スプリント1 (05/19-06/01) からExpoプロジェクトの初期化、Tailwind導入などスカフォールド作業開始
   - スプリント2 (06/02-06/15) で認証画面 (Login UI) の実装に着手

---

© 2025 Windsurf Engineering