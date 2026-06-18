// 聞いて話せるネパール語 のエントリ。
// UI / ナビゲーション / 画面は @safa/shared に集約。
// ja=同梱(現行), en=DLパック。初回に母語(日本語/English)を選択。

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppShell,
  I18nProvider,
  SettingsProvider,
  AppDataProvider,
  useI18n,
  type AppData,
} from '@safa/shared';

import ja from './src/i18n/ja.json';
import ne from './src/i18n/ne.json';
import en from './src/i18n/en.json';
import { bundledPack, loadPack, getPackDownloadInfo } from './src/packLoader';

const splashSource = require('./assets/safa-splash.mp4');
const headerIconSource = require('./assets/icon.png');

// DLパックになり得る言語は en のみ。ja/ne は同梱(ja内容)を使う。
const toPackLang = (lang: string) => (lang === 'en' ? 'en' : 'ja');

// 初回の母語選択。
const LANG_OPTIONS = [
  { code: 'ja', native: '日本語', sub: 'Japanese' },
  { code: 'en', native: 'English', sub: 'English' },
];
const L1_CHOSEN_KEY = '@nepali_app/l1_chosen_v1';

// confirmTitle/confirmBody({size})/download({size}) はDL前の同意ダイアログ用 (Apple GL4.2.3)。
type DlText = { dl: string; prep: string; fail: string; retry: string; confirmTitle: string; confirmBody: string; download: string; back: string; later: string };
const DL_TEXT: Record<string, DlText> = {
  en: { dl: 'Downloading', prep: 'Preparing', fail: 'Download failed', retry: 'Retry', confirmTitle: 'Download language content', confirmBody: 'This language needs audio and translations (about {size}) to be downloaded.', download: 'Download ({size})', back: 'Back', later: 'Later (keep current)' },
  ja: { dl: 'ダウンロード中', prep: '準備中', fail: 'ダウンロードに失敗しました', retry: '再試行', confirmTitle: '言語データのダウンロード', confirmBody: 'この言語の音声と翻訳（約{size}）をダウンロードします。', download: 'ダウンロード（{size}）', back: '戻る', later: '後で（現在のまま使う）' },
  ne: { dl: 'डाउनलोड हुँदैछ', prep: 'तयार पारिँदैछ', fail: 'डाउनलोड असफल भयो', retry: 'पुनः प्रयास गर्नुहोस्', confirmTitle: 'भाषा सामग्री डाउनलोड', confirmBody: 'यो भाषाको लागि अडियो र अनुवाद (लगभग {size}) डाउनलोड गर्न आवश्यक छ।', download: 'डाउनलोड गर्नुहोस् ({size})', back: 'पछाडि', later: 'पछि (अहिलेकै राख्ने)' },
};

function fmtMB(bytes: number): string { return bytes > 0 ? `${Math.max(1, Math.round(bytes / 1048576))} MB` : '—'; }

