# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

---

# 将来計画: 聞き流しモードを RNTP へ移行

## 経緯
- v1.5.13: 事前結合 MP3 方式で Android バックグラウンド再生を実現（採用中）
- v1.5.14-1.5.17: 一時的に試行錯誤したが、最終的に v1.5.13 アプローチに戻った
- v1.5.17 で確認できた事実:
  - **react-native-track-player v5.0.0-alpha0** は当環境 (Expo SDK 54 + RN 0.81 + newArchEnabled=true) で **iOS / Android 両方ビルド成功**
  - つまり将来の RNTP 移行は技術的に実現可能

## 採用中 (v1.5.13+) の構成と制約
- 各 (theme × level × direction) を 1 つの長い MP3 に事前結合
- 出力: `assets/audio/listening/{conv,gram}-...-{direction}.mp3` 計 240 ファイル
- 結合スクリプト: `scripts/generate-listening-audio.mjs`
- **失われた機能**: シャッフル、ネパール語リピート回数 (1/2/3)

## RNTP 移行を提案すべきタイミング
以下のいずれかが発生したら検討:
1. ユーザーから「聞き流しモードでシャッフル機能が欲しい」要望が複数件
2. ユーザーから「ネパール語リピート回数を変えたい」要望
3. 動的なプレイリスト機能を追加したくなった時
4. アプリ容量を減らしたい時（結合 MP3 で +175 MB のため）
5. @rntp/player の有料ライセンスを購入する意思決定がされた時

## 移行手順の見通し
1. `npm install react-native-track-player@5.0.0-alpha0` または最新の @rntp/player
2. `PlaybackService` 登録 (index.ts または App.tsx)
3. ListeningScreen を RNTP API に書き換え（個別 MP3 ファイルベースに戻す）
4. PracticeScreen も RNTP に移行（expo-audio を全廃すれば一貫性アップ）
5. 結合 MP3 を削除してアプリサイズ縮小

## 注意点
- v5.0.0-alpha0 は alpha 品質、長期サポートなし（メンテナーが有料 @rntp/player に移行済み）
- 商用継続性が重要なら @rntp/player ($99/月) も選択肢
- 移行は段階的に（聞き流しモードのみ先に移行 → 動作確認 → 練習モードへ拡大 の順）
