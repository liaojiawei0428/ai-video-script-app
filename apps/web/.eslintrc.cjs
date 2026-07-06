// apps/web ESLint 配置 (Vite + React 18 + TypeScript)
// 风格: 推荐集 + React Hooks + 真 BUG 防护, 配合 prettier
// 软着陆策略: 同 server, 不开 no-unsafe-*
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'prettier', // 关掉跟 prettier 冲突的规则, 必须在最后
  ],
  settings: {
    react: { version: '18.3' },
  },
  rules: {
    // === 真 BUG 防护 (error 级, 必须修才能 commit) ===
    'eqeqeq': ['error', 'always'],
    'no-var': 'error',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'react-hooks/rules-of-hooks': 'error', // 真 BUG (hooks 规则违反会导致 React 崩)

    // === 软警告 (现状违反多, 不阻塞 commit) ===
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/no-misused-promises': 'warn', // onClick={async () => ...} 是合法模式
    '@typescript-eslint/await-thenable': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'react/no-unescaped-entities': 'warn', // JSX 文字里 " 没 escape, 纯样式
    'react/prop-types': 'off', // TS 项目不需要
    'react/react-in-jsx-scope': 'off',
    'no-console': 'warn',
    'prefer-const': 'warn',
    'no-useless-escape': 'warn',
    'no-case-declarations': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.config.js', '*.config.ts'],
};
