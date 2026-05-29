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

// App A 側と同じ理由で false (autolinking 互換性)。
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
