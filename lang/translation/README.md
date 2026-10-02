# 日本語訳の運用メモ

`lang/ja.json` は上流 (Foundryborne/daggerheart) の `lang/en.json` を追従して維持する。
作業は `tools/lang-sync.mjs` で行う。

```bash
node tools/lang-sync.mjs report    # en.json との差分状況を確認
node tools/lang-sync.mjs prepare   # 未訳分を lang/translation/pending.json に書き出す
node tools/lang-sync.mjs apply     # pending.json を ja.json に反映し、en.json のキー順で再構築
```

`prepare` は、既に `ja.json` にある英文→和文の対応と `lang/translation/glossary/*.csv`
を突き合わせ、既知の文言を自動で埋める。残った空欄だけを訳せばよい。
`apply` は上流で削除されたキーを落とし、キー順を `en.json` に揃える。

ネットワークアクセスは一切しない。用語集は手でコミットする CSV なので、
どの文言をどこから採ったかが必ず git 履歴に残る。

## 用語集 (`glossary/`)

1ファイル = 1出典の CSV。1列目に英語、2列目に日本語。3列目以降は備考として無視される。
ファイル名の昇順で読み込み、後のファイルが前のファイルを上書きする。

| ファイル | 行数 | 出所 |
| --- | --- | --- |
| `daggerheart-ja.csv` | 1531 | 本リポジトリ独自の訳。`en.json` の文言を種に訳したもの |

`daggerheart-ja.csv` は手元の `lang/Daggerheart_en-ja.csv` から
**D&D 列を除いて**作成したもの。1列目=英語、2列目=日本語、3列目=`en.json` のキー（参考）。

## 参照している原典・訳文

| 名称 | 版 | URL |
| --- | --- | --- |
| Daggerheart System Reference Document 2.0 | DH_SRD_2_2026_08_25 | https://www.daggerheart.com/wp-content/uploads/2026/08/DH_SRD_2_2026_08_25.pdf |
| ダガーハート SRD 日本語版（非公式・しろぱんだ訳） | 宣伝前ベータ版 | https://shirokuro-hanten.github.io/dhsrd-jp/ |

### 参照のみ・取り込み不可

| ファイル | 理由 |
| --- | --- |
| `lang/DnD_Glossary_JP.txt` | 他者の編纂物（D&D 日本語版の公式訳語に出典ページを付した一覧）。手元で参照するのは自由だが、本リポジトリに取り込んで再配布することはできない。`.gitignore` 済み。 |
| `lang/Daggerheart_en-ja.csv` | 上記由来の D&D 列を含むため、このファイル自体は取り込まない。D&D 列を除いた `glossary/daggerheart-ja.csv` が取り込み済みの正本。`.gitignore` 済み。 |

D&D の定訳語を訳の参考にすること自体は差し支えないが、**出典付きの対訳表という形で
リポジトリに持ち込まない**。「有利」「クラス」級の短い定訳語が結果的に一致するのは問題ない。

## 上流のライセンス構造

README.md（Licenses 節）より:

- SRD 記載のゲーム内容およびドメインアイコン → [Darrington Press Community Gaming License](https://darringtonpress.com/wp-content/uploads/2025/07/DPCGL-July-30th-2025.pdf)
- HTML / CSS / JavaScript → MIT

`lang/*.json` はデータファイルだが、防具・武器特徴のルール文など SRD 由来の文章を含む。
その和訳は SRD テキストの二次的著作物であり、配布の根拠は DPCGL の許諾範囲に依存する。
これは `ja.json` を置いている時点で既に同じ枠内にあり、用語集 CSV で新たに生じる論点ではない。

## しろぱんだ訳の取り込みについて

**現状: 未取り込み。** 受け入れ側の仕組み (`glossary/` と `lang-sync.mjs`) だけを用意した段階。

取り込む場合に先に片付けること:

- **許諾**: 非公式のファン訳。訳者 (しろぱんだ / shirokuro-hanten) に、本リポジトリへの
  転載と再配布 (MIT ライセンス下の Foundry システムとして) の可否を確認する。
  クレジット表記の要否・形式もあわせて確認する。
- **版の固定**: 「宣伝前ベータ版」であり今後変動する。取り込む際は参照日と版を
  このファイルに記録し、あとから差分を追えるようにする。
- **粒度の差**: しろぱんだ訳は SRD の本文訳であり、`en.json` の UI 文言とは
  1対1 対応しない。SRD 本文と一致する能力名・特徴名・ルール用語を用語集 CSV に
  起こす形で取り込み、UI 固有の文言は既存の訳を維持する。
- **既存訳との衝突**: 現行 `ja.json` には既に独自訳が入っている
  (鎧スロット / ストレス / 希望 / 恐怖 / 回避値 / ダメージしきい値 /
  近接射程・至近・近距離・遠距離 / 呪文発動 / 能力カード / 保管庫 など)。
  用語を切り替える場合は一括置換ではなく、用語ごとに採否を決める。

取り込みを始めるときの手順:

1. 訳者の許諾を得る。
2. SRD 本文から拾った対応を `glossary/shiropanda-srd.csv` として起こす。
3. 上の表に出典・版・参照日・許諾の状況を追記する。
4. `node tools/lang-sync.mjs prepare` → 差分を確認 → `apply`。
