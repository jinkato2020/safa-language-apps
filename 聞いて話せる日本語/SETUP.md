# 「聞いて話せる日本語」プロジェクト

「聞いて話せるネパール語」(`com.safa.nepali.jp`) からフォークした、**日本語を学ぶ人向け** のアプリ。

- **対象言語 (Target)**: 日本語 (固定)
- **学習者言語 (Source)**: ネパール語 → 英語 → 韓国語 → 中国語... と順次拡大
- **方針**: 起動時に母語選択。コンテンツ（音声）はサーバーから DL。

---

## 元プロジェクトとの関係

- フォーク日: 2026-05-29
- フォーク元: `C:\Users\jwpsa\Documents\desktop\claude\ネパール語瞬間作文`
- フォーク元アプリ: 「聞いて話せるネパール語」v1.6.4 (App Store 公開済み)
- フォークスクリプト: `scripts/fork-to-japanese-app.mjs` (元プロジェクトにある)

---

## フォーク内容 (約 150MB / 9,693 ファイル)

| ディレクトリ/ファイル | 内容 | 用途 |
|---|---|---|
| `expo-app/` | React Native アプリ本体 | **要書き換え**: app.json の名前/Bundle ID 等 |
| `scripts/` | TTS 生成・データ加工 | そのまま流用可 |
| `japanese/` | 日本語音声 (会話 1,800ファイル) | **新アプリの target として再利用** |
| `nepali/` | ネパール語音声 (会話 1,800ファイル) | **新アプリの source として再利用** |
| `japanese-grammar/` | 日本語音声 (文法 600ファイル) | 同上 |
| `nepali-grammar/` | ネパール語音声 (文法 600ファイル) | 同上 |
| `瞬間作文.xlsx` | 会話例題マスター | データ流用可 (日本語側を target に) |
| `文法.xlsx` | 文法例題マスター | 同上 |
| `単語.xlsx` | 単語マスター | 同上 |
| `バイリンガル.xlsx` | i18n 翻訳 | ne UI を Primary に再構成 |
| `data/` | vocab.json 等 | 流用可 |
| `designs/` | デザイン素材 | 流用可 |

## 除外したもの

- `.env` (シークレット — 手動で作成)
- `.git/` (新規履歴)
- `node_modules/` (要 `npm install`)
- `.expo/`, `.claude/` (キャッシュ)
- `*.backup-*` (バックアップ)
- `safa-splash.mp4` (動画は別途)
- `credentials/`, `*.p8`, `*.p12` (機密鍵)

---

## 初期セットアップ

### 1. 依存関係インストール

```bash
cd "C:\Users\jwpsa\Documents\desktop\claude\聞いて話せる日本語"
npm install                      # ルートのスクリプト用
cd expo-app
npm install                      # アプリ本体用
```

### 2. .env 作成

`.env.example` を参考に `.env` を作成し、API キーを設定。

```
VITE_GOOGLE_TTS_API_KEY=...
VITE_ANTHROPIC_API_KEY=...
```

### 3. expo-app/app.json の更新

**変更が必要な項目:**

```json
{
  "expo": {
    "name": "聞いて話せる日本語",                ← ne 母語ユーザー用
    "slug": "ListenSpeakJapanese",              ← 新スラッグ
    "ios": {
      "bundleIdentifier": "com.safa.japanese"   ← 新 Bundle ID
    },
    "android": {
      "package": "com.safa.japanese"            ← 新パッケージ
    }
  }
}
```

### 4. アイコン・スプラッシュ差し替え

- `assets/icon.png` → 新ロゴ (日本語学習向けのモチーフ)
- `assets/adaptive-icon.png` → 同上
- `assets/splash-icon.png` → 同上

### 5. EAS プロジェクト新規作成

```bash
cd expo-app
npx eas init                     # 新規 projectId 発行
```

`app.json` の `extra.eas.projectId` と `updates.url` を新しい値に更新。

---

## アーキテクチャの方針 (新規)

### A. UI 言語固定

- **ネパール語 UI を Primary**（ne を デフォルト言語に）
- 英語 UI、韓国語 UI、中国語 UI を順次追加
- 日本語 UI は不要（日本人は「聞いて話せるネパール語」を使う）

→ `src/i18n/` の構造を ne 中心に再編成。`ja.json` は廃止または「日本語学習教材としての日本語」専用。

### B. 上下カード配置の方向性

- ne UI: ネパール語 上 / 日本語 下 (現状すでに対応済み)
- en UI: 英語 上 / 日本語 下
- ko UI: 韓国語 上 / 日本語 下

### C. 音声構造

```
target/        ← 日本語音声 (全ユーザー共通) ← japanese/* を流用
source-ne/     ← ネパール語音声 (ne ユーザーのみ) ← nepali/* を流用
source-en/     ← 英語音声 (将来生成)
source-ko/     ← 韓国語音声 (将来生成)
source-zh/     ← 中国語音声 (将来生成)
```

### D. コンテンツ重点

ネパール人向け日本生活コンテンツ (生活・仕事・在留関連):
- 在留資格、役所、病院、銀行、住居契約
- 仕事 (敬語、業界用語)
- 子育て、学校
- 災害・緊急時

→ 既存「瞬間作文.xlsx」「文法.xlsx」とは別のテーマ群を新規作成する想定。

