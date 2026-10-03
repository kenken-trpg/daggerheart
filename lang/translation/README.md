# 日本語訳の運用メモ

`lang/ja.json` は上流 (Foundryborne/daggerheart) の `lang/en.json` を追従して維持する。
作業は `tools/lang-sync.mjs` で行う。

## 上流の取り込みは rebase ではなくマージ

```bash
git fetch origin                 # origin = Foundryborne/daggerheart
git merge origin/main            # rebase しない
npm run lang:report              # 訳の差分を確認
npm run lang:prepare             # → lang/translation/pending.json を埋める
npm run lang:apply
git push kenken-trpg main
```

`kenken-trpg/main` は force push を禁止している (`allow_force_pushes: false`)。
rebase するとフォーク側の履歴が書き換わって push が GH006 で拒否されるため、
**マージで取り込む**。`git config --local pull.rebase false` / `pull.ff false` を
設定済みなので、`git pull` でも必ずマージコミットが作られる。

上流は `main` が直接進むので、マージ時に競合しうるのはフォークが手を入れた
ファイルだけ。現状は次の3つ（追加しただけのファイルは競合しない）:

| ファイル | フォーク側の変更 |
| --- | --- |
| `system.json` | `languages` に `ja` を追加 |
| `package.json` | `lang:report` / `lang:prepare` / `lang:apply` スクリプト |
| `.gitignore` | `.DS_Store`、参照専用ファイル、`pending.json` |

いずれも追記のみなので、競合しても両方を残す形で解消すればよい。
`lang/ja.json` は上流に存在しないため、通常は競合しない。

## 翻訳同期ツール (`tools/lang-sync.mjs`)

```bash
node tools/lang-sync.mjs report    # en.json との差分状況を確認
node tools/lang-sync.mjs prepare   # 未訳分を lang/translation/pending.json に書き出す
node tools/lang-sync.mjs diff      # 外部日本語訳と既訳が食い違うキーを書き出す
node tools/lang-sync.mjs apply     # pending.json を ja.json に反映し、en.json のキー順で再構築
```

`prepare` は、既に `ja.json` にある英文→和文の対応と `lang/translation/glossary/*.csv`
を突き合わせ、既知の文言を自動で埋める。残った空欄だけを訳せばよい。
`apply` は上流で削除されたキーを落とし、キー順を `en.json` に揃える。

ネットワークアクセスは一切しない。用語集は手でコミットする CSV なので、
どの文言をどこから採ったかが必ず git 履歴に残る。

## 外部訳との差分検出 (`diff`)

`prepare` は**未訳キーしか見ない**。`ja.json` が全キー埋まっている通常の状態では、
用語集を追加しても `prepare` の出力は 0 件になる (既訳が用語集より優先されるため)。
外部の日本語訳を既訳と比べて見直すには `diff` を使う。

```bash
npm run lang:diff                                   # 全用語集 vs ja.json
node tools/lang-sync.mjs diff --only=shiropanda     # 特定の出典だけと比較
node tools/lang-sync.mjs diff --only=shiropanda --adopt
```

用語集の訳と現行 `ja.json` の訳が食い違うキーだけを `pending.json` に書き出す。
各エントリは次の形で、**現行訳と提案訳の両方が見える**:

```json
"DAGGERHEART.GENERAL.damageType": {
    "en": "Damage Type",
    "current": "ダメージタイプ",
    "suggest": "ダメージ種別",
    "source": "daggerheart-ja.csv",
    "ja": ""
}
```

- `ja` が空のエントリは `apply` が**無視する**。既定では何も変わらない。
- 採用するものだけ `suggest` を `ja` にコピーして `apply`。
- `--adopt` は `ja` に提案訳を入れた状態で出力する。却下するものを空にする運用。
- `--only=<文字列>` はファイル名が部分一致する用語集だけを読み込む。出典ごとに
  単独で比較できるので、複数の用語集が重なって上書きされた結果を見ずに済む。
- 比較は正規化後に行う (大小文字・空白・ダッシュ・引用符・末尾句点)。
  句読点の揺れだけのものは一覧に出ない。

