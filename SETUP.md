# 聞いて話せる シリーズ — 開発ガイド（新セッション向け）

このファイルは、新しい Claude セッションでこのフォルダから作業を再開するための引き継ぎドキュメント。

## 移行情報

- 移行日: 2026-05-29
- 移行元 A: `C:\Users\jwpsa\Documents\desktop\claude\ネパール語瞬間作文` (削除可)
- 移行元 B: `C:\Users\jwpsa\Documents\desktop\claude\聞いて話せる日本語` (削除可)
- 移行スクリプト: `聞いて話せるネパール語/scripts/migrate-to-series.mjs`
- 総コピー: 25,312 ファイル / 523MB

### 除外したもの

- `node_modules/` (要 `npm install`)
- `.expo/` (キャッシュ)
- `*.backup-*` (Excel バックアップ)
- `~$*.xlsx` (Excel 一時ファイル)
- `old/` (古い作業)

### 含まれているもの（重要）

- `.env` ✓ (両アプリの API キー含む)
- `.git/` ✓ (App A のみ。push 先は同じ JinKato2020/LearningNepali)
- `.github/` ✓ (CI ワークフロー)
- `.claude/` ✓ (App A のみ。Claude Code 設定)
- expo-app の全ソース、データ、Excel、音声ファイル

---

## 開発開始までの手順

### 1. App A セットアップ（既に運用中のアプリの開発継続）

```bash
cd "C:\Users\jwpsa\Documents\desktop\claude\聞いて話せるシリーズ\聞いて話せるネパール語"
npm install                  # ルート (scripts 用)
cd expo-app
npm install                  # RN アプリ用

# 動作確認
npx expo start
```

`.env` は既にコピー済み。Git remote も維持されているので、そのまま push 可能。

### 2. App B セットアップ（新規アプリの開発）

```bash
cd "C:\Users\jwpsa\Documents\desktop\claude\聞いて話せるシリーズ\聞いて話せる日本語"
npm install
cd expo-app
npm install

# 動作確認
npx expo start
```

App B はまだ GitHub repo に紐付いていない。必要なら `git init` + new repo 作成。

### 3. 共通アセットの取り扱い

`共通アセット/safa-splash.mp4` と `共通アセット/designs/` は **正本（source of truth）** として置いてある。
各アプリの `expo-app/assets/safa-splash.mp4` は実体コピーで、Expo のバンドラがそれを参照する。

正本を更新したら、各アプリへ手動コピーが必要（または monorepo 化後は build スクリプトで自動コピー）。

---

## monorepo 化 ✅ 完了 (2026-05-29)

両アプリは `@safa/shared` パッケージを共有し、UI・設定ロジック・画面コードは一箇所で管理。
片方を変更したら両方に反映される。

### 実際の構造

```
聞いて話せるシリーズ/
├── package.json              ← workspaces root
├── packages/
│   └── shared/               ← @safa/shared
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                ← パブリック API
│           ├── AppShell.tsx            ← タブ・ナビ・スプラッシュ
│           ├── AppDataContext.tsx      ← データ DI
│           ├── SettingsContext.tsx     ← 設定 (defaults props)
│           ├── i18n/index.tsx          ← i18n (translations props)
│           ├── screens/                ← 9 画面全て
│           ├── Text.tsx, theme.ts, transliterate.ts, types.ts
│
├── 聞いて話せるネパール語/expo-app/
│   ├── package.json (@safa/nepali-app, depends on @safa/shared)
│   ├── App.tsx               ← 30 行未満 (Provider 4 つで包むだけ)
│   ├── metro.config.js       ← monorepo 対応
│   ├── tsconfig.json         ← paths で @safa/shared 解決
│   ├── data/                 ← アプリ固有 JSON + audioMap.ts
│   ├── assets/               ← アイコン + 音声
│   └── src/
│       ├── appData.ts        ← data/* を集約して AppData を作成
│       └── i18n/{ja,ne}.json ← アプリ固有の文言
│
└── 聞いて話せる日本語/expo-app/  ← App A と同様の構造
```

