// Babel · Taro 4 · 官方模板最简版
// N1 · 生产构建时剦除 console.log/info/debug, 保留 warn/error 供线上错误诊断.
//   触发: NODE_ENV=production (pnpm build:weapp / build:h5 默认即是)
//   Dev 开发不受影响, 所有 console 照常输出.
module.exports = {
  presets: [
    ['taro', { framework: 'react', ts: true }],
  ],
  env: {
    production: {
      plugins: [
        // 保留 warn/error: 线上错误还能看到但不泄漏 token / userId / 调试日志
        ['transform-remove-console', { exclude: ['warn', 'error'] }],
      ],
    },
  },
}
