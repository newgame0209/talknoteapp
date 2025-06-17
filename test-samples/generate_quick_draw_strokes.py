import json
import random
from pathlib import Path

try:
    from quickdraw import QuickDrawData
except ImportError as e:
    raise SystemExit("quickdraw パッケージが未インストールです。\n`pip install quickdraw` を実行してください")

# 取得したいカテゴリ（ひらがな・カタカナ・簡単な漢字）
CATEGORIES = [
    "hiragana_a", "hiragana_i", "hiragana_u", "hiragana_e", "hiragana_o",
    "katakana_a", "katakana_i", "katakana_u", "katakana_e", "katakana_o",
    "kanji_山", "kanji_川", "kanji_口", "kanji_日", "kanji_人"
]

OUTPUT_DIR = Path(__file__).parent
PATHS_JSON = OUTPUT_DIR / "paths.json"
LABELS_TXT = OUTPUT_DIR / "labels.txt"
SAMPLES_PER_CAT = 4  # 合計 15 * 4 = 60 行


def main():
    qd = QuickDrawData()
    paths = []
    labels = []

    # QuickDraw の get_drawing は 1 回につき 1 つしか返さないため
    # 必要数になるまでループして取得する
    for cat in CATEGORIES:
        success = 0
        attempts = 0
        while success < SAMPLES_PER_CAT and attempts < SAMPLES_PER_CAT * 3:
            attempts += 1
            try:
                d = qd.get_drawing(cat)
            except Exception as exc:
                print(f"⚠️ カテゴリ '{cat}' 取得エラー: {exc}")
                break  # そのカテゴリは存在しない可能性が高い

            if d is None:
                continue

            stroke_group = []
            for stroke in d.strokes:
                points = [{"x": x, "y": y} for x, y in zip(stroke[0], stroke[1])]
                stroke_group.append(points)
            paths.append(stroke_group)
            labels.append(cat)
            success += 1

    if not paths:
        raise SystemExit("❌ 有効な描画データを取得できませんでした。カテゴリ名を確認してください。")

    combined = list(zip(paths, labels))
    random.shuffle(combined)
    combined = combined[:50]

    final_paths, final_labels = zip(*combined)

    with PATHS_JSON.open("w", encoding="utf-8") as f:
        json.dump(final_paths, f, ensure_ascii=False, indent=2)
    with LABELS_TXT.open("w", encoding="utf-8") as f:
        f.write("\n".join(final_labels))

    print(f"✅ 生成完了: {PATHS_JSON} と {LABELS_TXT}")


if __name__ == "__main__":
    main() 