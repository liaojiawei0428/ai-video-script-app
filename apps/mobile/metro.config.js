// metro.config.js
// v3.0.0 (S58): Monorepo 配置 - 让 metro 解析 packages/* 的 @ai-script/* workspace 包
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = {
  // 监听 packages 目录
  watchFolders: [
    path.resolve(monorepoRoot, 'packages/shared-types'),
    path.resolve(monorepoRoot, 'packages/shared-utils'),
  ],
  // 让 metro 解析 monorepo 根和 packages 的 node_modules
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