**一括採用はしない前提の設計**。英語文字列でマッチするため、文脈を持たない用語集を
当てると誤訳が混ざる。実際に手元の用語集で試すと `Hide` → 「非表示」(正しくは「隠れる」)、
`Long` → 「長期」(武器の射程なので「長射程」) が提案として出る。
1件ずつ採否を決めるのはこのため。

## 用語集 (`glossary/`)

1ファイル = 1出典の CSV。1列目に英語、2列目に日本語。3列目以降は備考として無視される。
1行目はヘッダとして読み飛ばす。BOM 付きでもよい。外部訳を起こす際も必要なのは
この2列だけで、`en.json` のキー列はなくてよい (キーではなく英語文字列で突合するため)。
ファイル名の昇順で読み込み、後のファイルが前のファイルを上書きする。`diff --only=` で
出典を1つに絞る運用を考えると、ファイル名は出典が分かる形にしておく。

| ファイル | 行数 | 出所 |
| --- | --- | --- |
| `daggerheart-ja.csv` | 1531 | 本リポジトリ独自の訳。`en.json` の文言を種に訳したもの |

`daggerheart-ja.csv` は手元の `lang/Daggerheart_en-ja.csv` から
**D&D 列を除いて**作成したもの。1列目=英語、2列目=日本語、3列目=`en.json` のキー（参考）。

## 外部の対訳資料から用語集 CSV を起こす (設計)

**未実装。** 外部の日本語訳を取り込む許諾が得られた時点で書く。出典ごとに
スクリプトを書き捨てるのではなく、下記を共通の設計として踏む。

### 入力の型を見極める

対訳資料は大きく2型あり、必要な労力が桁で違う。**先に型を判定する。**

| 型 | 構造 | 必要な処理 |
| --- | --- | --- |
| 対訳併記型 | 原語と訳語が同一ページに併記されている | 抽出のみ |
| 訳文単独型 | 訳語しかない | 原典との対応付けが別途必要 |

併記型は、見出しや用語ラベルに原語を添える実装が多い
(`<h3>訳語<span class="en-sub">English</span></h3>` のような形)。
この場合は次の1規則で全件取れる:

> 原語を囲む要素の中身 = 英語。**その親要素のテキストから当該要素を除いた残り** = 日本語。

原語がどの要素・クラスに入るかは出典ごとに違うので、**セレクタは引数で与える**。

訳文単独型は原典との対応付けが必要で、費用対効果が落ちる。見出し構造や
`id` 属性に原語スラッグが残っていればそこを手がかりにできるが、
残っていなければ用語単位の手作業に近くなる。無理に自動化しない。

### HTML は必ずパーサで読む

正規表現で親要素を特定しようとすると**壊れる**。入れ子とタグ境界を取り違えて、
ページ全体を訳文側として拾う。Node なら DOM パーサを使う
(`tools/*.mjs` の依存を増やしたくなければ、取得済み HTML を Python の
`html.parser` で前処理する手もある)。

### 投入先は2系統あることを忘れない

本リポジトリの訳出対象は `lang/ja.json` だけではない。

| 投入先 | 規模 | 内容 |
| --- | --- | --- |
| `lang/ja.json` | 2285キー | UI 文言 |
| `src/packs/*/*.json` の `name` 等 | 1821ファイル | 能力カード名・クラス名・血統名・敵キャラクター名などのゲーム内容 |

SRD の訳は**ゲーム内容の名称に厚く、UI 文言には薄い**。したがって外部訳を当てると
`lang/ja.json` への命中より packs への命中のほうが大きくなる。
CSV は投入先ごとに分けて出力する:

```text
tools/srd-ja-extract.mjs <input.html> --en-selector=<...> --out-dir=lang/translation/glossary/
  ├→ <出典>-ui.csv      → lang-sync の diff --only=<出典> でレビュー
  └→ <出典>-packs.csv   → packs 用 (投入機構は別。CSV 生成までを範囲とする)
```

`lang/ja.json` 側は既存パイプラインにそのまま乗る。packs 側は投入機構が異なるので、
**抽出と投入を分離し、まず CSV までを作る**。投入機構は
「コンペンディウム (packs) の翻訳方式」の節を参照。

### スクリプトの約束事

