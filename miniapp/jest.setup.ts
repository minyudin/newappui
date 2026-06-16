// Jest 全局 setup · 当前空置
// ============================================================
//  当 store/api 单测不需要 jest-dom matcher (只用标准 jest 断言)
//  写页面组件测试时, 把下行解开:
//    import '@testing-library/jest-dom'
//  jest-dom 需 `expect` 已就绪, 但 `setupFiles` 在 framework 之前跑会炸.
//  正确姿势是等 Jest 的 setupFilesAfterEach 支持到了再开, 或移到 test 文件顶层 import.
// ============================================================
export {}
