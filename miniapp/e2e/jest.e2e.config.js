/**
 * Jest config · E2E (miniprogram-automator)
 * ============================================================
 *  与单测 config 隔离:
 *    · 跑 node 环境 (不用 jsdom)
 *    · 不 mock @tarojs/taro (直接操纵真工具)
 *    · 单测过滤规则排除 e2e/
 *    · 这边只跑 e2e/**.e2e.test.ts
 *
 *  前置要求:
 *    1. 微信开发者工具已启动
 *    2. 工具顶部 · 设置 → 安全 → 勾「服务端口」(默认 9420)
 *    3. 已经 `pnpm build:weapp` 生成 dist/
 *    4. env MINIAPP_CLI_PATH 指向 cli.bat
 * ============================================================ */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.e2e.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  testTimeout: 120_000, // e2e 启动工具 + 编译 + 注入 需要时间
  maxWorkers: 1, // 一次一个, 避免抢工具资源
}
