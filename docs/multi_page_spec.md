# 📄 複数ページ保存 & 復帰 実装仕様書

> 最終更新: 2025-07-04
>
> 対象バージョン: Runtime 1.0.0 / DB Schema v2

---

## 1. 対象ノートタイプ

| ノートタイプ | 型キー | 対応状況 | 備考 |
|--------------|--------|----------|------|
| 手動ノート    | `manual`      | ✅ 実装済み (alpha) | CanvasEditor 起点 |
| 写真スキャン  | `photo_scan`  | ⬜ 実装必要        | OCR + AI 整形対応 |
| インポート     | `import`      | ⬜ 実装必要        | URL / PDF / TXT |
| 録音転写       | `recording`   | ⬜ 実装必要        | 90 分 STT 文字起こし |

---

## 2. データモデル

```ts
interface UniversalNote {
  id: string;                // manual_yyyymmddHHMMss / uuid
  type: NoteType;            // manual | photo_scan | import | recording
  title: string;
  pages: Page[];             // 🎯 ページ配列 (1 以上)
  currentPage: {
    pageId: string;
    pageNumber: number;
  };
  metadata: {
    totalPages: number;
    autoSplitEnabled: boolean;
    maxCharactersPerPage?: number;
  } & NoteSpecificMeta;
  lastModified: string;
}

interface Page {
  pageId: string;            // uuid
  pageNumber: number;        // 1-based
  canvasData: CanvasData;    // 手書き / OCR / 文章など
  lastModified: string;
  pageMetadata?: {
    // ノート種別ごとの拡張メタ
    photoUri?: string;       // photo_scan
    ocrResult?: OCRResult;   // photo_scan
    audioTimestamp?: {       // recording
      start: number;
      end: number;
    };
    sourcePageNumber?: number; // import
  };
}
```

---

## 3. 保存フロー

```
CanvasEditor
   │  markAsChanged()
   ▼
useAutoSave Hook (5s debounce / 即時)
   │  buildUniversalNote()
   ▼
UniversalNoteService.saveNote()
   ├─ savePageOnly(noteId, pageId, canvasData)   // 単一ページ更新
   ├─ addPage(noteId, pageCreateData)            // 新規ページ追加
   └─ splitPage(noteId, pageId, textContent, cfg) // 自動分割
```

### 3.1 必須条件
1. **任意のページ操作で 100 ms 以内に自動保存**
2. **複数ページ同時編集不可** (isSaving 排他制御)
3. **オフライン時**: `SyncQueue` に diff を積む
4. **ページ分割閾値**: 2 000 文字 / 10 MB を超えたら自動分割

---

## 4. 復帰フロー

```
Dashboard → CanvasEditor(noteId)
   │  loadNote()
   ▼
getNoteById()  // ManualNote → Recording → Import → PhotoScan の順
   │  note.pages 配列取得
   ▼
setCurrentPage(page[ currentPage.pageNumber - 1 ])
   │  setCanvasData()
   ▼
SkiaCanvas / TextInput レンダリング
```

### 4.1 必須条件
1. **ページ順序保持**: `pageNumber` 昇順でレンダリング
2. **currentPageIndex** を必ず復元
3. **全ページの drawingPaths / textContent** 一貫性チェック

---

## 5. ノートタイプ別 要件

### 5.1 写真スキャン (`photo_scan`)
- `pages[n].pageMetadata.photoUri` に元画像 URI を保存
- OCR 結果は `pages[n].canvasData.content` に格納し、`ocrResult` に信頼度などを保持
- AI 整形後テキストは同フィールドを置換し、`pageMetadata.aiProcessed = true` をセット

### 5.2 インポート (`import`)
- PDF 各ページ / Web ページ節ごとに 1 ページ生成
- 元ページ番号は `sourcePageNumber`
- 画像付き PDF の場合、`canvasData.content` はマークダウン変換後のテキスト

### 5.3 録音転写 (`recording`)
- STT 完了後に 30s チャンク単位で自動ページ分割
- `audioTimestamp` に <start,end> 秒を保存 (再生連動スクロール用)

---

## 6. API / DB 変更

| 関数 / API | 変更点 |
|------------|--------|
| `saveManualNote` | pages 配列 & metadata 対応済み ✅ |
| `savePhotoScanNote` | **要改修**: multi-page 対応 |
| `saveImportNote` | **要改修** |
| `saveRecordingNote` | **要改修** |
| `getNoteById` | 4 タイプ共通ページ復元ロジックに統一 |
| `updateCanvasData` | `savePageOnly()` 経由に集約 |

---

## 7. UI 実装ポイント

1. **ページナビゲーションバー** (下部):
   - ◀︎ / ▶︎   (前後ページ)
   - ページ番号インジケータ (1 / n)
   - "＋" ボタンで空白ページ追加
2. **自動スクロール** (TTS 再生時): `audioTimestamp` 参照
3. **Undo/Redo**: ページ単位の履歴スタック

---

## 8. テストケース (抜粋)

| # | シナリオ | 期待結果 |
|---|-----------|----------|
| 1 | 写真 3 枚スキャン → 3 ページ保存 → アプリ再起動 | 3 ページ復帰 & 画像表示 |
| 2 | 10 000 字インポート → 自動 5 ページ分割 | 5 ページ復帰 & 行間保持 |
| 3 | 録音 90 分 → 転写 → 9 ページ分割 | 再生連動スクロール正常 |
| 4 | オフラインで 2 ページ編集 → 再接続 | 両ページ差分同期 |

---

## 9. 完了定義

- [ ] 4 ノートタイプで複数ページ作成・保存・復帰が正常
- [ ] 自動保存成功率 99.9 %以上
- [ ] ページ追加 / 削除 / 分割 / 移動 UI 操作が 100 ms 以内
- [ ] E2E テスト (Detox) 10 シナリオ Green
- [ ] Docs (本ファイル) に沿ったコードレビュー 2 名通過

---

> **備考**: 既存の ManualNote 実装をベースに各ノートタイプの `save*Note`, `updateCanvasData`, `getNoteById` を段階的に移行してください。 