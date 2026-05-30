// 文法辞書 (文脈依存版) を PracticeScreen 風の HTML アプリで動作確認する。
//
// 出力: expo-app/data/grammar-vocab-app.html  (1 ファイルで完結、ブラウザで開くだけ)
//
// 内容:
//   - 例題ナビゲーション (前/次, ジャンプ)
//   - 文タップで日本語/ネパール語切り替え
//   - 単語リストに文脈依存の訳を表示
//   - 単語タップで「他の文脈での訳」も見られる
//   - ローマ字 ON/OFF, フォントサイズ切替

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const VOCAB_PATH = path.join(ROOT, 'expo-app/data/grammar-vocab-context.json');
const OUT_HTML = path.join(ROOT, 'expo-app/data/grammar-vocab-app.html');

function getCellText(cell) {
  if (cell == null || cell.value == null) return '';
  const v = cell.value;
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (v.richText) return v.richText.map(r => r.text).join('').trim();
  if (v.text) return String(v.text).trim();
  return String(v).trim();
}

async function main() {
  // 文法.xlsx の シート1 を取得
  const candidates = [
    path.join(ROOT, '..', '文法.xlsx'),
    path.join(ROOT, '..', '..', 'ネパール語瞬間作文', '文法.xlsx'),
  ];
  let xlsxPath = candidates.find(p => fs.existsSync(p));
  if (!xlsxPath) throw new Error('文法.xlsx が見つかりません');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const sheet1 = wb.worksheets[0];
  const examples = [];
  for (let r = 2; r <= sheet1.actualRowCount; r++) {
    const jp = getCellText(sheet1.getRow(r).getCell(1));
    const ne = getCellText(sheet1.getRow(r).getCell(2));
    if (jp && ne) examples.push({ jp, ne });
  }

  // 辞書をロード
  if (!fs.existsSync(VOCAB_PATH)) throw new Error(`辞書が見つかりません: ${VOCAB_PATH}`);
  const vocab = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf8'));

  const sheetName = sheet1.name.replace(/^\d+_/, '');
  const sheetIdx = 1;

  const html = render(sheetIdx, sheetName, examples, vocab);
  fs.writeFileSync(OUT_HTML, html);

  console.log(`生成完了: ${OUT_HTML}`);
  console.log(`シート: ${sheet1.name}`);
  console.log(`例題数: ${examples.length}`);
  console.log(`単語数: ${Object.keys(vocab).length}`);
  console.log('');
  console.log('ブラウザで以下を開いてください:');
  console.log(`  file:///${OUT_HTML.replace(/\\/g, '/')}`);
}

