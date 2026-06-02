# 多言語・言語パック・ダウンロード方式 設計メモ

最終更新: 2026-06-02 / 対象: 聞いて話せる日本語 (App B、将来は共通化)

## 0. 目的 / ゴール
「聞いて話せる日本語」を、**母語を選べる多言語アプリ**にする。日本語(ja)を学習対象(L2)に固定し、
母語(L1)としてネパール語・バングラ語・韓国語…を**言語パック**として追加できるようにする。

データ(特に音声)が膨らむため、**全言語を同梱せず、選んだ言語パックをサーバー(GitHub Releases)から
ダウンロード**して使う。ダウンロード後はオフライン動作(現行の売りを維持)。

将来の**有料化**(言語パック課金)も見据え、今は「課金できる構造のフック」だけ仕込む(決済実装は後)。

### 要件サマリ
- 会話文 / 文法文 / 単語セット を言語ごとに切替できる。
- テーマ数は固定(30)ではなく**可変**(データ駆動)。
- 言語を選んで**ダウンロード**する方式(サーバー=GitHub Releases)。
- 一部アカウントだけ無料、を後で実現可能にする(プロモコード/RevenueCat)。

---

## 1. 用語
- **L2 (学習対象)**: 日本語(ja)。アプリ内で固定。
- **L1 (母語)**: 学習者の言語(ne/bn/ko…)。ユーザーが選択。
- **言語パック (pack)**: あるL1↔jaの1セット。テキスト+音声+i18n+辞書を含む配布単位。
- **カタログ (catalog/manifest)**: 利用可能パックの一覧(言語・版・サイズ・URL・access)。

---

## 2. 言語パックの構成 (案2: 日本語=共通コア + 母語オーバーレイ)
**App B は「学ぶ対象=日本語」が全L1で共通**。よって日本語(文+音声)は**アプリ本体に同梱(共通コア)**し、
**母語パック(母語訳+母語音声)だけサーバーからDL**する。これにより:
- 日本語音声の重複なし(1回だけ同梱)。
- 言語を増やしてもアプリ本体は太らない(増えるのは各母語のDL分のみ)。
- 「学ぶ対象(日本語)=共通」「あなたの言語(母語)=DL」という分離が綺麗。

**前提条件**: App B 内では**全L1が同じ日本語の文セットを学ぶ**(訳だけ言語ごとに差し替え)。
日本語の文/音声を変えたい時は共通コアを更新=アプリ更新(ストア申請)。日本語カリキュラムは安定なので実害小。

### 共通コア (アプリ同梱・App B)
```
(bundled in App B)
  ja-core/
    themes.json / levels.json / wordCategories.json / grammarThemes.json  # メタ(件数=可変)
    ja-sentences.json     # 文ID → { jp, kana, romaji }  (会話/文法)
    ja-words.json         # 単語ID → { ja }
    audio/ja/             # 日本語音声 (文ID/単語ID で参照)
```

### 母語オーバーレイ (DL・L1ごと)
```
pack-bn-v1/
  manifest.json          # l1, 表示名, version, access, ファイル一覧, sha
  i18n.json              # UI文言 (現行 ne.json 相当)
  translations.json      # 文ID → 母語訳 / 単語ID → 母語語 (共通コアのIDに対応)
  conv-vocab.json        # 会話 文脈辞書 (母語)
  grammar-vocab.json     # 文法 文脈辞書 (母語)
  audio/bn/              # 母語音声 (文ID/単語IDで参照)  ← DLの主役(重い)
```
- 画面は **共通コア(jp/ja音声/kana) ＋ 母語オーバーレイ(訳/母語音声) を文IDで結合**して表示。
- **テキストは軽量**、**重いのは音声** → DL対象の主役は**母語音声**。
- 日本語音声は同梱なので**1言語分で頭打ち**(言語追加で増えない)。

