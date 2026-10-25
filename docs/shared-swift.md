# iPad 版と Mac 版の共有 Swift を確認する

`Shared/` は typle-r の `ios/Typle/`、`TypleCore/` は `ios/TypleCore/` に対応します。どちらも、それより下のパスは同じです。共通機能を手で取り込む前に、`scripts/check-shared-swift.cjs` で差分を確認します。Git と Node.js 20 以上を使い、macOS 以外でも動きます。ネットワークへの接続、コードの書き換え、差分の自動適用はしません。

## 確認した構成

2026-10-25 に、次の main 同士を照合しました。

- Mac: [typle-m `db84454`](https://github.com/Sparklingstadt/typle-m/commit/db84454)
- Web・iPad: [typle-r `c3d1a03`](https://github.com/Sparklingstadt/typle-r/commit/c3d1a03af424e1db0be6ebd9595c55bf46827b69)（v0.89.0）
- 分割の経緯: [typle-r PR #123](https://github.com/Sparklingstadt/typle-r/pull/123)。コピーの元は v0.86.1。分割後に iPad 側から Mac 用の条件分岐と何もしない補助メソッドが取り除かれています。

共有対象の Swift は 35 組（`Shared` 21、`TypleCore` 14）です。`TypleCore` の Swift は全ファイル一致し、`Shared` の差分は下記の確認済み Mac 対応だけでした。この比較で意図しない共有 Swift の差分は見つかりませんでした。ビルドや実機の動作を保証する検査ではありません。

| typle-m | typle-r |
|---|---|
| `Shared/AppModel.swift` | `ios/Typle/AppModel.swift` |
| `Shared/TypleApp.swift` | `ios/Typle/TypleApp.swift` |
| `Shared/Design/Theme.swift` | `ios/Typle/Design/Theme.swift` |
| `Shared/Devices/DevicesView.swift` | `ios/Typle/Devices/DevicesView.swift` |
| `Shared/Home/HomeView.swift` | `ios/Typle/Home/HomeView.swift` |
| `Shared/Lists/ListEditorView.swift` | `ios/Typle/Lists/ListEditorView.swift` |
| `Shared/Lists/ListsView.swift` | `ios/Typle/Lists/ListsView.swift` |
| `Shared/Practice/PracticeModel.swift` | `ios/Typle/Practice/PracticeModel.swift` |
| `Shared/Practice/PracticeParts.swift` | `ios/Typle/Practice/PracticeParts.swift` |
| `Shared/Practice/PracticeResultView.swift` | `ios/Typle/Practice/PracticeResultView.swift` |
| `Shared/Practice/PracticeView.swift` | `ios/Typle/Practice/PracticeView.swift` |
| `Shared/Records/RankingsView.swift` | `ios/Typle/Records/RankingsView.swift` |
| `Shared/Records/RecordsView.swift` | `ios/Typle/Records/RecordsView.swift` |
| `Shared/Settings/GeneralSettingsView.swift` | `ios/Typle/Settings/GeneralSettingsView.swift` |
| `Shared/Storage/AccountClient.swift` | `ios/Typle/Storage/AccountClient.swift` |
| `Shared/Storage/AccountWorkspaceStore.swift` | `ios/Typle/Storage/AccountWorkspaceStore.swift` |
| `Shared/Storage/Keychain.swift` | `ios/Typle/Storage/Keychain.swift` |
| `Shared/Storage/WorkspaceStore.swift` | `ios/Typle/Storage/WorkspaceStore.swift` |
| `Shared/Support/DemoData.swift` | `ios/Typle/Support/DemoData.swift` |
| `Shared/Support/Localization.swift` | `ios/Typle/Support/Localization.swift` |
| `Shared/Support/Platform.swift` | `ios/Typle/Support/Platform.swift` |
| `TypleCore/Package.swift` | `ios/TypleCore/Package.swift` |
| `TypleCore/Sources/TypleCore/AccountWorkspace.swift` | `ios/TypleCore/Sources/TypleCore/AccountWorkspace.swift` |
| `TypleCore/Sources/TypleCore/Dashboard.swift` | `ios/TypleCore/Sources/TypleCore/Dashboard.swift` |
| `TypleCore/Sources/TypleCore/Dates.swift` | `ios/TypleCore/Sources/TypleCore/Dates.swift` |
| `TypleCore/Sources/TypleCore/Devices.swift` | `ios/TypleCore/Sources/TypleCore/Devices.swift` |
| `TypleCore/Sources/TypleCore/Models.swift` | `ios/TypleCore/Sources/TypleCore/Models.swift` |
| `TypleCore/Sources/TypleCore/Rankings.swift` | `ios/TypleCore/Sources/TypleCore/Rankings.swift` |
| `TypleCore/Sources/TypleCore/Records.swift` | `ios/TypleCore/Sources/TypleCore/Records.swift` |
| `TypleCore/Sources/TypleCore/Typing.swift` | `ios/TypleCore/Sources/TypleCore/Typing.swift` |
| `TypleCore/Sources/TypleCore/WordFiles.swift` | `ios/TypleCore/Sources/TypleCore/WordFiles.swift` |
| `TypleCore/Sources/TypleCore/WordLists.swift` | `ios/TypleCore/Sources/TypleCore/WordLists.swift` |
| `TypleCore/Sources/TypleCore/Workspace.swift` | `ios/TypleCore/Sources/TypleCore/Workspace.swift` |
| `TypleCore/Tests/TypleCoreTests/DashboardTests.swift` | `ios/TypleCore/Tests/TypleCoreTests/DashboardTests.swift` |
| `TypleCore/Tests/TypleCoreTests/TypleCoreTests.swift` | `ios/TypleCore/Tests/TypleCoreTests/TypleCoreTests.swift` |

`Shared/Resources/` も `ios/Typle/Resources/` の翻訳リソースに由来します。ただし、この検査は `.swift` に限定します。翻訳のローカル整合性は既存の `tests/strings.test.cjs` が検証します。`TypleCore/Sources/TypleCore/Resources/*.json` の初期リストや Android 版との JSON 同期も、この検査には含めません。

## 除外する差分

[`scripts/shared-swift-platform.patch`](../scripts/shared-swift-platform.patch) は、確認済みのプラットフォーム差分 13 ファイル・25 ハンクの一覧です。パッチを適用するためのものではありません。スクリプトは **対応するパスと、前後 3 行を含むハンクの内容が完全に同じ場合だけ**、その差分を表示から除きます。行番号は一致を求めませんが、同じ除外を確認済みの個数より多く使うことはありません。ファイル全体や `#if` 内を一括で無視しません。

| 対象 | 確認済みの差分の理由 |
|---|---|
| `Design/Theme.swift` | UIKit／AppKit の色、入力欄の設定、Mac のメニュー・ピッカー・シートの補助メソッド |
| `Devices/DevicesView.swift`、`Lists/ListEditorView.swift`、`Practice/PracticeParts.swift`、`Records/RankingsView.swift`、`Records/RecordsView.swift` | Mac 用メニュー・ピッカー・シートの補助メソッド呼び出し。ListEditor の説明コメントも含む |
| `Lists/ListsView.swift` | メニューと、iPad の共有シートに対する Mac の CSV 保存処理 |
| `Settings/GeneralSettingsView.swift` | URL キーボードの iOS 条件分岐 |
| `Storage/Keychain.swift`、`Storage/WorkspaceStore.swift` | iOS のファイル・キーチェーン保護属性と説明コメント |
| `Support/Localization.swift` | Mac.strings を先に読む処理と説明コメント |
| `Support/Platform.swift` | ログイン client、ローカル保存名、アイコン、デモ端末名と説明コメント |
| `TypleApp.swift` | Mac のウインドウサイズ、メニューバー、Debug スクリーンショット |

一覧のパスは `Shared/` からの相対パスです。この範囲のファイルでも、共有ロジックや色の値などが変われば要確認になります。既知の差分のすぐ近くが変わった場合は、Mac 専用の部分も含めてハンクを表示します。新しい Mac 専用実装も自動では除外しません。

iPad の `ios/Typle/Practice/PracticeTextField.swift` だけはファイル単位で対象外です。Mac の入力欄は `Typle/Practice/PracticeTextField.swift` の AppKit 実装に置き換わっています。iPad の入力・IME 修正が Mac にも関係するかは手で判断します。`Typle/` のメニュー・アイコン・Mac.strings、XcodeGen の設定も Mac 固有のため対象外です。`.build/`、`.swiftpm/`、`build/`、`DerivedData/`、`xcuserdata/`、`.git/` は生成物として探索しません。

## 手元で確認する

双方の確認対象ブランチを自分で最新にしてから、typle-m のルートで実行します。比較するのは指定したチェックアウトの現在のファイルで、未コミットの変更も含みます。スクリプトが fetch やブランチの切り替えをすることはありません。

```sh
TYPLE_R="/path/to/typle-r" node scripts/check-shared-swift.cjs
# 隣にチェックアウトしてある場合
TYPLE_R=../typle-r node scripts/check-shared-swift.cjs
```

終了コードは `0` が未確認差分なし、`1` が要確認、`2` がチェックアウト未指定・パス誤り・Git の実行エラーなどです。設定エラーを成功扱いにはしません。`[changed]`、`[iPad-only]`、`[Mac-only]` と対応パスを表示し、`-` は Mac、`+` は iPad の内容です。追加と削除のどちらも確認対象になります。スクリプトの場所を基準に Mac 側を探すため、実行時の作業ディレクトリには依存しません。

通常の Node テストからも実行できます。

```sh
TYPLE_R="/path/to/typle-r" node --test tests/
(cd TypleCore && swift test)
```

Node.js 24 など、ディレクトリ指定を受け付けないバージョンでは `TYPLE_R="/path/to/typle-r" node --test tests/*.test.cjs` を使います。`TYPLE_R` を指定しない通常の Node テストでは、実リポジトリ間の照合だけを理由付きでスキップします。検証スクリプトの回帰テストと既存の文言テストは実行します。未指定のテストが成功しても、iPad 版との同期を確認したことにはなりません。

## 差分を取り込む

1. 差分と iPad 側の変更履歴を読み、共通機能の修正か、片方だけの機能かを判断します。ファイルが片方にだけある場合も、即座にコピー・削除はしません。
2. 共通機能の変更と対応する Swift テストを、作業ブランチで手動で取り込みます。Mac の入力欄・CSV 保存・キーボード操作・保存名などを確認します。
3. `TYPLE_R` 付きの Node テストと `TypleCore` の `swift test` を実行します。UI を変更したときは macOS でビルド・動作確認も行います。
4. 意図的な Mac 差分の文脈も変わった場合は、共有変更を取り込んだことを確認したうえで、一覧の該当ハンクだけを更新します。未反映の共通変更を除外する目的で、出力全部を一覧に登録しないでください。自動更新コマンドは設けていません。

これはローカル検証です。GitHub Actions の導入・リモート監視・共有コードの自動コピーは含めません。
