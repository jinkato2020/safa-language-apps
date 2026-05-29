# 聞いて話せる シリーズ

「学習対象言語ごとに別アプリ、母語ソースは中で切り替え」というアーキテクチャで構築された言語学習アプリのシリーズ。

## 構成（2026-05-29 時点）

```
聞いて話せるシリーズ/
├── README.md                    ← このファイル
├── SETUP.md                     ← 開発開始ガイド
├── 共通アセット/
│   ├── safa-splash.mp4          ← シリーズ共通スプラッシュ動画
│   └── designs/                  ← デザイン素材
│
├── 聞いて話せるネパール語/      ← App A
│   └── (詳細は SETUP.md)
│
└── 聞いて話せる日本語/          ← App B
    └── (詳細は SETUP.md)
```

## App A: 聞いて話せるネパール語

| 項目 | 値 |
|---|---|
| 対象 (Target) | 🇳🇵 ネパール語 |
| 学習者 (Source) | 🇯🇵 日本語 → 🇺🇸 英語 → 🇰🇷 韓国語 → 🇨🇳 中国語 ... |
| iOS Bundle ID | `com.safa.nepali.jp` |
| App Store | 審査通過済み (v1.6.4) |
| Google Play | Closed Testing 中 |
| 主用途 | 日本人がネパール語を学ぶ。在ネパール日本人、トレッキング・観光・赴任 |
| GitHub | JinKato2020/LearningNepali |

## App B: 聞いて話せる日本語

| 項目 | 値 |
|---|---|
| 対象 (Target) | 🇯🇵 日本語 |
| 学習者 (Source) | 🇳🇵 ネパール語 → 🇺🇸 英語 → 🇰🇷 韓国語 → 🇨🇳 中国語 ... |
| iOS Bundle ID | `com.safa.japanese` (新規) |
| 状態 | 開発初期 (EAS init 済み) |
| 主用途 | ネパール人が日本語を学ぶ。在日ネパール人、就労、子育て、役所手続き |
| EAS Project | `@jinkato1914/ListenSpeakJapanese` |

---

## 戦略・思想

### 1 アプリ = 1 学習対象言語

「Learn Japanese」「Learn Nepali」のように対象言語でアプリを分け、各アプリ内で母語を選ぶ。これで:

- ASO（App Store 検索）に強い
- ストアリスティングを各国語にローカライズ可能
- 学習者ごとに最適化されたコンテンツを提供できる
- 母語別に音声をパック化 → 必要な分だけ DL（将来）

### 母語ごとの音声 DL（将来）

```
cdn.safa-lang.com/
├── nepali/                  ← App A 用
│   ├── target/              ← ネパール語音声 (全ユーザー共通)
│   ├── source-ja/           ← 日本人ユーザーだけ DL
│   ├── source-en/
│   └── ...
└── japanese/                ← App B 用
    ├── target/              ← 日本語音声 (全ユーザー共通)
    ├── source-ne/
    └── ...
```

詳細な戦略は親プロジェクトのチャット履歴を参照。

---

## 次のセッションで着手したい主要トピック

### 短期
- [ ] App B (聞いて話せる日本語) のアイコン差し替え（色違いで差別化）
- [ ] App B を Expo Go で動作確認（既に起動成功している）
- [ ] App B の App Store / Play Store 新規申請準備

### 中期
- [ ] **monorepo 化**: 両アプリの `expo-app/src/` の重複コードを共通パッケージ化
  - `共通コード/src/` に移動 (`@safa/shared` のようなパッケージ)
  - npm workspaces / pnpm / Turborepo 等
  - アプリ別に残すもの: `app.json`, `data/`, `assets/icon.png`, `assets/audio/`
- [ ] 在日ネパール人向けコンテンツの Excel データ作成
  - 在留資格、役所、医療、子育て、災害 など
- [ ] 上記コンテンツの TTS 音声生成

### 長期
- [ ] サーバーサイドのコンテンツパック配信（Cloudflare R2）
- [ ] アプリ内パックローダ実装（起動時 DL）
- [ ] 多言語ソース対応（en/ko/zh）

---

## 関連リソース

- 親アプリ A の旧パス: `C:\Users\jwpsa\Documents\desktop\claude\ネパール語瞬間作文`
- 親アプリ B の旧パス: `C:\Users\jwpsa\Documents\desktop\claude\聞いて話せる日本語`
- 両旧フォルダはこのシリーズ移行後、削除可能（ただしバックアップとして数日残すことを推奨）
