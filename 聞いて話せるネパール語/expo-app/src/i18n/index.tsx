// シンプルな i18n 実装。react-i18next 等の重いライブラリは使わず、
// JSON 翻訳ファイル + React Context で軽量に構築。
//
// 使い方:
//   const { t, lang, setLang } = useI18n();
//   <Text>{t('settings.title')}</Text>
//
// キーが見つからない場合は、ja の同じキーにフォールバック、
// それでも無ければキー文字列をそのまま返す。

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import ja from './ja.json';
import ne from './ne.json';

export type Lang = 'ja' | 'ne';

type Translations = typeof ja;

const RESOURCES: Record<Lang, Translations> = {
  ja: ja as Translations,
  ne: ne as Translations,
};

type I18nValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nCtx = createContext<I18nValue | null>(null);
const STORAGE_KEY = '@nepali_app/lang_v1';

// デバイスのシステム言語から初期言語を推定
function detectSystemLang(): Lang {
  try {
    const locales = Localization.getLocales();
    for (const l of locales) {
      const code = (l.languageCode || '').toLowerCase();
      if (code === 'ne') return 'ne';
      if (code === 'ja') return 'ja';
    }
  } catch {}
  return 'ja'; // フォールバック
}

// 入れ子オブジェクトからドット区切りキーで値を取り出す
// 例: get(obj, 'settings.title') => obj.settings.title
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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectSystemLang);
  const [loaded, setLoaded] = useState(false);

  // 初回ロード: AsyncStorage に保存された設定を優先
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw === 'ja' || raw === 'ne') {
          setLangState(raw);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  // 変更時に保存
  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  };

  const t = useMemo(() => {
    return (key: string, params?: Record<string, string | number>): string => {
      // 1) 現在の言語で探す
      const cur = pick(RESOURCES[lang], key);
      if (cur != null) return interpolate(cur, params);
      // 2) ja にフォールバック (ne の翻訳が未整備な場合に備えて)
      if (lang !== 'ja') {
        const ja_fallback = pick(RESOURCES['ja'], key);
        if (ja_fallback != null) return interpolate(ja_fallback, params);
      }
      // 3) キー自体を返す (開発時の見える化)
      return key;
    };
  }, [lang]);

  if (!loaded) {
    // 初回ロード中は何も描画しない（フラッシュ防止）
    return null;
  }

  return (
    <I18nCtx.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nCtx);
  if (!ctx) {
    // フォールバック: Provider 外で使われた場合 (テスト等)
    return { lang: 'ja', setLang: () => {}, t: (k) => k };
  }
  return ctx;
}
