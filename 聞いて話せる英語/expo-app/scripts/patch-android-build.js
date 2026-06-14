// GitHub Actions 用: expo prebuild 後の android/app/build.gradle に
// release 署名設定を注入する。
// ブレースカウント方式で signingConfigs ブロックの終端を特定するため、
// Expo のバージョン違いによる微妙なフォーマット差にも対応可能。

const fs = require('fs');
const path = 'android/app/build.gradle';

let content = fs.readFileSync(path, 'utf8');

// 1) signingConfigs ブロックの位置を特定
const sigKeyword = content.indexOf('signingConfigs');
if (sigKeyword === -1) {
  console.error('::error::signingConfigs block not found in build.gradle');
  console.error('--- File content ---');
  console.error(content);
  process.exit(1);
}

// signingConfigs の後の最初の `{` を見つける
const openBraceIdx = content.indexOf('{', sigKeyword);
if (openBraceIdx === -1) {
  console.error('::error::Could not find opening brace of signingConfigs');
  process.exit(1);
}

// ブレースカウントで対応する `}` を探す
let depth = 1;
let i = openBraceIdx + 1;
while (i < content.length && depth > 0) {
  if (content[i] === '{') depth++;
  else if (content[i] === '}') depth--;
  i++;
}
if (depth !== 0) {
  console.error('::error::Unmatched braces in signingConfigs');
  process.exit(1);
}
const closeBraceIdx = i - 1; // signingConfigs の終端 `}` の位置

// すでに release ブロックがあるかチェック（冪等性）
const existingBlock = content.slice(openBraceIdx, closeBraceIdx);
if (existingBlock.includes('release')) {
  console.log('release block already exists in signingConfigs, skipping injection');
} else {
  const releaseBlock = `
        release {
            storeFile file('release.keystore')
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    `;
  // 終端 `}` の直前に挿入
  content = content.slice(0, closeBraceIdx) + releaseBlock + content.slice(closeBraceIdx);
  console.log('Injected release signingConfig block');
}

// 2) buildTypes.release.signingConfig の参照を `signingConfigs.release` に変更
const replaced = content.replace(
  /(buildTypes[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.)\w+/,
  '$1release'
);
if (replaced === content) {
  console.warn('::warning::Could not find buildTypes.release.signingConfig to update (may already be correct)');
} else {
  content = replaced;
  console.log('Updated buildTypes.release.signingConfig to use release config');
}

fs.writeFileSync(path, content);
console.log('Successfully patched build.gradle');
