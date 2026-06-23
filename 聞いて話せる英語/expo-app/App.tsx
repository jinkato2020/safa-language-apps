// 聞いて話せる英語 のエントリ。学習対象=英語 / 母語=日本語(単一)。UI言語=日本語。
// 【パック化 2026-06-16】テキストは同梱、音声(en学習対象 + ja母語)はDLパック(packs-appc)。
//   初回起動でサイズ開示+同意(Apple GL4.2.3)→DL→合成。以降はキャッシュから即時。

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  AppShell,
  I18nProvider,
  SettingsProvider,
  AppDataProvider,
  type AppData,
} from '@safa/shared';

import ja from './src/i18n/ja.json';
import { loadPack, getPackDownloadInfo } from './src/packLoader';

const splashSource = require('./assets/safa-splash.mp4');
const headerIconSource = require('./assets/icon.png');

function fmtMB(bytes: number): string { return bytes > 0 ? `${Math.max(1, Math.round(bytes / 1048576))} MB` : '—'; }

// DL前の同意画面 (サイズ開示。Apple GL4.2.3)。
//  App C は母語=日本語単一でUI言語切替が無いため、戻る先が無い→「戻る」は出さない。
//  既存データで動かせる(=音声が既にある更新時)なら「後で(現在のまま使う)」でDLせず起動。
function ConfirmDownloadView({ bytes, onConfirm, canSkip, onSkipUpdate }: { bytes: number; onConfirm: () => void; canSkip?: boolean; onSkipUpdate?: () => void }) {
  const size = fmtMB(bytes);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 17, fontWeight: '700', color: '#18181b', marginBottom: 12, textAlign: 'center' }}>音声データのダウンロード</Text>
      <Text style={{ fontSize: 14, color: '#52525b', marginBottom: 28, textAlign: 'center', lineHeight: 21 }}>
        {`英語と日本語の音声（約${size}）をダウンロードします。`}
      </Text>
      <Pressable onPress={onConfirm} style={{ paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10, backgroundColor: '#2563eb' }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{`ダウンロード（${size}）`}</Text>
      </Pressable>
      {canSkip && onSkipUpdate ? (
        <Pressable onPress={onSkipUpdate} hitSlop={8} style={{ marginTop: 18, paddingVertical: 8, paddingHorizontal: 20 }}>
          <Text style={{ color: '#52525b', fontSize: 15, fontWeight: '600' }}>後で（現在のまま使う）</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// DL進捗 / 失敗時は再試行。
function DownloadView(
  { done, total, label, error, errMsg, onRetry, step, steps }:
  { done: number; total: number; label?: string; error?: boolean; errMsg?: string; onRetry?: () => void; step?: number; steps?: number },
) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const counter = steps && steps > 1 && step ? ` (${step}/${steps})` : '';
  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontSize: 14, color: '#dc2626', marginBottom: 8, textAlign: 'center' }}>ダウンロードに失敗しました</Text>
        {errMsg ? <Text style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 16, textAlign: 'center' }} selectable>{errMsg}</Text> : null}
        <Pressable onPress={onRetry} style={{ paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8, backgroundColor: '#2563eb' }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>再試行</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 16, fontSize: 13, color: '#52525b' }}>{`${label === '展開中' ? '準備中' : 'ダウンロード中'}… ${pct}%${counter}`}</Text>
      <View style={{ marginTop: 12, width: 220, height: 6, borderRadius: 3, backgroundColor: '#e4e4e7', overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#2563eb' }} />
      </View>
    </View>
  );
}

// セッション中に一度ロードした AppData を保持(再構築不要)。
let sessionData: AppData | null = null;

function PackGate({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(sessionData);
  const [progress, setProgress] = useState<{ done: number; total: number; label?: string; step?: number; steps?: number }>({ done: 0, total: 0 });
  const [error, setError] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [confirm, setConfirm] = useState<{ bytes: number; canSkip: boolean } | null>(null);
  const confirmedRef = useRef(false);
  const skipUpdateRef = useRef(false); // 「後で」で更新を見送ったか(単一言語なのでboolで足りる)

  useEffect(() => {
    if (sessionData) { setData(sessionData); return; }
    let alive = true;
    setError(false); setErrMsg(''); setConfirm(null);
    (async () => {
      let info: { needsDownload: boolean; bytes: number; canSkip: boolean };
      try { info = await getPackDownloadInfo(); } catch { info = { needsDownload: true, bytes: 0, canSkip: false }; }
      if (!alive) return;
      if (info.needsDownload && !confirmedRef.current) { setConfirm({ bytes: info.bytes, canSkip: info.canSkip }); return; }
      setProgress({ done: 0, total: 0 });
      loadPack((done, total, label, step, steps) => { if (alive) setProgress({ done, total, label, step, steps }); }, skipUpdateRef.current)
        .then(d => { if (alive) { sessionData = d; setData(d); } })
        .catch((e: any) => { if (alive) { setErrMsg(String(e?.message ?? e)); setError(true); } });
    })();
    return () => { alive = false; };
  }, [attempt]);

  const onConfirm = () => { confirmedRef.current = true; setConfirm(null); setAttempt(a => a + 1); };
  // 更新を「後で」 → DLせず既存音声のまま起動(skipUpdate=trueで再実行)。戻る先が無いので「戻る」は無し。
  const onSkipUpdate = () => { confirmedRef.current = true; skipUpdateRef.current = true; setConfirm(null); setAttempt(a => a + 1); };

  if (!data) {
    if (confirm) return <ConfirmDownloadView bytes={confirm.bytes} onConfirm={onConfirm} canSkip={confirm.canSkip} onSkipUpdate={onSkipUpdate} />;
    return <DownloadView done={progress.done} total={progress.total} label={progress.label} step={progress.step} steps={progress.steps} error={error} errMsg={errMsg} onRetry={() => setAttempt(a => a + 1)} />;
  }
  return <AppDataProvider data={data}>{children}</AppDataProvider>;
}

export default function App() {
  return (
    <I18nProvider
      translations={{ ja }}
      fallbackLang="ja"
      selectableLangs={['ja']}
      storageKey="@english_app/lang_v1"
    >
      <SettingsProvider
        defaults={{ practiceDirection: 'ne2ja', listenDirection: 'ne2ja' }}
        storageKey="@english_app/settings_v1"
      >
        <PackGate>
          <AppShell splashSource={splashSource} headerIconSource={headerIconSource} posterLessons={[]} progressStorageKey="@english_app/progress_v1" />
        </PackGate>
      </SettingsProvider>
    </I18nProvider>
  );
}