// DL前の同意画面 (サイズ開示+ユーザーが選択して開始)。Apple GL4.2.3対応。
function ConfirmDownloadView({ bytes, lang, onConfirm, onCancel, canSkip, onSkipUpdate }: { bytes: number; lang: string; onConfirm: () => void; onCancel?: () => void; canSkip?: boolean; onSkipUpdate?: () => void }) {
  const t = DL_TEXT[lang] ?? DL_TEXT.ja;
  const size = fmtMB(bytes);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#18181b', marginBottom: 12, textAlign: 'center' }}>{t.confirmTitle}</Text>
      <Text style={{ fontSize: 14, color: '#52525b', marginBottom: 28, textAlign: 'center', lineHeight: 21 }}>{t.confirmBody.replace('{size}', size)}</Text>
      <Pressable onPress={onConfirm} style={{ paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10, backgroundColor: '#2563eb' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t.download.replace('{size}', size)}</Text>
      </Pressable>
      {/* 既存データで動かせる(=更新のみ)なら「後で(現在のまま使う)」でDLせず起動。
          そうでなく言語変更などで戻れる場合は「戻る」。初回必須DLはどちらも無し。 */}
      {canSkip && onSkipUpdate ? (
        <Pressable onPress={onSkipUpdate} hitSlop={8} style={{ marginTop: 18, paddingVertical: 8, paddingHorizontal: 20 }}>
          <Text style={{ color: '#52525b', fontSize: 15, fontWeight: '600' }}>{t.later}</Text>
        </Pressable>
      ) : onCancel ? (
        <Pressable onPress={onCancel} hitSlop={8} style={{ marginTop: 18, paddingVertical: 8, paddingHorizontal: 20 }}>
          <Text style={{ color: '#52525b', fontSize: 15, fontWeight: '600' }}>‹ {t.back}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// DLローディング画面 (進捗バー付き / 失敗時は再試行)。
function DownloadView(
  { done, total, label, lang, error, errMsg, onRetry, step, steps }:
  { done: number; total: number; label?: string; lang: string; error?: boolean; errMsg?: string; onRetry?: () => void; step?: number; steps?: number },
) {
  const t = DL_TEXT[lang] ?? DL_TEXT.ja;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const counter = steps && steps > 1 && step ? ` (${step}/${steps})` : '';
  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 14, color: '#dc2626', marginBottom: 8, textAlign: 'center' }}>{t.fail}</Text>
        {errMsg ? (
          <Text style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 16, textAlign: 'center' }} selectable>{errMsg}</Text>
        ) : null}
        <Pressable onPress={onRetry} style={{ paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8, backgroundColor: '#2563eb' }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{t.retry}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 16, fontSize: 13, color: '#52525b' }}>
        {`${label === '展開中' ? t.prep : t.dl}… ${pct}%${counter}`}
      </Text>
      <View style={{ marginTop: 12, width: 220, height: 6, borderRadius: 3, backgroundColor: '#e4e4e7', overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#2563eb' }} />
      </View>
    </View>
  );
}

// 現在のUI言語に応じてデータパックを解決して供給する。
// ja/ne は同梱(即時)。en は null→進捗バー→DL完了で差し替え。
// セッション中に一度ロードした言語パックをメモリ保持。再切替を即時化(再DL/再チェック/再composeなし)。
const sessionPackCache: Record<string, AppData> = {};

function PackGate({ children }: { children: ReactNode }) {
  const { lang, setLang } = useI18n();
  const packLang = toPackLang(lang);
  const [data, setData] = useState<AppData | null>(() => bundledPack(packLang));
  const dataLangRef = useRef<string | null>(data ? packLang : null);
  const shownLangRef = useRef<string>(lang); // 現在表示中データのUI言語(DL拒否時の戻り先)
  const [progress, setProgress] = useState<{ done: number; total: number; label?: string; step?: number; steps?: number }>({ done: 0, total: 0 });
  const [error, setError] = useState(false);
  const [errMsg, setErrMsg] = useState<string>('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ bytes: number; canSkip: boolean } | null>(null); // DL同意待ち (Apple GL4.2.3)
  const confirmedLangRef = useRef<string | null>(null); // ユーザーがDL同意した言語
  const skipUpdateLangRef = useRef<string | null>(null); // 「後で」で更新を見送った言語(既存音声で起動)
  useEffect(() => {
    let alive = true;
    const bundled = bundledPack(packLang);
    if (bundled) { setData(bundled); dataLangRef.current = packLang; shownLangRef.current = lang; setLoading(false); setError(false); setConfirm(null); return; }
    if (dataLangRef.current === packLang && !error) return;
    // セッション中に一度ロード済みなら即時表示(ネット通信もloadPackも無し)
    const cached = sessionPackCache[packLang];
    if (cached && !error) { setData(cached); dataLangRef.current = packLang; shownLangRef.current = lang; setLoading(false); setConfirm(null); return; }
    setError(false); setErrMsg(''); setConfirm(null);
    (async () => {
      // まずDL要否とサイズを確認。DLが必要で未同意の言語なら、サイズ開示+同意画面を出してから。
      let info: { needsDownload: boolean; bytes: number; canSkip: boolean };
      try { info = await getPackDownloadInfo(packLang); } catch { info = { needsDownload: true, bytes: 0, canSkip: false }; }
      if (!alive) return;
      if (info.needsDownload && confirmedLangRef.current !== packLang) { setConfirm({ bytes: info.bytes, canSkip: info.canSkip }); return; }
      setProgress({ done: 0, total: 0 }); setLoading(true);
      loadPack(packLang, (done, total, label, step, steps) => { if (alive) setProgress({ done, total, label, step, steps }); }, skipUpdateLangRef.current === packLang)
        .then(d => { if (alive) { sessionPackCache[packLang] = d; setData(d); dataLangRef.current = packLang; shownLangRef.current = lang; setLoading(false); } })
        .catch((e: any) => { if (alive) { setErrMsg(String(e?.message ?? e)); setError(true); setLoading(false); } });
    })();
    return () => { alive = false; };
  }, [packLang, attempt]);

  const onConfirm = () => { confirmedLangRef.current = packLang; setConfirm(null); setAttempt(a => a + 1); };
  const onCancel = () => { setConfirm(null); setLang(shownLangRef.current); };  // DL拒否→直前の言語へ戻す
  // 更新を「後で」 → DLせず既存音声のまま起動(skipUpdate=trueで再実行)。
  const onSkipUpdate = () => { confirmedLangRef.current = packLang; skipUpdateLangRef.current = packLang; setConfirm(null); setAttempt(a => a + 1); };

  if (!data) {
    if (confirm) return <ConfirmDownloadView bytes={confirm.bytes} lang={lang} onConfirm={onConfirm} canSkip={confirm.canSkip} onSkipUpdate={onSkipUpdate} />;
    return <DownloadView done={progress.done} total={progress.total} label={progress.label} step={progress.step} steps={progress.steps} lang={lang} error={error} errMsg={errMsg} onRetry={() => setAttempt(a => a + 1)} />;
  }
  return (
    <AppDataProvider data={data}>
      {children}
      {confirm && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff' }}>
          <ConfirmDownloadView bytes={confirm.bytes} lang={lang} onConfirm={onConfirm} onCancel={onCancel} canSkip={confirm.canSkip} onSkipUpdate={onSkipUpdate} />
        </View>
      )}
      {(loading || error) && !confirm && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff' }}>
          <DownloadView done={progress.done} total={progress.total} label={progress.label} lang={lang} error={error} errMsg={errMsg} onRetry={() => setAttempt(a => a + 1)} />
        </View>
      )}
    </AppDataProvider>
  );
}