### アプリ間の独立性 (App A と App B)
- App A(ネパール語学習) と App B(日本語学習) は**別アプリ・別データ**。例文は独立に保守でき、別物にしてよい。
- 案2 は **App B 内(母語間)** の取り決め。App A には影響しない。
- 将来 App A も多言語化するなら、App A 用に「ネパール語=共通コア + 母語オーバーレイ」の鏡像を別途作る。

### manifest.json (パック単位) 例
```json
{
  "l1": "bn",
  "name": "বাংলা",
  "nameJa": "ベンガル語",
  "version": 1,
  "themeCount": 30,
  "access": "free",            // free | paid  (課金フック)
  "sizeBytes": 123456789,
  "files": [
    { "path": "examples.json", "sha256": "…", "bytes": 1234 },
    { "path": "audio/bn/1-1-1.mp3", "sha256": "…", "bytes": 2345 }
  ]
}
```

### catalog.json (全体カタログ / GitHub Releasesに配置) 例
```json
{
  "schema": 1,
  "packs": [
    { "l1": "ne", "name": "नेपाली", "nameJa": "ネパール語", "version": 3,
      "access": "free", "sizeBytes": 120000000,
      "url": "https://github.com/JinKato2020/safa-language-apps/releases/download/packs-v3/pack-ne-v3.zip" },
    { "l1": "bn", "name": "বাংলা", "nameJa": "ベンガル語", "version": 1,
      "access": "paid",  "sizeBytes": 110000000,
      "url": ".../pack-bn-v1.zip" }
  ]
}
```

---

## 3. ホスティング: GitHub Releases
- パックを **zip**にして GitHub Releases のアセットとして公開(タグ例 `packs-v3`)。
- `catalog.json` も Release アセット or リポジトリの固定URL(raw)で配信。
- 無料・CDN配信・バージョン管理が楽。将来 Cloudflare R2 等へ移行可(URLを差し替えるだけ)。
- 配布スクリプト(将来): pack生成 → zip → `gh release upload` で自動化。

---

## 4. クライアント (Expo) のダウンロード/保存/読み込み
- **取得**: `catalog.json` を fetch → 言語選択画面に一覧表示。
- **DL**: `expo-file-system` の `downloadAsync` でzip取得 → 展開 → `documentDirectory/packs/<l1>/` に保存。
  - zip展開はライブラリ要検討(`react-native-zip-archive` 等)。または個別ファイルDL(展開不要だが多数DL)。
- **読み込み**: 静的importを廃し、**保存済みJSONを実行時read**してAppDataに流し込む。
- **音声**: ローカルの `file://…` を `expo-audio` で再生(対応確認済みの前提)。
- **オフライン**: DL済みなら完全オフライン動作。
- **更新**: 起動時に catalog の version を確認 → 差分があれば再DLを促す。
- **既定パック**: 初回ネット必須を避けるなら、**最小1パック(例:ネパール語テキストのみ)を同梱**しUXを担保(任意)。

### ストレージ管理
- 各パックの**削除/再DL**をUIで提供(容量管理)。
- 破損対策: ファイルの sha256 を manifest と照合。

---

## 5. データモデルの一般化 (現状 → 目標)
現状はネパール語固定が各所に埋め込み:
- 型: `Word.ne` / `Example.ne` / 辞書キー=ネパール語 / 音声 `nepaliAudio` 等。
- `PracticeScreen` の `NE_PARTICLES_AND_PRONOUNS`(助詞除外)= ネパール語専用。
- `transliterate.ts` = Devanagari→ローマ字(ネパール語専用)。

目標:
- **L1を可変**にする。データは「L1テキスト」「ja訳」の汎用フィールドに。
- **言語別の付随ロジックをレジストリ化**:
  ```
  L1_CONFIG = {
    ne: { name:'नेपाली', script:'deva', romaji: toRomajiDeva, particleStop: NE_STOPWORDS },
    bn: { name:'বাংলা',  script:'beng', romaji: undefined,      particleStop: BN_STOPWORDS },
    ko: { name:'한국어',  script:'hang', romaji: undefined,      particleStop: KO_STOPWORDS },
  }
  ```
