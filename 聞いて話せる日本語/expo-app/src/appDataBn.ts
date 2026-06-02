// 聞いて話せる日本語: バングラ語(bn) サンプルパック (実証用・最小)。
// 案2: 共通コア(jaCore) は appData と共有し、bnオーバーレイ(訳)だけを差し替えて結合する。
// オーバーレイのデータは data/overlays/bn.json を単一ソースとする
// (同じJSONを Phase2 で GitHub Releases にも配置し、DL版と同一内容にする)。

import appJson from '../app.json';
import bnOverlayJson from '../data/overlays/bn.json';
import { jaCore } from './appData';
import { composePack, type L1Overlay } from './pack/compose';

const bnOverlay: L1Overlay = {
  nativeLang: bnOverlayJson.l1,
  examplesL1: bnOverlayJson.examplesL1,
  grammarL1: bnOverlayJson.grammarL1,
  wordsL1: bnOverlayJson.wordsL1,
};

export const appDataBn = composePack(jaCore, bnOverlay, { version: appJson.expo.version });
