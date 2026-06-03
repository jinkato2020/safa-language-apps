// App B の i18n (ja/ne/bn) のテーマ13/25/29/30 の名称を新テーマに更新。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N = path.join(ROOT, 'expo-app', 'src', 'i18n');

const NAMES = {
  ja: { 13: '学校・育児', 25: '役所と手続き', 29: '病院と体調', 30: 'アルバイトと仕事探し' },
  ne: { 13: 'विद्यालय र बालपालन', 25: 'नगरपालिका र प्रक्रिया', 29: 'अस्पताल र स्वास्थ्य', 30: 'पार्ट-टाइम र जागिर खोजी' },
  bn: { 13: 'স্কুল ও শিশু পরিচর্যা', 25: 'অফিস ও সরকারি পদ্ধতি', 29: 'হাসপাতাল ও স্বাস্থ্য', 30: 'পার্ট-টাইম ও চাকরি খোঁজা' },
};

for (const lang of Object.keys(NAMES)) {
  const file = path.join(I18N, `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  json.themes = json.themes || {};
  for (const [id, name] of Object.entries(NAMES[lang])) json.themes[id] = name;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  console.log(`${lang}.json: ${Object.entries(NAMES[lang]).map(([i, n]) => `${i}=${n}`).join(' / ')}`);
}
