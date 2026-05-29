# 🇳🇵 ネパール語 瞬間作文

日本語を見て5秒以内にネパール語へ変換する練習アプリ。例文は Anthropic API（Claude）で動的生成し、Web Speech API（`ne-NP`）で音声を読み上げます。

## 機能

- 会話テーマ 30 種 / 文法分野 30 種、計 60 カテゴリー
- 各カテゴリーで 20 問を毎回 API から動的生成
- 5 秒カウントダウン後に答え（デーヴァナーガリー＋ローマ字）を自動表示
- 答えと同時にネパール語音声を自動再生
- 文法カテゴリーでは文法ポイントの解説付き

## 起動手順

1. 依存をインストール
   ```bash
   npm install
   ```
2. `.env.example` をコピーして `.env` を作成し、Anthropic API キーを設定
   ```bash
   cp .env.example .env
   # .env を編集して VITE_ANTHROPIC_API_KEY に実際のキーを入れる
   ```
3. 開発サーバを起動
   ```bash
   npm run dev
   ```
4. ブラウザで http://localhost:5173 を開く

## ⚠️ セキュリティ上の注意

`VITE_` プレフィックスの環境変数はビルド時にバンドルへ埋め込まれ、**ブラウザから API キーが見えます**。本アプリはローカル個人利用を想定しています。公開デプロイする場合は、API キーをサーバ側で保持するプロキシを別途用意してください。

## 音声について

ネパール語音声は **Google Cloud Text-to-Speech API**（`ne-NP-Standard-A`）を使用。APIキーが未設定または失敗時はブラウザの Web Speech API にフォールバックします。

### Google Cloud TTS APIキーの取得手順

1. https://console.cloud.google.com にアクセスしてログイン（Googleアカウント）
2. 新しいプロジェクトを作成（例: `nepali-app`）
3. 左メニュー「APIとサービス」→「ライブラリ」→ **「Cloud Text-to-Speech API」** を検索して有効化
4. 「APIとサービス」→「認証情報」→「認証情報を作成」→ **「APIキー」**
5. 表示されたキーをコピー
6. （推奨）作成したAPIキーをクリック → 「APIの制限」で **Cloud Text-to-Speech API** のみに限定
7. `.env` の `VITE_GOOGLE_TTS_API_KEY` に貼り付け、Viteを再起動

### 料金
- **Standard ボイス**: 月400万文字まで無料
- **WaveNet ボイス**: 月100万文字まで無料
- このアプリの利用量（1問〜30文字 × 数百問）は無料枠に余裕で収まる
- 無料枠を超えると Standard $4 / 100万文字、WaveNet $16 / 100万文字
- 課金有効化にクレジットカード登録が必要（無料枠内なら請求発生しない）

## モデル

`claude-sonnet-4-6` を使用。`src/api/claude.js` の `MODEL` 定数で変更可能。