function render(sheetIdx, sheetName, examples, vocab) {
  const dataJson = JSON.stringify({ sheetIdx, sheetName, examples, vocab });

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>文法練習 (文脈辞書版) - 聞いて話せるネパール語</title>
<style>
  :root {
    --bg: #ffffff;
    --bg-soft: #fafafa;
    --surface: #ffffff;
    --ink: #000000;
    --ink-soft: #18181b;
    --ink-mute: #52525b;
    --ink-quiet: #71717a;
    --ink-faint: #a1a1aa;
    --line: #e4e4e7;
    --accent-ne: #dc143c;
    --accent-ja: #2563eb;
    --tap: #f4f4f5;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: -apple-system, "Hiragino Sans", "Helvetica Neue", "Noto Sans", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .app {
    max-width: 480px;
    margin: 0 auto;
    min-height: 100vh;
    padding: 0;
    border-left: 1px solid var(--line);
    border-right: 1px solid var(--line);
  }
  /* ── ヘッダー ── */
  .header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .header h1 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
  }
  .header-controls { display: flex; gap: 8px; align-items: center; }
  .header-controls button {
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px;
    color: var(--ink-mute);
    cursor: pointer;
  }
  .header-controls button.on { background: var(--ink); color: white; border-color: var(--ink); }

  /* ── メタ情報 ── */
  .meta {
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: var(--ink-mute);
  }
  .meta strong { color: var(--ink); font-weight: 700; }

  /* ── センテンスカード ── */
  .container { padding: 16px; }
  .sentence-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 32px 16px;
    min-height: 180px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
  }
  .sentence-card:hover { background: var(--bg-soft); }
  .sentence-card .hint {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: var(--ink-faint);
    letter-spacing: 1.5px;
    margin-bottom: 16px;
  }
  .sentence-card .ne-text {
    font-size: 30px;
    line-height: 44px;
    font-weight: 600;
    text-align: center;
    color: var(--ink);
  }
  .sentence-card .ja-text {
    font-size: 26px;
    line-height: 40px;
    font-weight: 400;
    text-align: center;
    color: var(--ink);
  }
  .sentence-card .romaji {
    font-family: 'Courier New', monospace;
    font-size: 14px;
    color: var(--ink-quiet);
    font-style: italic;
    text-align: center;
    margin-top: 8px;
    line-height: 22px;
  }

  /* ── ナビゲーション ── */
  .nav-row { display: flex; gap: 8px; margin-bottom: 16px; }
  .nav-btn {
    flex: 1;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 12px;
    font-size: 14px;
    font-weight: 500;
    color: var(--ink);
    cursor: pointer;
  }
  .nav-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .nav-btn:hover:not(:disabled) { background: var(--bg-soft); }

  /* ── 単語リスト ── */
  .words-section { margin-top: 32px; }
  .words-header {
    display: flex;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: var(--ink-faint);
    letter-spacing: 1px;
  }
  .words-header .col-num { width: 32px; }
  .words-header .col-word { flex: 1; }
  .words-header .col-meaning { flex: 1; }
  .word-row {
    display: flex;
    align-items: flex-start;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
    transition: background 0.1s;
  }
  .word-row:hover { background: var(--tap); }
  .word-row.expanded { background: #fef9e7; }
  .word-row.unknown { opacity: 0.45; }
  .col-num {
    width: 32px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: var(--ink-quiet);
    padding-top: 2px;
  }
  .col-word { flex: 1; padding-right: 8px; }
  .col-word .word-ne {
    font-size: 16px;
    font-weight: 500;
    color: var(--ink);
    margin-bottom: 2px;
  }
  .col-word .word-rom {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: var(--ink-faint);
    font-style: italic;
  }
  .col-meaning { flex: 1; }
  .col-meaning .meaning-ja {
    font-size: 16px;
    color: var(--ink);
    margin-bottom: 4px;
  }
  .col-meaning .meaning-pos {
    font-size: 10px;
    color: var(--ink-quiet);
    margin-bottom: 2px;
  }
  .col-meaning .meaning-note {
    font-size: 10px;
    color: var(--ink-faint);
    font-style: italic;
  }
  /* 展開エリア (クリックで他の文脈の意味を表示) */
  .word-expanded {
    grid-column: 1 / -1;
    background: #fffbeb;
    border-radius: 8px;
    padding: 12px;
    margin-top: 8px;
    width: 100%;
  }
  .word-expanded h4 {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--ink-quiet);
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .other-context {
    padding: 6px 0;
    border-bottom: 1px dashed #fef3c7;
    font-size: 12px;
  }
  .other-context:last-child { border: 0; }
  .other-context .ja { color: var(--ink); font-weight: 500; }
  .other-context .sid {
    font-family: 'Courier New', monospace;
    color: var(--ink-faint);
    font-size: 10px;
    margin-left: 8px;
  }
  .other-context .src-jp { color: var(--ink-quiet); font-size: 11px; margin-top: 2px; }
  .other-context.current {
    background: #fef3c7;
    border-radius: 4px;
    padding: 6px 8px;
  }

  /* フォントサイズ大 */
  .app[data-font="large"] .sentence-card .ne-text { font-size: 37px; line-height: 54px; }
  .app[data-font="large"] .sentence-card .ja-text { font-size: 32px; line-height: 48px; }
  .app[data-font="large"] .col-word .word-ne { font-size: 20px; }
  .app[data-font="large"] .col-meaning .meaning-ja { font-size: 20px; }
  .app[data-font="small"] .sentence-card .ne-text { font-size: 25px; line-height: 38px; }
  .app[data-font="small"] .sentence-card .ja-text { font-size: 22px; line-height: 34px; }
  .app[data-font="small"] .col-word .word-ne { font-size: 14px; }
  .app[data-font="small"] .col-meaning .meaning-ja { font-size: 14px; }

  .footer {
    padding: 24px 16px;
    text-align: center;
    color: var(--ink-faint);
    font-size: 11px;
    font-family: 'Courier New', monospace;
  }
</style>
</head>
<body>
<div class="app" id="app" data-font="medium">
  <header class="header">
    <h1>📚 文法練習 (文脈辞書版)</h1>
    <div class="header-controls">
      <button id="btn-romaji" class="on">ローマ字 ON</button>
      <button id="btn-font">A</button>
    </div>
  </header>

  <div class="meta" id="meta"></div>

  <div class="container">
    <div class="sentence-card" id="sentence">
      <div class="hint" id="hint">問題 · タップで切り替え</div>
      <div id="textPrimary"></div>
      <div class="romaji" id="romaji"></div>
    </div>

    <div class="nav-row">
      <button class="nav-btn" id="btn-prev">← 前へ</button>
      <button class="nav-btn" id="btn-next">次へ →</button>
    </div>

    <div class="words-section">
      <div class="words-header">
        <div class="col-num">#</div>
        <div class="col-word">単語</div>
        <div class="col-meaning">この文での意味</div>
      </div>
      <div id="words"></div>
    </div>

    <div class="footer">
      💡 単語をタップすると、他の文脈での訳が見られます。<br>
      文をタップすると、ネパール語 ⇄ 日本語が切り替わります。
    </div>
  </div>
</div>

<script>
const DATA = ${dataJson};
const state = {
  idx: 0,
  revealed: false,   // false=ネパール語側 (問題), true=日本語側 (答え)
  romaji: true,
  font: 'medium',     // small / medium / large
  expandedWord: null,
};

// 句読点で分割するシンプルなトークナイザー
function tokenize(text) {
  return text
    .replace(/[।॥?!,;:\"'（）()「」『』]/g, ' ')
    .split(/\\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0);
}

function getCurrentSentenceId() {
  return DATA.sheetIdx + '-' + (state.idx + 1);
}

// 単語の現在の文脈での訳を取得 (文脈ごとに分離されたエントリから)
function lookupVocab(word, sentenceId) {
  const entry = DATA.vocab[word];
  if (!entry) return null;
  const contexts = entry.contexts || [];
  const matched = contexts.find(c => c.sentence_id === sentenceId);
  return { entry, matched: matched || contexts[0] || null };
}

function render() {
  const app = document.getElementById('app');
  app.dataset.font = state.font;

  const ex = DATA.examples[state.idx];
  const sid = getCurrentSentenceId();

  // メタ
  document.getElementById('meta').innerHTML =
    \`<strong>\${DATA.sheetIdx}.</strong> \${DATA.sheetName} · 文法 · 例題 <strong>\${state.idx + 1}</strong> / \${DATA.examples.length}\`;

  // センテンス
  const hint = document.getElementById('hint');
  const textPrimary = document.getElementById('textPrimary');
  const romajiEl = document.getElementById('romaji');

  if (!state.revealed) {
    hint.textContent = '問題 · タップで切り替え';
    textPrimary.className = 'ne-text';
    textPrimary.textContent = ex.ne;
    if (state.romaji) {
      // 簡易ローマ字 (今回は省略、辞書から組み立てるのは別途)
      romajiEl.textContent = tokenize(ex.ne).map(w => DATA.vocab[w]?.rom || '').filter(Boolean).join(' ');
      romajiEl.style.display = 'block';
    } else {
      romajiEl.style.display = 'none';
    }
  } else {
    hint.textContent = '答え · タップで切り替え';
    textPrimary.className = 'ja-text';
    textPrimary.textContent = ex.jp;
    romajiEl.style.display = 'none';
  }

  // ナビ
  document.getElementById('btn-prev').disabled = state.idx === 0;
  document.getElementById('btn-next').disabled = state.idx === DATA.examples.length - 1;

  // 単語リスト
  const words = tokenize(ex.ne);
  const wordsEl = document.getElementById('words');
  wordsEl.innerHTML = '';

  words.forEach((word, i) => {
    const r = lookupVocab(word, sid);
    const row = document.createElement('div');
    row.className = 'word-row';
    if (!r) row.className += ' unknown';
    if (state.expandedWord === word) row.className += ' expanded';

    const num = String(i + 1).padStart(2, '0');
    const rom = r?.entry?.rom || '';
    const ja = r?.matched?.ja || '(辞書未登録)';
    const pos = r?.matched?.pos || '';
    const note = r?.matched?.note || '';

    let mainHtml = \`
      <div class="col-num">\${num}</div>
      <div class="col-word">
        <div class="word-ne">\${word}</div>
        \${state.romaji && rom ? '<div class="word-rom">' + rom + '</div>' : ''}
      </div>
      <div class="col-meaning">
        <div class="meaning-ja">\${ja}</div>
        \${pos ? '<div class="meaning-pos">' + pos + '</div>' : ''}
        \${note ? '<div class="meaning-note">' + note + '</div>' : ''}
      </div>
    \`;

    row.innerHTML = mainHtml;
    row.onclick = () => {
      state.expandedWord = state.expandedWord === word ? null : word;
      render();
    };
    wordsEl.appendChild(row);

    // 展開エリア
    if (state.expandedWord === word && r?.entry?.contexts?.length > 1) {
      const expanded = document.createElement('div');
      expanded.className = 'word-expanded';
      expanded.innerHTML = \`
        <h4>\${word} (\${rom}) の他の文脈での訳</h4>
        \${r.entry.base_meaning ? '<div style="font-size:11px;color:#888;margin-bottom:8px;">基本意味: ' + r.entry.base_meaning + (r.entry.base_form ? ' / 基本形: ' + r.entry.base_form : '') + '</div>' : ''}
      \`;
      r.entry.contexts.forEach(ctx => {
        const exObj = (() => {
          // ctx.sentence_id から例文を引く (ne 部分のみあれば良い)
          const [sheetId, exNo] = ctx.sentence_id.split('-').map(Number);
          if (sheetId === DATA.sheetIdx && DATA.examples[exNo - 1]) {
            return DATA.examples[exNo - 1];
          }
          return null;
        })();
        const c = document.createElement('div');
        c.className = 'other-context' + (ctx.sentence_id === sid ? ' current' : '');
        c.innerHTML = \`
          <span class="ja">\${ctx.ja}</span>
          <span class="sid">[\${ctx.sentence_id}]</span>
          \${ctx.pos ? '<span class="sid">' + ctx.pos + '</span>' : ''}
          \${ctx.note ? '<div style="font-size:10px;color:#999;margin-top:2px;">' + ctx.note + '</div>' : ''}
          \${exObj ? '<div class="src-jp">→ ' + exObj.ne + ' (' + exObj.jp + ')</div>' : ''}
        \`;
        expanded.appendChild(c);
      });
      wordsEl.appendChild(expanded);
    }
  });
}

// イベント
document.getElementById('sentence').onclick = () => { state.revealed = !state.revealed; render(); };
document.getElementById('btn-prev').onclick = () => { if (state.idx > 0) { state.idx--; state.revealed = false; state.expandedWord = null; render(); } };
document.getElementById('btn-next').onclick = () => { if (state.idx < DATA.examples.length - 1) { state.idx++; state.revealed = false; state.expandedWord = null; render(); } };
document.getElementById('btn-romaji').onclick = () => {
  state.romaji = !state.romaji;
  const btn = document.getElementById('btn-romaji');
  btn.textContent = 'ローマ字 ' + (state.romaji ? 'ON' : 'OFF');
  btn.className = state.romaji ? 'on' : '';
  render();
};
document.getElementById('btn-font').onclick = () => {
  const fonts = ['small', 'medium', 'large'];
  state.font = fonts[(fonts.indexOf(state.font) + 1) % fonts.length];
  document.getElementById('btn-font').textContent = ({ small: 'A-', medium: 'A', large: 'A+' })[state.font];
  render();
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' && state.idx > 0) { state.idx--; state.revealed = false; state.expandedWord = null; render(); }
  if (e.key === 'ArrowRight' && state.idx < DATA.examples.length - 1) { state.idx++; state.revealed = false; state.expandedWord = null; render(); }
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); state.revealed = !state.revealed; render(); }
});

render();
</script>
</body>
</html>`;
}

main().catch(e => { console.error('エラー:', e.message); process.exit(1); });
