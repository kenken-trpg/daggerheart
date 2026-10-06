# このリポジトリは廃止されました

Daggerheart の日本語化は、システムのフォークではなく **Babele 翻訳モジュール**に移行しました。

→ **https://github.com/kenken-trpg/daggerheart-ja**

このリポジトリは読み取り専用です。更新は行われません。

## なぜ移行したのか

このフォークは、公式システムと並べて入れられるよう system id を `daggerheart-ja` に変更していました。
その結果、`daggerheart` システムを宣言している公式モジュールが一切有効化できなくなります。
この制限はサーバー側で強制されるため、システム側のコードでは回避できません。

翻訳モジュールなら公式システムをそのまま使うので、公式モジュールと併用できます。

## すでにこのフォークを入れている方へ

このフォークで作成したワールドは system `daggerheart-ja` に紐づいており、
Foundry はワールドの system を後から変更できません。移行には作り直しが必要です。

1. 公式システム（[Foundryborne/daggerheart](https://github.com/Foundryborne/daggerheart)）をインストールする
2. 公式システムで新しいワールドを作成する
3. [daggerheart-ja](https://github.com/kenken-trpg/daggerheart-ja) モジュールと、Babele / lib-wrapper を有効化する
4. アクターやアイテムは、旧ワールドからエクスポートして新ワールドにインポートする

既存のインストールを壊さないため、`system.json` と過去のリリース（2.10.7.1 / 2.10.7.2）は
そのまま残してあります。更新は配信されません。

## 元のシステムについて

このリポジトリは [Foundryborne/daggerheart](https://github.com/Foundryborne/daggerheart) のフォークです。
システム本体の README、ドキュメント、ライセンスは上流を参照してください。
Critical Role および Darrington Press とは関係ありません。
