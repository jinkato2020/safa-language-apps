# 聞いて話せる日本語

ネパール語話者向け 日本語学習アプリ。日本語の例文を「聞いて」「話す」瞬間作文トレーニングで、生活・仕事・在留関連の表現を効率よく習得する。

- **対象言語 (Target)**: 日本語
- **学習者言語 (Source)**: ネパール語 → 英語・韓国語・中国語… と順次拡大予定
- **想定ユーザー**: 在日ネパール人を中心とした日本語学習者
- **構成**: 親プロジェクト「聞いて話せるネパール語」(`com.safa.nepali.jp`) からフォークした姉妹アプリ

詳細なプロジェクト方針・引き継ぎ手順は [SETUP.md](SETUP.md) を参照。
アプリ仕様の全体像は [PROJECT_SPEC.md](PROJECT_SPEC.md) を参照。

---

## ディレクトリ構成

```
聞いて話せる日本語/
├── expo-app/              React Native (Expo SDK 54+) アプリ本体
├── scripts/               例題生成・音声合成・データ加工スクリプト
├── japanese/              日本語音声 (会話 1,800 ファイル)
├── nepali/                ネパール語音声 (会話 1,800 ファイル)
├── japanese-grammar/      日本語音声 (文法 600 ファイル)
├── nepali-grammar/        ネパール語音声 (文法 600 ファイル)
├── data/                  vocab.json 等の辞書データ
├── designs/               デザイン素材
├── 瞬間作文.xlsx           会話例題マスター
├── 文法.xlsx               文法例題マスター
├── 単語.xlsx               単語マスター
├── バイリンガル.xlsx        i18n 翻訳マスター
├── privacy-policy.md      プライバシーポリシー
├── SETUP.md               引き継ぎ・初期セットアップ手順
└── PROJECT_SPEC.md        アプリ仕様書
```

---

## 起動手順

### 1. 依存関係インストール

```bash
npm install                      # ルート (スクリプト用)
cd expo-app && npm install       # アプリ本体
```

### 2. .env 作成

`.env.example` を参考に `.env` を作成し、API キーを設定。

```
VITE_ANTHROPIC_API_KEY=...
VITE_GOOGLE_TTS_API_KEY=...
```

スクリプト類（例題生成・TTS）で利用。アプリ本体の起動には不要。

### 3. Expo dev サーバー起動

```bash
cd expo-app
npx expo start
```

QR を Expo Go (iOS は標準カメラ → Expo Go へ) でスキャンして実機起動。

---

## EAS

- Expo Project: [@jinkato1914/ListenSpeakJapanese](https://expo.dev/accounts/jinkato1914/projects/ListenSpeakJapanese)
- projectId: `d8e3413b-cbb5-4ef4-823d-924e4176462a`
- Bundle ID / Package: `com.safa.japanese`

### ビルドコマンド

```bash
cd expo-app
eas build --platform android --profile preview      # APK (実機テスト用)
eas build --platform android --profile production   # AAB (Play Store 用)
eas build --platform ios --profile production       # IPA (App Store 用)
```

---

## 関連プロジェクト

- 親プロジェクト: `C:\Users\jwpsa\Documents\desktop\claude\ネパール語瞬間作文`
- 親アプリ: 聞いて話せるネパール語 v1.6.4
  - iOS: 審査通過済み
  - Android: Closed Testing 中

両プロジェクトは将来的に monorepo 化して共通コア + アプリ別設定に再構成する想定。

---

## ライセンス

個人開発、非公開。
