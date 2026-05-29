// 初級20例文のネパール語をGoogle Cloud TTS（ヒンディー語フォールバック）で
// 音声合成し、./nepali/01.mp3 〜 ./nepali/20.mp3 に保存する。
// 実行: npm run generate-audio

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'nepali');

const SYNTHESIZE_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const VOICES_URL = 'https://texttospeech.googleapis.com/v1/voices';
const SPEAKING_RATE = 0.85;

// 初級20例文（日本語コメント＋ネパール語本文）
const SENTENCES = [
  { jp: '私の名前はケンジです。', ne: 'मेरो नाम केन्जी हो।' },
  { jp: '私は日本人です。', ne: 'म जापानी हुँ।' },
  { jp: '私は東京から来ました。', ne: 'म टोकियोबाट आएको हुँ।' },
  { jp: '私は30歳です。', ne: 'म तीस वर्षको छु।' },
  { jp: '私は会社員です。', ne: 'म कर्मचारी हुँ।' },
  { jp: '私は学生です。', ne: 'म विद्यार्थी हुँ।' },
  { jp: '私は結婚しています。', ne: 'म विवाहित छु।' },
  { jp: '私には子供が2人います。', ne: 'मेरा दुई जना बच्चा छन्।' },
  { jp: '私は医者です。', ne: 'म डाक्टर हुँ।' },
  { jp: '私は先生です。', ne: 'म शिक्षक हुँ।' },
  { jp: '私の趣味は読書です。', ne: 'मेरो शौक पढ्नु हो।' },
  { jp: '私はネパール語を勉強しています。', ne: 'म नेपाली भाषा सिक्दैछु।' },
  { jp: 'はじめまして。', ne: 'भेट भएकोमा खुसी छु।' },
  { jp: 'よろしくお願いします。', ne: 'सहयोगको अपेक्षा गर्छु।' },
  { jp: '私の家族は4人です。', ne: 'मेरो परिवारमा चार जना छन्।' },
  { jp: '私は大阪に住んでいます。', ne: 'म ओसाकामा बस्छु।' },
  { jp: '私はエンジニアです。', ne: 'म इन्जिनियर हुँ।' },
  { jp: '私は独身です。', ne: 'म अविवाहित छु।' },
  { jp: '私の母国語は日本語です。', ne: 'मेरो मातृभाषा जापानी हो।' },
  { jp: 'どうぞよろしく。', ne: 'कृपया मलाई चिनिदिनुहोस्।' },
];

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`.env ファイルが見つかりません: ${ENV_PATH}`);
  }
  const text = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function voicePriority(name) {
  if (name.includes('Studio')) return 100;
  if (name.includes('Chirp3-HD')) return 90;
  if (name.includes('Chirp-HD')) return 80;
  if (name.includes('Wavenet')) return 70;
  if (name.includes('Neural2')) return 60;
  if (name.includes('Standard')) return 10;
  return 0;
}

async function selectVoice(apiKey) {
  for (const lang of ['ne-NP', 'hi-IN']) {
    const res = await fetch(`${VOICES_URL}?languageCode=${lang}&key=${apiKey}`);
    if (!res.ok) {
      console.warn(`  voices(${lang}) HTTP ${res.status}`);
      continue;
    }
    const data = await res.json();
    const voices = data.voices || [];
    if (voices.length === 0) continue;
    voices.sort((a, b) => voicePriority(b.name) - voicePriority(a.name));
    const picked = voices[0];
    return { languageCode: picked.languageCodes?.[0] || lang, name: picked.name };
  }
  throw new Error('利用可能な音声が見つかりません (ne-NP / hi-IN)');
}

async function synthesize(text, voice, apiKey) {
  const res = await fetch(`${SYNTHESIZE_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice,
      audioConfig: { audioEncoding: 'MP3', speakingRate: SPEAKING_RATE },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`synthesize HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return Buffer.from(data.audioContent, 'base64');
}

async function main() {
  const env = loadEnv();
  const apiKey = env.VITE_GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    throw new Error('.env に VITE_GOOGLE_TTS_API_KEY がありません');
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('音声を選択中...');
  const voice = await selectVoice(apiKey);
  console.log(`  選択された音声: ${voice.name} (${voice.languageCode})`);
  console.log(`  出力先: ${OUTPUT_DIR}`);
  console.log('');

  for (let i = 0; i < SENTENCES.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    const outPath = path.join(OUTPUT_DIR, `${num}.mp3`);
    const { jp, ne } = SENTENCES[i];
    process.stdout.write(`[${num}/20] ${jp.slice(0, 18)}... `);

    try {
      const audio = await synthesize(ne, voice, apiKey);
      fs.writeFileSync(outPath, audio);
      console.log(`OK (${(audio.length / 1024).toFixed(1)} kB)`);
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
    }
  }

  console.log('\n完了。');
}

main().catch((e) => {
  console.error('エラー:', e.message);
  process.exit(1);
});
