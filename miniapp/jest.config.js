/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  // setupFiles 在 jest framework 之前跑, 当前 setup 是空置的 export {}
  setupFiles: ['<rootDir>/jest.setup.ts'],

  // src 下的 *.test.ts(x) 才算单测; e2e/ 用独立 config
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],

  moduleNameMapper: {
    // 别名 @ → src (和 Taro 配置对齐)
    '^@/(.*)$': '<rootDir>/src/$1',
    // @mocks/* → __mocks__/* (给测试文件引 mock 辅助函数用)
    '^@mocks/(.*)$': '<rootDir>/__mocks__/$1',
    // Taro API mock (Storage / request / navigateTo 等)
    '^@tarojs/taro$': '<rootDir>/__mocks__/@tarojs/taro.ts',
    // Taro 组件 mock (View/Text/Button → 普通 HTML 元素)
    '^@tarojs/components$': '<rootDir>/__mocks__/@tarojs/components.tsx',
    // SCSS/CSS import 吞掉
    '\\.(scss|css|less)$': '<rootDir>/__mocks__/styleMock.js',
  },

  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },

  // 默认 ts-jest 会把所有 .ts 走 TS 编译
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // 超时 (单测应秒级)
  testTimeout: 10_000,

  // 覆盖率
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.config.ts',
    '!src/app.tsx',
    '!src/pages/**/index.tsx',
  ],
  coverageDirectory: '<rootDir>/coverage',

  clearMocks: true,
  restoreMocks: true,
}