- ローマ字補助は**スクリプト別**(無い言語はオフ)。助詞除外フィルタも言語別(無ければ全表示)。

### テーマ可変
- 既に `THEMES.length` 等で**データ件数駆動**(30は固定値ではない)。
- 「30前提の決め打ち」が無いか点検し、i18nのテーマ名もパック内 i18n.json に統合。

---

## 6. 有料化フック (今は仕込みだけ・決済は後)
- パック manifest に **`access: free | paid`**。
- クライアントに **entitlement チェックの差し込み口**を1か所(今は常に解放)。
- 将来: `react-native-purchases` (RevenueCat) を導入 → entitlement に接続。
- **一部アカウント無料**: ①ストアのプロモコード ②RevenueCatのプロモ付与 ③アプリ内リデコード。
- 規約: アプリ内デジタル解放は **Apple IAP必須**(外部決済不可)。無料パックは自由。
- ※ログイン(アカウント)は現状無し。ストアのアカウント(Apple/Google)基盤を使えば**追加ログイン不要**で課金/一部無料が可能。

---

## 7. 段階プラン (実験ブランチ `experiment/bangla`、各段階で動作確認・後戻り可)
- **Phase 0 — 多言語化の土台 [無料]**
  - L1レジストリ + 母語スイッチ。データ読み込みを「パック・レジストリ」経由に。
  - ネパール語 + 手打ちサンプル数件(bn)で実証。データ生成/サーバー未着手=0円。
- **Phase 1 — 動的ロード化 [無料]**
  - 静的import廃止 → 実行時にローカルのパックJSONを読む構造へ。
- **Phase 2 — サーバーDL [要ホスティング(無料枠)]**
  - catalog.json + リモートDL(expo-file-system) + 言語選択UI + 版チェック。
- **Phase 3 — 音声の外部化 [本番化]**
  - 音声をDLアセット化、ローカル再生。pack生成→zip→GitHub Releases自動化。
- **(将来) Phase 4 — 有料化**
  - RevenueCat導入、access=paidのゲート、プロモコード運用。

---

## 8. 費用
- 設計・コード改修(Phase 0–1) = **無料**。
- サーバー(GitHub Releases) = **無料**。
- **有料(GO後のみ)**: 各言語の**テキスト生成(Anthropic API)** と **音声(Google TTS, 月100万字まで無料枠あり)**。
  - 本番生成前に**トークン量から概算費用を提示** → 承認後に実行。

---

## 9. リスク / 留意
- データ層の全面改修 → 画面/型/生成スクリプト/音声マップに波及。**Phase制+ブランチ**で安全に。
- zip展開ライブラリの選定(Expo Goでの動作可否)。個別ファイルDLなら回避可。
- 初回ネット必須のUX → 最小デフォルトパック同梱で緩和(任意)。
- 既存ユーザー(現バンドル版)からの**移行**: 初回起動でDL誘導、または現データをローカルパックへ変換。
- App Store審査: コンテンツDLはOK(コードDLは不可)。

---

## 10. 未決事項 (要決定)
- [ ] パックは **zip一括** か **個別ファイル** か(展開ライブラリ可否で判断)。
- [x] 日本語(文+音声)を共通化するか → **案2: する。日本語=共通コアをアプリ同梱、母語パックのみDL**(§2)。
      前提=全L1が同じ日本語文セットを学ぶ(訳だけ差替)。日本語変更はアプリ更新で対応。
- [x] App A と App B で例文を共有するか → **しない。アプリ毎に独立保守**(別データファイル。現状同一なのは種まきのため)。
- [ ] 既定パックを同梱するか(初回オフライン可否)。
- [ ] 有料化の対象(どの言語をfree/paidにするか)= Phase 4で決定。
