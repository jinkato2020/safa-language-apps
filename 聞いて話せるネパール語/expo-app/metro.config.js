// monorepo (npm workspaces) を Metro が解決できるよう設定。
// シリーズ root と packages/shared を watch / module 解決対象に追加。

const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1) Metro がシリーズ root も watch (packages/shared 配下の変更検出)
config.watchFolders = [monorepoRoot];

// 2) hoist された node_modules を解決する順序
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3) シンボリックリンクではなく実体パスを優先 (npm workspaces 用)。
//    Expo monorepo guide の推奨設定。
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
