// シンプルな i18n 実装。react-i18next 等の重いライブラリは使わず、
// JSON 翻訳ファイル + React Context で軽量に構築。
//
// アプリ側から translations と fallbackLang を props で受け取り、
// 同じシェルで複数の (target × source) アプリを動かせるようにしている。
//
// 使い方 (アプリ側):
//   <I18nProvider translations={{ ja, ne }} fallbackLang="ja">
//
// 使い方 (画面側):
//   const { t, lang, setLang } = useI18n();
//   <Text>{t('settings.title')}</Text>
//
// 現在の言語で見つからなければ fallbackLang のキーに、それでも無ければキー自体を返す。

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

// shared では翻訳ファイルを直接 import しない。アプリ側から渡す。
// Lang 型は アプリ側 i18n のキー（ja/ne/en/ko/zh など）を表す抽象。
export type Lang = string;

type Translations = Record<string, any>;

type I18nValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** 利用可能な言語コード一覧 (translations のキー)。言語選択UIの動的生成に使う。 */
  langs: Lang[];
};

const I18nCtx = createContext<I18nValue | null>(null);
const STORAGE_KEY = '@safa/lang_v1';

// デバイスのシステム言語から初期言語を推定 (利用可能な lang リスト内のみ)
function detectSystemLang(availableLangs: Lang[]): Lang | null {
  try {
    const locales = Localization.getLocales();
    for (const l of locales) {
      const code = (l.languageCode || '').toLowerCase();
      if (availableLangs.includes(code)) return code;
    }
  } catch {}
  return null;
}

// 入れ子オブジェクトからドット区切りキーで値を取り出す
function pick(obj: any, key: string): string | undefined {
  const parts = key.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? `{{${k}}}`));
}

type ProviderProps = {
  children: ReactNode;
  /** アプリ側で読み込んだ翻訳セット。例: { ja: jaJson, ne: neJson } */
  translations: Record<Lang, Translations>;
  /** どの言語にも見つからない場合のフォールバック (アプリのプライマリ言語) */
  fallbackLang: Lang;
  /** ユーザーが選択/自動検出できる言語 (設定UIの対象)。未指定なら translations 全部。
   *  学習対象言語(例: App B の ja)を除外するのに使う。translations にはフォールバック用に残せる。 */
  selectableLangs?: Lang[];
  /** AsyncStorage に保存するキー (アプリごとに別。デフォルトはシリーズ共通) */
  storageKey?: string;
};

export function I18nProvider({ children, translations, fallbackLang, selectableLangs, storageKey = STORAGE_KEY }: ProviderProps) {
  const selectable = selectableLangs ?? Object.keys(translations);
  const [lang, setLangState] = useState<Lang>(() => {
    const detected = detectSystemLang(selectable);
    return detected || fallbackLang;
  });
  const [loaded, setLoaded] = useState(false);

  // 初回ロード: AsyncStorage に保存された設定を優先
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw && selectable.includes(raw)) {
          setLangState(raw);
        }
      } catch {}
      setLoaded(true);
    })();
  }, [storageKey]);

  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(storageKey, l).catch(() => {});
  };

  const t = useMemo(() => {
    return (key: string, params?: Record<string, string | number>): string => {
      // 1) 現在の言語で探す
      const cur = pick(translations[lang], key);
      if (cur != null) return interpolate(cur, params);
      // 2) fallback 言語にフォールバック
      if (lang !== fallbackLang) {
        const fb = pick(translations[fallbackLang], key);
        if (fb != null) return interpolate(fb, params);
      }
      // 3) キー自体を返す (開発時の見える化)
      return key;
    };
  }, [lang, translations, fallbackLang]);

  if (!loaded) return null;

  return (
    <I18nCtx.Provider value={{ lang, setLang, t, langs: selectable }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nCtx);
  if (!ctx) {
    return { lang: 'ja', setLang: () => {}, t: (k) => k, langs: ['ja'] };
  }
  return ctx;
}