---

## やるべきこと一覧

### 短期 (v1.0 リリースまで)

- [x] `expo-app/app.json` の名前/Bundle ID 更新 — 2026-05-29
- [x] EAS プロジェクト新規作成 (`npx eas init`) — 2026-05-29, projectId: `d8e3413b-cbb5-4ef4-823d-924e4176462a` (@jinkato1914/ListenSpeakJapanese)
- [ ] アイコン・スプラッシュ差し替え
  - スプラッシュは親アプリと共通の青 safa を維持
  - アプリアイコンは色変えで差別化（色未確定。候補: 朝日赤 / 桜ピンク / 紫 / オレンジ）
- [x] `src/i18n/` を ne 中心に再構成 — 2026-05-29
  - `detectSystemLang()` のフォールバックを `ne` に
  - ただし「システム言語が ja/ne ならそれを使う」ロジックは維持（ユーザー指示）
- [x] `src/SettingsContext.tsx` のデフォルト言語を ne に — 2026-05-29
  - 厳密には UI 言語管理は `src/i18n/index.tsx`
  - SettingsContext は学習方向のデフォルトを `ja2ne` → `ne2ja` に変更（ネパール人視点での日本語学習）
- [ ] 既存音声を `expo-app/assets/audio/` に流用 (export-to-expo.mjs を実行)
  - 親プロジェクトの音声・テーマをそのまま使えるかは未検証
- [ ] App Store / Play Store の新規アプリ申請
- [ ] スクリーンショット作成 (ne UI 版)
- [ ] プライバシーポリシー (URL は新規 or 共通)

### 完了済みの追加作業（2026-05-29 セッション）

- [x] ルート + expo-app で `npm install`
- [x] `.env` を親プロジェクトからコピー（Anthropic / Google TTS キー流用）
- [x] `expo-app/assets/safa-splash.mp4` を親から復元（フォーク時に除外されていた）
- [x] Android の `RECORD_AUDIO` permission を削除（eas init が自動追加したものを除去）
- [x] `npx expo install --fix` で `expo-localization` / `expo-updates` の推奨バージョンに更新
- [x] i18n の `app.name` / `shareMessage` / `mailSubject` を「聞いて話せる日本語」基準に修正
- [x] `README.md` を新プロジェクト用に書き換え（旧: ネパール語瞬間作文のコピー）
- [x] Expo Go (iOS) で動作確認: スプラッシュ → HOME 画面まで起動成功

### 中期 (生活コンテンツ追加)

- [ ] 在日ネパール人向け Excel データ作成
  - [ ] 在留資格・役所手続き 30 テーマ × 各 20 例題
  - [ ] 仕事・敬語 20 テーマ
  - [ ] 子育て・学校 15 テーマ
  - [ ] 災害・緊急 10 テーマ
- [ ] 上記音声生成 (Google TTS)
- [ ] テーマ分類を `themes.json` に追加

### 長期 (多言語ソース展開)

- [ ] 英語 UI 追加 (`en.json`)
- [ ] 英語音声生成 (Source = en)
- [ ] 韓国語 UI 追加
- [ ] 韓国語音声生成
- [ ] 中国語 UI 追加
- [ ] 中国語音声生成

### サーバーサイド (将来)

- [ ] Cloudflare R2 セットアップ
- [ ] manifest.json 設計
- [ ] アプリ内パックローダ実装
- [ ] 起動時の母語選択 → 該当パックのみ DL

---

## 関連プロジェクト

- 親プロジェクト: `C:\Users\jwpsa\Documents\desktop\claude\ネパール語瞬間作文`
- 既存アプリ: 聞いて話せるネパール語 v1.6.4
  - iOS: 審査通過済み
  - Android: Closed Testing 中

両プロジェクトは将来的に monorepo 化して共通コア + アプリ別設定に再構成する想定。

---

## 開発開始時のメッセージ (新セッション用)

新しい Claude セッションで作業を始める時:

```
このプロジェクトは「聞いて話せるネパール語」(C:\Users\jwpsa\Documents\desktop\claude\ネパール語瞬間作文) からフォークした
「聞いて話せる日本語」(ネパール人向け) です。SETUP.md を読んでください。

次は以下を進めたい:
- (具体的な作業を指示)
```

## 次セッションの想定スコープ: 共通化 / monorepo 化

2026-05-29 時点で、両プロジェクト（`聞いて話せるネパール語` / `聞いて話せる日本語`）の `expo-app/src/` には
ほぼ同一の React Native コードがあり、変更を片方に入れたらもう片方にも反映する必要がある。
これを解消するため、上の階層 (`C:\Users\jwpsa\Documents\desktop\claude\`) で共通コアを管理する方針。

**想定する作業:**
- workspaces ベースの monorepo 構造設計（npm workspaces / pnpm / Turborepo 等）
- 共通化対象の切り出し: `src/screens/`, `src/i18n/`, `src/SettingsContext.tsx`, `src/Text.tsx`, `src/theme.ts`, `src/dataLoader.ts`, `src/transliterate.ts` 等
- アプリ別差分の整理: `app.json`, `data/`, `assets/audio/` のみアプリ固有として残す
- アイコン・スプラッシュ素材の共通管理
