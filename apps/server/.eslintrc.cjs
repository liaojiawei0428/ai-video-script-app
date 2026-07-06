// apps/server ESLint 配置 (Node.js + TypeScript + Express)
// 风格: 推荐集 + 真 BUG 防护 rules, 配合 prettier
// 软着陆策略: 不开 no-unsafe-* 和 recommended-requiring-type-checking
// (项目现 any 满天飞, 全开会刷 1000+ 错, 违反 AGENTS.md 不破坏现有功能)
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier', // 关掉跟 prettier 冲突的规则, 必须在最后
  ],
  rules: {
    // === 真 BUG 防护 (error 级, 必须修才能 commit) ===
    'eqeqeq': ['error', 'always'], // 必须 === / !==
    'no-var': 'error', // 绝不该出现 var
    'no-empty': ['error', { allowEmptyCatch: true }], // 允许空 catch, 空 if/else 必修

    // === 软警告 (现状违反多, 不阻塞 commit, 留待后续 PR 修) ===
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-floating-promises': 'warn', // video polling 等 fire-and-forget 是有意设计
    '@typescript-eslint/no-misused-promises': 'warn', // async middleware 是合法模式, false positive 多
    '@typescript-eslint/await-thenable': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'prefer-const': 'warn',
    'object-shorthand': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/no-namespace': 'warn',
    'no-useless-escape': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', 'scripts/', '*.js', '!jest.config.js'],
  overrides: [
    {
      // 测试文件宽松
      files: ['**/__tests__/**/*.ts', '**/*.test.ts', 'scripts/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
};
