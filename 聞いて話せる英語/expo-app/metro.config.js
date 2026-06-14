// monorepo (npm workspaces) を Metro が解決できるよう設定。
// シリーズ root と packages/shared を watch / module 解決対象に追加。

const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// hierarchical lookup は有効のまま (false=default)。
// react-native の内部依存 (@react-native/virtualized-lists 等) は
// node_modules/react-native/node_modules/ にネストされるため、
// Metro が親方向に辿れる hierarchical lookup が必要。

module.exports = config;