### App.tsx (例: 聞いて話せるネパール語)

```tsx
import { AppShell, I18nProvider, SettingsProvider, AppDataProvider } from '@safa/shared';
import ja from './src/i18n/ja.json';
import ne from './src/i18n/ne.json';
import { appData } from './src/appData';

export default function App() {
  return (
    <I18nProvider translations={{ ja, ne }} fallbackLang="ja" storageKey="@nepali_app/lang_v1">
      <SettingsProvider
        defaults={{ practiceDirection: 'ja2ne', listenDirection: 'ja2ne' }}
        storageKey="@nepali_app/settings_v2"
      >
        <AppDataProvider data={appData}>
          <AppShell
            splashSource={require('./assets/safa-splash.mp4')}
            headerIconSource={require('./assets/icon.png')}
          />
        </AppDataProvider>
      </SettingsProvider>
    </I18nProvider>
  );
}
```

### アプリ固有の差分（再現可能）

| 設定 | App A (ネパール語) | App B (日本語) |
|---|---|---|
| `I18nProvider.fallbackLang` | `ja` | `ne` |
| `SettingsProvider.defaults.practiceDirection` | `ja2ne` | `ne2ja` |
| `SettingsProvider.defaults.listenDirection` | `ja2ne` | `ne2ja` |
| `storageKey` | `@nepali_app/*` | `@japanese_app/*` |
| `app.json` Bundle ID | `com.safa.nepali.jp` | `com.safa.japanese` |
| 翻訳 `app.name` | "聞いて話せるネパール語" | "聞いて話せる日本語" |

### UI を変更したらどうなるか

`packages/shared/src/SettingsContext.tsx` を編集 → **両アプリに即反映** ✅
`packages/shared/src/screens/PracticeScreen.tsx` を編集 → **両アプリに即反映** ✅
`packages/shared/src/theme.ts` の色を変更 → **両アプリで色が変わる** ✅

### TypeScript チェック

ルートで:
```bash
npm run tsc:all       # 全パッケージ + 両アプリの TS チェック
npm run tsc:nepali    # App A だけ
npm run tsc:japanese  # App B だけ
```

### 開発開始 (実機 / シミュレータ)

```bash
# App A
cd 聞いて話せるネパール語/expo-app && npx expo start

# App B
cd 聞いて話せる日本語/expo-app && npx expo start
```

---

## 過去の monorepo 化計画（参考: 完了したもの）

旧版の「将来やる予定」はもう実施済み。以下はオリジナルの計画書として残しておく。

### オリジナル想定構造

### 想定構造（次の段階）

```
聞いて話せるシリーズ/
├── package.json              ← workspaces root
├── packages/
│   └── shared/
│       ├── package.json (name: "@safa/shared")
│       ├── src/
│       │   ├── screens/
│       │   ├── i18n/
│       │   ├── SettingsContext.tsx
│       │   ├── Text.tsx
│       │   ├── theme.ts
│       │   ├── dataLoader.ts
│       │   ├── transliterate.ts
│       │   └── types.ts
│       └── tsconfig.json
│
├── apps/
│   ├── nepali/                       ← 聞いて話せるネパール語
│   │   ├── expo-app/
│   │   │   ├── app.json
│   │   │   ├── App.tsx (imports from @safa/shared)
│   │   │   ├── index.ts
│   │   │   ├── data/
│   │   │   ├── assets/
│   │   │   │   ├── icon.png
│   │   │   │   ├── splash-icon.png
│   │   │   │   └── audio/
│   │   │   └── package.json (deps: @safa/shared)
│   │   ├── 音声ソース/        ← japanese, nepali, etc.
│   │   ├── データ/            ← Excel files
│   │   └── scripts/           ← App-specific (e.g. add-grammar-sheets)
│   │
│   └── japanese/                     ← 聞いて話せる日本語
│       └── (同様の構造)
│
├── scripts/                   ← 横断的なツール (TTS, export-to-expo)
└── 共通アセット/
```

