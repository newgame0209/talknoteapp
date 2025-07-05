# URL インポート機能 – チャンク分割 & ページ化 実装計画

作成日: 2025-06-XX  
作成者: 開発チーム（要レビュー）

---
## 🎯 目的 / ゴール
1. Web ページ / YouTube 字幕など 2,000 文字を超える長文でも **全文を AI 整形** した上でキャンバスに反映できるようにする。
2. バックエンド側でチャンク分割→AI 整形→ページ JSON 生成を完結させ、フロントエンドはページ配列を保存・表示するだけに簡素化する。
3. 既存インポート機能・他ノートタイプ・自動保存基盤に影響を与えない安全な段階移行を行う。

---
## 📑 導入方針（段階的）
| Phase | 目的 | 主要タスク | 完了判定 | 想定工数 |
|-------|------|------------|----------|----------|
| P1 | **バックエンド分割ロジック実装 (feature flag)** | 1) `url_importer.py` に `split_into_chunks()` 追加<br>2) 2000 文字超の場合のみチャンク分割&AI 整形ループ<br>3) レスポンスに `pages[]` 配列追加 | a) 単体テストでページ数一致<br>b) Flag=off で従来 JSON を返す | 3h |
| P2 | **DB スキーマ拡張** | 1) `pages` テーブルに `import_id` FK 追加<br>2) Alembic マイグレーション作成（DOWN スクリプト含む） | ローカル migrate → pytest OK | 1h |
| P3 | **フロント取得 API 拡張 (back-compat)** | 1) `importApi.getImportResult()` の型を `pages[]` 対応<br>2) Feature flag で旧レスポンスとの互換維持 | Jest unit OK / TypeSafety pass | 1.5h |
| P4 | **UniversalNoteService multi-page 保存** | 1) `createNoteFromImport()` で pages をループ保存<br>2) `MultiPageService` 利用 ⇒ 自動保存互換 | Notebook 再読み込みでページ件数一致 | 2h |
| P5 | **CanvasEditor ページ UI 有効化** | 1) ナビゲーションバー `Prev / X / Next` 追加<br>2) Undo/Redo スタックへの影響テスト | iOS / Android 実機でページ遷移 OK | 4h |
| P6 | **E2E & 性能検証** | 1) 50 分 YouTube → 25 ページ生成テスト<br>2) 1,000 文字ブログ → 1 ページ保持テスト | Detox シナリオ pass / レイテンシ < 5s | 2h |
| P7 | **段階リリース** | 1) Feature flag ON → preview ブランチ deploy<br>2) フィードバック後 main へ | バグゼロ / KPI <1% 例外率 | 1h |

> **総工数目安**: ~15h (2 スプリントで分散実施)

---
## 🔧 実装詳細
### P1: バックエンド変更
```python
# backend/app/services/url_importer.py (抜粋)
MAX_CHARS = 2000

def _split_into_chunks(text: str, max_chars: int = MAX_CHARS) -> list[str]:
    """自然段落を保持しつつ max_chars で分割"""
    # 実装方針: \n\n で段落 split → accumulate
    ...

async def import_from_url(url: str, **opts) -> ImportResult:
    full_text = await _extract_text(url)
    if len(full_text) > MAX_CHARS:
        chunks = _split_into_chunks(full_text)
    else:
        chunks = [full_text]

    pages: list[PagePayload] = []
    for i, chunk in enumerate(chunks):
        enhanced = await ai_service.enhance_text(chunk, keep_length=True)
        pages.append({
            "page_number": i + 1,
            "canvas_data": text_to_canvas(enhanced)
        })
    ...  # pages を DB & PubSub へ
```
* **Feature Flag**: `IMPORT_SPLIT_ENABLED` (env) が false の間は従来 1 ページ JSON を返す。

### P3: フロント API 型
```ts
interface ImportResult {
  note_id: string;
  title: string;
  pages: { page_number: number; canvas_data: CanvasData }[]; // New
}
```
* フラグ OFF 時は `pages` を `[ {page_number:1, canvas_data: fullCanvas} ]` として返すため型互換。

### P5: CanvasEditor 変更点
1. `currentPageIndex` state は既存。UI にページ移動ボタンを追加。  
2. ページ切替で `setCanvasData(pages[idx])` ＆ AutoSave フック呼び出し。  
3. `totalPages` が 1 の場合はボタンを非表示。

---
## 🧪 テスト計画
* **Unit (BE)**: `test_split_into_chunks.py` – 段落維持・境界チェック
* **Unit (FE)**: `UniversalNoteService.test.ts` – pages 保存件数・内容一致
* **E2E**: `import_long_youtube.spec.ts` – URL→ページ遷移→全文検証

---
## 🚑 ロールバック戦略
* Feature flag で旧フローに即時切替可  
* DB マイグレーションは `imports_pages` に限定 – 元 schema 互換保持  
* main へマージ後 24h 監視 – Error rate >1% で flag OFF

---
## ⚠️ リスク & 対策
| リスク | 影響 | 対策 |
|--------|------|------|
| AI 整形遅延 | インポート完了までに 3 分超過 | timeout=180s 監視・失敗時は整形スキップで生テキスト返却 |
| ページ数爆増 (≫50) | DB サイズ & UI 負荷 | MAX_PAGES=40 で打ち切り＋警告 |
| 既存インポート互換 | 旧クライアントで JSON 形式相違 | Feature flag & レスポンス互換で回避 |

---
## ✅ 確認ポイント
- [ ] 本計画の内容で進めてよいか? (Yes / 修正指示)
- [ ] 作業順序・工数に問題ないか?
- [ ] Feature flag 名 / デフォルト値の妥当性

承認いただければ **P1 バックエンド実装** から着手します。 