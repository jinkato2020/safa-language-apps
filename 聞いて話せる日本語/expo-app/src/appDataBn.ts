// 聞いて話せる日本語: バングラ語(bn) サンプルパック (実証用・最小)。
// 案2: 共通コア(jaCore) は appData と共有し、bnオーバーレイ(訳)だけを差し替えて結合する。
// 訳が無い文は jp のみ表示 (共通コア + 疎なオーバーレイ = 案2の自然な形)。音声は無し(Phase3)。

import appJson from '../app.json';
import { jaCore } from './appData';
import { composePack, type L1Overlay } from './pack/compose';

// ── バングラ語オーバーレイ (jaCore と同じキー・同じ位置で対応。今はテーマ1のみ) ──
const bnOverlay: L1Overlay = {
  nativeLang: 'bn',
  examplesL1: {
    '1-1': ['আমার নাম তানাকা।', 'আমি জাপানি।', 'আপনার সাথে পরিচিত হয়ে ভালো লাগলো।'],
  },
  grammarL1: {
    '1': ['আমি ছাত্র।', 'সে ডাক্তার।'],
  },
  wordsL1: {
    '1': ['উপরে', 'নিচে', 'ডান', 'বাম'],
  },
};

export const appDataBn = composePack(jaCore, bnOverlay, { version: appJson.expo.version });