- **入力はローカルファイル。スクリプトにネットワーク処理を持たせない。**
  取得は `curl` で人間が行い、HTML をパス引数で渡す。`lang-sync.mjs` と同じ方針で、
  取得日と版の記録を人の手に残すため。
- **版を固定して記録する。** 取得日と入力ファイルの SHA256 を出力 CSV の
  ヘッダ行かコメントに残す。未完成の資料は後から加筆されるので、
  再取得したときに差分だけを追えるようにしておく。
- **出典内の自己矛盾は報告して落とす。** 同じ原語に別の訳語が当たっている箇所は
  実在する。後出し勝ちで黙って潰すと、出典内の不整合をそのまま持ち込む。
- **正規化は `lang-sync.mjs` の `normalize()` と同一にする。** 揺れの判定基準が
  ツール間でずれると、`diff` の出力が信用できなくなる。
- **未整備セクションを確認する。** 進行中の訳は一部の章が空であることが多い。
  どの範囲が埋まっているかを記録し、CSV の規模から判断しない。

### 抽出したあと

CSV を `glossary/` に置き、`diff --only=<出典>` で既訳との食い違いを見る。
一括採用はしない (理由は「外部訳との差分検出」の節)。食い違いは**語ごとに
体系的に固まる**傾向があり、キー単位より先に**用語単位で方針を決める**ほうが速い。

## コンペンディウム (packs) の翻訳方式 (未着手・方式比較)

`lang/ja.json` は UI 文言のみを扱う。**ゲーム内容は別の機構が必要**で、まだ何も
入っていない。下記は着手前の方式比較と、調査時点 (2026-10) の実測値。

### 現状

| 対象 | 規模 | 日本語化 |
| --- | --- | --- |
| `lang/ja.json` (UI 文言) | 2,285文字列 / 69,510文字 | 100% (未訳0・英語フォールバック0) |
| `src/packs/*/*.json` (ゲーム内容) | 8,916文字列 / 601,861文字 / 1,160ドキュメント | **0%** (日本語を含むファイル0件) |

内容側は UI の約8.7倍。画面上は「枠は日本語、中身は英語」になる。
内訳は `adversaries` 273,513文字 / `environments` 115,002 / `domains` 113,164 /
`subclasses` 41,215 / `classes` 23,392 / 以下小。

### 方式選択では減らない固定費

- **翻訳量は方式に依らない。** 上記の 601,861文字はどの方式でも同じ。
- **上流の packs は激しく動く。** 直近90日で 1,644ファイルが変更、666が新規追加、
  21削除。どの方式でも「訳が常に遅れる」前提の運用と、カバー率を測る仕組みが要る。
- **Foundry コアはコンペンディウムの中身を翻訳できない** (UI 要素のみ)。
  仕様上の制約なので、追加機構は必須。
- **`packs/` は gitignore され、リリース時に `deploy.yml` が `src/packs/*.json` から
  LevelDB をビルドして `system.zip` に同梱する。** ビルド成果物に手を入れる方式は
  「システム本体を自分で配布する」ことを意味する。

### 比較

| | A. Babele モジュール | B. ビルド時注入 | C. src/packs 直接和訳 | D. 自前ランタイム注入 |
| --- | --- | --- | --- | --- |
| 実装場所 | 別リポジトリ (モジュール) | `pullYMLtoLDB.mjs` の `transformEntry` | `src/packs` を直接編集 | システム内に i18n レイヤ |
| 上流マージの競合 | **ゼロ** (本体に触らない) | 小 (ツール1ファイル) | **1,160ファイルが毎回** | 中 |
| 配布形態 | 公式システム + モジュール | フォーク版システム全体を自前リリース | 同左 | 同左 |
| ユーザーの手間 | Babele + 訳モジュールを入れる | なし | なし | なし |
| 英日の切り替え | ランタイムで可 | 不可 (ビルドで固定) | 不可 | 可 |
| 既存エコシステム | 確立 (dnd5e 等で多数実績) | 前例なし | — | 車輪の再発明 |

**C は却下。** 90日で1,644ファイルが動く対象を直接編集すると、追従コストが
翻訳コストを上回る。**D も却下。** Babele が既にやっていることを自前で持つ理由がない。