### 移行ステップ

1. `npm workspaces` をルート `package.json` で有効化
2. `packages/shared` を作成し、共通コードを移動
3. 両アプリの `App.tsx` の import を `@safa/shared` 経由に
4. Metro / TypeScript の path 解決を設定
5. アプリ別の差分（app.json, データ）を整理
6. テスト実行 (両アプリで起動確認)

これは丸 1 日〜2 日かかる作業なので、別セッション専用にすべき。

---

## 現状の各アプリの状態

### App A: 聞いて話せるネパール語

- バージョン: **v1.6.4**
- iOS: 審査通過 (v1.0 が公開済み)
- Android: Closed Testing 中
- 最新の作業内容:
  - UI 言語切替（ja / ne）
  - 音声リピート対象を母語の反対側に
  - 単語リストのバイリンガル対応
  - 全体フォントスケール
  - Paywall デッドコード削除
  - 文法.xlsx 30 テーマ（新並び順）

### App B: 聞いて話せる日本語

- バージョン: **v1.0.0 (未公開)**
- iOS / Android: 未申請
- 完了済み:
  - app.json の Bundle ID/name 変更（`com.safa.japanese` / `ListenSpeakJapanese`）
  - EAS プロジェクト新規作成 (`d8e3413b-cbb5-4ef4-823d-924e4176462a`)
  - i18n を ne 中心に再構成
  - SettingsContext のデフォルトを `ne2ja` に
  - `.env` 流用
  - Expo Go (iOS) で起動確認
- 未着手:
  - アイコン差し替え（色違いで差別化予定）
  - 在日ネパール人向けコンテンツ
  - ストア申請

---

## 各アプリ内の主要ファイル

### `expo-app/app.json`
バンドル ID、バージョン、EAS projectId、プラグイン設定。

### `expo-app/src/`
React Native アプリの全コード（screens, i18n, theme, contexts, ...）。

### `expo-app/data/`
ビルド時に bundle される静的データ（grammarThemes.json, examples.json, audioMap.ts 等）。`scripts/export-to-expo.mjs` で再生成される。

### `expo-app/assets/audio/`
バンドルに含まれる音声ファイル。`scripts/export-to-expo.mjs` で source の音声フォルダ（`japanese/` 等）からコピーされる。

### `scripts/`
TTS 生成、Excel 加工、データ書き出しなどのスクリプト群。

### 音声ソースフォルダ（`japanese/`, `nepali/`, `japanese-grammar/`, `nepali-grammar/`）
生成された MP3 ファイルの保管場所。各アプリで:
- App A: japanese = source, nepali = target
- App B: japanese = target, nepali = source

ファイル名規則: `{themeId}-{exId}.mp3`（会話モードは `{themeId}-{levelId}-{exId}.mp3`）。

### Excel データソース
`瞬間作文.xlsx` (会話), `文法.xlsx` (文法), `単語.xlsx` (単語), `バイリンガル.xlsx` (i18n), `追加.xlsx` (修正用)

---

## 新セッション開始時のメッセージ（テンプレ）

```
このプロジェクトは「聞いて話せる」シリーズ（言語学習アプリ）です。
シリーズには 2 つのアプリがあり、共通フォルダで管理しています:
- 聞いて話せるネパール語 (App A, 公開済み)
- 聞いて話せる日本語 (App B, 開発中)

C:\Users\jwpsa\Documents\desktop\claude\聞いて話せるシリーズ\
の SETUP.md と README.md を読んでください。

次のタスク:
- [具体的な指示]
```

---

## 旧フォルダの削除

両アプリの移行が完全に動作確認できたら、以下のフォルダを削除可能:

```
C:\Users\jwpsa\Documents\desktop\claude\ネパール語瞬間作文
C:\Users\jwpsa\Documents\desktop\claude\聞いて話せる日本語
```

ただし数日はバックアップとして残すことを推奨。
