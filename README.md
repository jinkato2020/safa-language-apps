# 聞いて話せる シリーズ / Listen & Speak Series

「**学習対象言語ごとに別アプリ**、**母語(L1)はダウンロードパックで切り替え**」というアーキテクチャの言語学習アプリ・モノレポ。全例文にネイティブ音声、ローマ字補助、単語の文脈別辞書。広告なし・登録不要・無料。

最終更新: 2026-06-05

---

## アプリ

| | App A | App B |
|---|---|---|
| 名称 | 聞いて話せるネパール語 / Listen & Speak Nepali | 聞いて話せる日本語 / Listen & Speak Japanese |
| 学習対象(同梱コア) | 🇳🇵 ネパール語 | 🇯🇵 日本語 |
| 母語パック(L1・DL) | 🇯🇵 日本語 / 🇺🇸 英語 | 🇳🇵 ネパール語 / 🇧🇩 ベンガル語(/ 🇺🇸 英語=作成中) |
| UI言語 | ja / en / ne | ne / bn / ja |
| iOS | **公開中** `com.safa.nepali.jp` (id 6771720689) | TestFlight/β `com.safa.japanese` (id 6774461088) |
| Android | β(Closed Testing) | β |
| 版 | v1.6.x | v1.0.x |
| 主用途 | 英語/日本語話者がネパール語を学ぶ(旅行・トレッキング・在日ネパール人の家族) | ネパール/ベンガル話者が日本語を学ぶ(在日移民・就労・生活) |

> ⚠️ App B は website / ブログでは**未公開方針**(App A の β獲得を優先)。

---

## アーキテクチャ(案2: コア + L1オーバーレイ)

- **学習対象言語**＝アプリに**同梱(core)**。App A=`neCore`(ネパール語)、App B=`jaCore`(日本語)。
- **母語(L1)**＝**ダウンロードパック**。`composePack(core, overlay)` で結合し、レガシー `{jp, ne}` 形に整形して画面に供給。
- L1オーバーレイの中身: `examplesL1`/`grammarL1`(例文の訳)、`wordsL1`(単語訳)、`convVocab`/`grammarVocab`(**文脈別の単語分解辞書**)、`vocab`。
- 音声は**パックごとに1つのzip**を端末DL → `fflate` で展開して個別mp3に。overlayは `version`、音声は `audioVersion` で**別キャッシュ**(辞書だけ更新時は音声を再DLしない)。
- UIは `@safa/shared` に集約。各アプリの `App.tsx` は Provider 群で包んでマウントするだけ。

```
聞いて話せるシリーズ/                  (npm workspaces モノレポ)
├── packages/shared/        ← @safa/shared: 画面/ナビ/i18n/設定/パックローダ等 共通コア
├── 聞いて話せるネパール語/expo-app/   ← App A (Expo SDK 54 / RN 0.81 / React 19)
├── 聞いて話せる日本語/expo-app/       ← App B
├── packs/                  ← App B 配信パック (overlay/audio/catalog)
├── packs-nepali/           ← App A 配信パック
└── .github/workflows/      ← iOS/Android ビルド & パック公開
```

## コンテンツ規模(各アプリ)
- 会話: **30テーマ × 3レベル(初級/中級/上級) × 20例 = 1,800文**
- 文法: **30テーマ × 20例 = 600文**
- 単語: **1,000語(30カテゴリ)**
- すべてにネイティブ音声。

## 音声(TTS・確定)
Google Cloud TTS。声は明示固定(自動選択しない):
- 日本語 `ja-JP-Wavenet-A` / 英語 `en-US-Wavenet-F` / ネパール語 **`hi-IN-Chirp3-HD-Kore`**(最高品質Chirp3-HD・ne-NP音声が無いためhi-IN) / ベンガル語 `bn-IN-Wavenet-A`

---

## パック配信(本番: GitHub Releases)

- App A → Release タグ **`packs-appa`** / App B → **`packs-appb`**。アプリの `packLoader.ts` の `CATALOG_URL` がこれを参照。
- **CI自動公開**: `experiment/bangla` ブランチの `packs-nepali/**`(A)・`packs/**`(B) を push すると、`.github/workflows/publish-packs-app{a,b}.yml` が `GITHUB_TOKEN` で Release を作り直す(catalogのURLはCIがRelease URLへ書換)。`gh` はローカル未使用。
- 旧クライアントは引き続き `experiment/bangla` の raw を参照(無停止移行)。
- Release のダウンロードURLは **User-Agent 必須**(RN実機は自動送出)。

## ビルド & リリース

- **トリガー**: `main` への push で `ios-build-{nepali,japanese}.yml` が iOS+Android をビルド → TestFlight / Play 内部テスト(draft)へ自動提出。対象パス: `<app>/expo-app/**`, `packages/shared/**`, `package.json` 等。
- **ビルド番号**: `BUILD_NUMBER = 1000 + git rev-list --count HEAD`(workflowリネーム耐性のため)。
- **版数タグ**: ビルドした版を `appA-v<version>-<build>` / `appB-v<version>-<build>` の git tag で記録。

## 開発

```bash
npm install                 # ルートで(workspaces)
npm run tsc:all             # 型チェック(shared + 両アプリ)
# 各アプリ: 聞いて話せる<app>/expo-app/ で expo 開発。詳細は SETUP.md
```

- 型チェックは `tsc:shared` / `tsc:nepali` / `tsc:japanese` / `tsc:all`。
- スクリプト類は各 `expo-app/scripts/`(音声生成・辞書生成・パック書き出し等)。
- パック書き出し: `expo-app/scripts/export-packs.mjs`(overlay+audio zip+catalog を `packs/`・`packs-nepali/` に生成)。

## 関連
- 公式サイト/LP/ブログ: `safa-lang.com`(別repo `JinKato2020/safa-lang-site` / ローカル `app_website`)
- リポジトリ: `JinKato2020/safa-language-apps`(public)
- 詳細手順は `SETUP.md`、各アプリの `expo-app/AGENTS.md`