**B の評価**: 競合は小さく技術的には成立する (`transformEntry` は注入点として素直) が、
得られるのは「ユーザーがモジュールを入れなくて済む」だけで、代わりに
システム全体の自前リリースと上流リリース追従の責任を負う。費用対効果が合わない。

### 推奨: A (Babele モジュール)

[Babele](https://foundryvtt.com/packages/babele) は調査時点で 2.9.1、
minimum v13 / verified v14 / maximum v14。本リポジトリの
`compatibility.minimum: 14.364` と合致する。

動作は「JSON 設定ファイルから訳を取得し、**元のコンペンディウムを書き換えず
メモリ上でマップされたプロパティを上書きする**」方式。pack の複製を持たずに済む。

決め手は**上流マージの競合がゼロになる**こと。本体リポジトリに触らないので、
現在の追従作業がこれ以上重くならない。

なお開発環境の Foundry には Babele 2.9.1 が既にインストール済み
(`Data/modules/babele`)。「ユーザーに導入の手間をかける」という A の唯一の
短所は、少なくとも手元では既に払い終わっている。

### A を選ぶとフォーク自体が不要になりうる

モジュールの `module.json` の `languages` 配列には**オプションの `system` フィールド**が
あり、モジュールが他のシステムのキーに訳を提供・上書きできる (同じキーを持つ訳を
提供することで上書きされる)。つまり `lang/ja.json` もモジュール側へ移せる:

```text
公式 Foundryborne/daggerheart (フォークしない)
  + Babele
  + daggerheart-ja モジュール
      ├ lang/ja.json       ← UI 文言 (現在フォークにあるもの)
      └ babele/*.json      ← pack 訳
```

この形なら上流追従そのものが消える。`lang-sync.mjs` と `glossary/` はそのまま
モジュール側へ持っていける。

**要検証**: `languages` の `system` スコープの正確な挙動は v14 のマニフェスト
スキーマで確認する (調査時、公式ドキュメントは JS レンダリングで本文が取得できず、
コミュニティ Wiki の記述に依拠している)。

### 着手前に決めること

- **キーの安定性。** Babele の訳ファイルは通常エントリ名で引く。pack のファイル名には
  ID が埋まっている (`domainCard_Safe_Haven_lmBLMPuR8qLbuzNf.json`) ので、
  **名前ではなく `_id` で引けるか**を Babele の mapping 仕様で確認する。
  90日で666件追加される対象なので、ここが追従コストを左右する。**最優先項目。**
- **既存ワールドへの影響。** Babele は閲覧・インポート時にのみ訳を当てる。
  既にワールドへインポート済みのドキュメントは遡って翻訳されない。

### 着手順

1. Babele の mapping 仕様を確認 (`_id` キー対応の可否)。
2. 小さい pack 1つで実証 — `transformations` (19件 / 3,665文字) か
   `communities` (31件 / 5,357文字)。
3. 成立したら `ancestries` (73件) → `domains` (320件) →
   `adversaries` (268件 / 273,513文字) の順。重いものを最後に。
4. カバー率レポートを `lang-sync.mjs` と同じ発想で作る。
   666件/90日の追加に追従するため必須。

## 日本語で崩れるレイアウト (CSS)

訳文そのものは正しくても、英語を前提にした CSS のせいで表示が崩れる箇所がある。
**原因は一つで、英語は単語の途中で改行できないが日本語は任意の文字間で改行できること。**
`display: flex` の子要素は既定で `min-content` まで縮むので、英語では
「単語1つぶんの幅」で下げ止まるところが、日本語では「1文字ぶんの幅」まで潰れて
縦書きのように積み上がる。

実機で検出して修正済み:

| 箇所 | 症状 | 修正 |
| --- | --- | --- |
| `styles/less/utils/mixin.less` の `.section-title()` | キャラクターシート左の「装備」「ロードアウト」「経験」が縦積み (ロードアウトは3行) | `h3` に `white-space: nowrap` |
| `styles/less/sheets/actors/adversary/sidebar.less` (攻撃/経験の2箇所) | 敵対者シートで同じ症状 | 同上 |
| `styles/less/sheets/actors/companion/details.less` | 相棒シートの「パートナー」が5行に分解 | 同上 |
| `styles/less/sheets/actors/companion/header.less` の `.status-label` | 相棒シートの「回避値」が2行になりバッジからはみ出す | `width: auto; min-width: 100%` + `h4` に `white-space: nowrap` |
| `styles/less/dialog/dice-roll/roll-selection.less` の `.dice-select .label` | ロールダイアログの「希望」「恐怖」が縦積み | `.label` に `white-space: nowrap` |

いずれも英語表示では描画幅が変わらないので、上流にそのまま PR できる性質の修正。

### 検出のしかた

目視では見落とすので、ブラウザのコンソールで DOM を走査する。
「葉ノードで、CJK を含み、描画幅がフォントサイズの 2.6 倍未満なのに 2行以上」を
崩れとみなす:

```js
[...document.querySelectorAll('.application *')].filter(el => {
    if (el.children.length) return false;
    const txt = el.textContent.trim();
    if (txt.length < 2 || !/[\u3040-\u30ff\u4e00-\u9fff]/.test(txt)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1) return false;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const lh = parseFloat(getComputedStyle(el).lineHeight) || fs * 1.2;
    return Math.round(r.height / lh) >= 2 && r.width < fs * 2.6;
});
```

アクター6種・アイテム12種のシートを順に開いて走査すれば、シート側は網羅できる。
**ダイアログは別途開かないと引っかからない** (上の「希望/恐怖」は
ロールダイアログを開くまで検出できなかった) ので、カバレッジは
「開いた画面のぶんだけ」である点に注意。

## 実機テストの手順

翻訳の抜けは `npm run lang:report` で分かるが、**レイアウトの崩れと
`.mjs` 直書きの英語は実際に動かさないと分からない。** 稼働中の Foundry
には触らず、独立したデータパスで立てる:

```sh
# 1. ビルド (packs を含む)
npm run build
npm run pullYMLtoLDBBuild

# 2. テスト専用のデータパスを用意してリポジトリをシンボリックリンク
TD=/tmp/fvtt-test
mkdir -p "$TD"/{Data/systems,Data/modules,Config}
cp "$HOME/Library/Application Support/FoundryVTT/Config/license.json" "$TD/Config/"
ln -sfn "$PWD" "$TD/Data/systems/daggerheart"
# core の日本語化は別モジュール任せなので、入れないと素の UI が英語のままになる
ln -sfn "$HOME/Library/Application Support/FoundryVTT/Data/modules/foundryVTTja" \
        "$TD/Data/modules/foundryVTTja"

# 3. 別ポートで起動 (本番の 30000 とデータパスの両方を避ける)
node "/Applications/Foundry Virtual Tabletop.app/Contents/Resources/app/main.js" \
     --dataPath="$TD" --port=30100 --noupnp --headless --world=<world-id>
```

注意点:

- **既存のデータパスを使い回さない。** Foundry はデータパス単位でロックを取るので
  デスクトップアプリが動いていると起動できないし、`Data/systems/daggerheart` を
  差し替えると既存ワールドが次回起動時にマイグレーションされる。
- `foundryVTTja` を入れ忘れると `CHAT.MODES.public` などの **core のキー**が
  英語で出る。これはシステム側の不具合ではないので、未訳として数えないこと。
- `src/packs` の `_stats.coreVersion` は 14.366/14.367 を含む。
  それより古い core で起動すると journals と rolltables のマイグレーションが
  失敗する (`Documents from a core version newer than the running version
  cannot be migrated`)。`system.json` の verified に合わせた core を使う。

## 実機走査のカバレッジ

「崩れがない」と言えるのは**実際に開いた画面だけ**なので、どこまで見たかを残す。

| 画面 | レイアウト崩れ | 未訳 |
| --- | --- | --- |
| アクターシート 6種 (character / adversary / companion / party / environment / npc) | 修正済み (下記「日本語で崩れるレイアウト」参照) | なし |
| アイテムシート 12種 | なし | なし |
| ロールダイアログ (`D20RollDialog`) | 修正済み (希望/恐怖) | なし |
| チャットカード (デュアリティロール) | なし | なし |
| システム設定 5種 × 全タブ (自動化 / メタ情報 / ホームブリュー9タブ / 外観 / 選択ルール) | **なし** | `Image` 1件 |
| キャラクターレベルアップ 全3タブ (レベル成長 / 成長の選択 / 要約) | **なし** | なし。符号も全11箇所が全角＋ |
| レベルアップ選択肢ダイアログ (GM 側のティア編集) | なし | **17件** (`Tiers` / `Add Levelup Option` / 選択肢17種) |
| `CharacterResetDialog` / `DeathMove` / `Downtime` / `RiskItAll` / `CompendiumBrowserSettings` / `CountdownPermissions` / `ActiveEffectPathViewer` | なし | `Name` / `Submit` / `Save` |

未走査 (開くのに前提データが要り、今回は到達できなかった):
`BeastformDialog` / `ImageSelectDialog` / `ItemTransferDialog` / `TagTeamDialog` /
`GroupRollDialog` / `ResourceDiceDialog` / `DamageReductionDialog` /
`MulticlassChoiceDialog` / `ActionSelectionDialog` / キャラクター作成フロー /
コンバットトラッカー / 各種 HUD。

補足:

- `Submit` / `Save` は Foundry core の既定ボタンラベル。システム側ではなく
  `foundryVTTja` の守備範囲。
- コンペンディウムブラウザ設定に出る `Classes` / `Subclasses` / `Domains` …は
  `system.json` の `packs[].label`。Foundry は `CompendiumCollection#title` を
  `metadata.label` のまま返すだけで localize しない (dnd5e も同様に英語のまま)。
  **これは packs 翻訳の課題**であって UI 翻訳の抜けではない。Babele は
  コンペンディウム名も訳せるので、上記「packs の翻訳方式」でまとめて解決する。

## 翻訳機構を通っていない文字列 (上流の不具合)

`ja.json` では直せないもの。**どれも en.json にキーを足す上流 PR が必要。**

`.hbs` 側は2種類ある。

生の英語がそのまま書かれているもの:

| 箇所 | 文字列 | 備考 |
| --- | --- | --- |
| `templates/dialogs/reactionRoll.hbs:2` | `Reaction Roll` | 上流に PR を出す価値がある (en.json にキーを追加してテンプレートを差し替えるだけ) |
| `templates/sheets/actors/party/projects.hbs:3` | `Soon tm` | 未実装機能のプレースホルダ。放置で可 |

**`{{localize}}` は通っているが、渡しているキーが存在しないもの。**
Foundry は未知のキーを渡されるとキー文字列自体を返すので、英語がそのまま出る。
「`{{localize}}` の有無」で検索すると見落とすので注意:

| 箇所 | 渡しているキー | 画面上の出方 |
| --- | --- | --- |
| `templates/dialogs/levelupOptionsDialog/header.hbs:2` | `"Tiers"` | クラス/サブクラスの「レベルアップ選択肢」ダイアログの見出し |
| `templates/dialogs/levelupOptionsDialog/parts/tier.hbs:6` | `"Add Levelup Option"` | 同ダイアログのボタン |

この2件は ja.json のルートに同名キーを置けば一応は訳せるが、**`lang:apply` が
en.json を基準に ja.json を組み直す際に落とされる** (`tools/lang-sync.mjs` の
「en.json にないキーは retired として捨てる」挙動)。その場しのぎにしかならないので
採用していない。

**`.mjs` 側はテンプレートより多い。** データモデルの `initial` 値や設定テーブルに
英語がそのまま書かれている箇所があり、こちらは画面に出るにもかかわらず
`ja.json` では一切手が出せない。実機テストで見つかった代表例:

| 箇所 | 文字列 | 画面上の出方 |
| --- | --- | --- |
| `module/data/actor/companion.mjs:86` | `name: 'Attack'` | 相棒シートの既定攻撃の名前。character は `_loc('DAGGERHEART.GENERAL.unarmedAttack')` を使っているので対応漏れ |
| `module/data/actor/adversary.mjs:74` | `name: 'Attack'` | 同上 (敵対者シート) |
| `module/data/item/weapon.mjs:55` | `name: 'Attack'` | 同上 (武器) |
| `module/data/levelTier.mjs:146-194` | `Character Trait` / `Hit Points` / `Evasion` / `Proficiency` / `Experience` / `Domain Card` / `Subclass` / `Multiclass` / `Increase Dice Size` ほか | レベルアップ選択肢 (`LevelOptionType`)。`levelupOptionsDialog.mjs` と `companionLevelup.mjs` が `.label` をそのまま表示する |
| `module/config/actorConfig.mjs:281-326` | `Armor Marks +1` / `Major Damage Threshold +2` など | レベルアップのティア選択肢 |
| `module/data/fields/action/rollField.mjs:91,155` | `Bonus to Hit` / `Attack` | アクション設定 |
| `module/data/activeEffect/baseEffect.mjs:160` | `New Effect` | 効果の新規作成時の名前 |
| `module/data/settings/Homebrew.mjs:145` | `label: 'Image'` | ホームブリュー設定 → ドメイン タブ。隣の `label` フィールドは `DAGGERHEART.GENERAL.label` を使っており、**`DAGGERHEART.GENERAL.imagePath` が既に存在する**ので1語差し替えるだけで直る |
| `module/applications/dialogs/characterResetDialog.mjs:17` | `label: 'Name'` | キャラクターリセットの確認ダイアログ |

一括検出は下記で出せる (内部 ID と混ざるので目視選別が要る):

```sh
grep -rnE "\b(name|label|title|hint|placeholder): '[A-Z][^']+'" module/
```

直すなら `en.json` にキーを足して `_loc()` 経由にする上流 PR になる。
フォーク側だけで潰すことはできない。

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

**現状: 未取り込み。** 受け入れ側の仕組み (`glossary/`、`lang-sync.mjs` の
`diff` による既訳との差分採否) だけを用意した段階。

取り込む場合に先に片付けること:

- **許諾**: 非公式のファン訳。訳者 (しろぱんだ / shirokuro-hanten) に、本リポジトリへの
  転載と再配布 (MIT ライセンス下の Foundry システムとして) の可否を確認する。
  クレジット表記の要否・形式もあわせて確認する。
  サイトのフッタには「訳文はセッション、配信、二次創作物などに利用してよい」旨の
  記載があるが、**想定用途がそれらに限られており、ソフトウェアに同梱しての
  再配布は読み取れない。この記載を許諾の代わりにしない。**
- **版の固定**: 「宣伝前ベータ版」であり今後変動する。取り込む際は参照日と版を
  このファイルに記録し、あとから差分を追えるようにする。
- **粒度の差**: SRD の本文訳であり、`en.json` の UI 文言とは 1対1 対応しない。
  本文と一致する能力名・特徴名・ルール用語を用語集 CSV に起こす形で取り込み、
  UI 固有の文言は既存の訳を維持する。命中はゲーム内容の名称 (packs) に偏るので、
  「外部の対訳資料から用語集 CSV を起こす」の節に従って投入先を分ける。
- **未整備の範囲**: サイト自身が一部の章 (SRD1.0 のティア2以降、SRD2.0 の
  敵キャラクター・環境・キャンペーン設定) を未整備と明記している。
  取り込み時点で埋まっている範囲を記録しておく。
- **既存訳との衝突**: 現行 `ja.json` には既に独自訳が入っている
  (鎧スロット / ストレス / 希望 / 恐怖 / 回避値 / ダメージしきい値 /
  近接射程・至近・近距離・遠距離 / 呪文発動 / 能力カード / 保管庫 など)。
  用語を切り替える場合は一括置換ではなく、用語ごとに採否を決める。

取り込みを始めるときの手順:

1. 訳者の許諾を得る。
2. 「外部の対訳資料から用語集 CSV を起こす」の節に従って抽出する。
   この出典は**対訳併記型** (見出しに原語が併記されている) なので、原典との
   対応付けは不要で、抽出のみで CSV が起こせる。
3. 上の表に出典・版・参照日・許諾の状況を追記する。
4. `node tools/lang-sync.mjs diff --only=shiropanda` → 用語ごとに採否を決める → `apply`。
   未訳キーがある場合は `prepare` も併用する。