// 母語選択画面 (初回のみ)。日本語=同梱 / English=DL。
function LanguageSelect({ onSelect }: { onSelect: (l: string) => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ fontSize: 19, fontWeight: '700', color: '#18181b', marginBottom: 6 }}>言語を選択</Text>
      <Text style={{ fontSize: 13, color: '#71717a', marginBottom: 32, textAlign: 'center' }}>Select your language</Text>
      {LANG_OPTIONS.map(o => (
        <Pressable
          key={o.code}
          onPress={() => onSelect(o.code)}
          style={{ width: 248, paddingVertical: 16, borderRadius: 12, backgroundColor: '#2563eb', marginBottom: 14, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{o.native}</Text>
          <Text style={{ color: '#dbeafe', fontSize: 12, marginTop: 2 }}>{o.sub}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// 初回のみ母語選択画面を出す。選択済みなら素通り。
function FirstRunGate({ children }: { children: ReactNode }) {
  const { setLang } = useI18n();
  const [checked, setChecked] = useState(false);
  const [needSelect, setNeedSelect] = useState(false);
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(L1_CHOSEN_KEY)
      .then(v => { if (alive) { setNeedSelect(!v); setChecked(true); } })
      .catch(() => { if (alive) { setNeedSelect(true); setChecked(true); } });
    return () => { alive = false; };
  }, []);
  if (!checked) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (needSelect) {
    return (
      <LanguageSelect onSelect={(l) => {
        setLang(l);
        AsyncStorage.setItem(L1_CHOSEN_KEY, l).catch(() => {});
        setNeedSelect(false);
      }} />
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <I18nProvider
      translations={{ ja, ne, en }}
      fallbackLang="ja"
      storageKey="@nepali_app/lang_v1"
    >
      <SettingsProvider
        defaults={{ practiceDirection: 'ja2ne', listenDirection: 'ja2ne' }}
        storageKey="@nepali_app/settings_v2"
      >
        <FirstRunGate>
          <PackGate>
            <AppShell splashSource={splashSource} headerIconSource={headerIconSource} />
          </PackGate>
        </FirstRunGate>
      </SettingsProvider>
    </I18nProvider>
  );
}
