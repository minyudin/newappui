/**
 * Taro 全局类型声明
 * ============================================================
 *  defineAppConfig / definePageConfig 是 Taro 编译期注入的全局函数,
 *  在类型系统里需要显式声明才不被 tsc 报未定义。
 * ============================================================ */

declare function defineAppConfig<T = Record<string, unknown>>(config: T): T
declare function definePageConfig<T = Record<string, unknown>>(config: T): T

// Taro 构建期注入的环境变量
declare namespace NodeJS {
  interface ProcessEnv {
    readonly TARO_APP_API_BASE: string
    /**
     * 摄像头 H5 播放页基地址
     *   · 形如 https://yourdomain.com (已备案 + 已加业务域名白名单)
     *   · 小程序 <web-view> 会加载 ${TARO_APP_CAMERA_H5_BASE}/play.html?url=...
     *   · 未配置时 pages/camera 页会降级成占位提示, 不崩
     */
    readonly TARO_APP_CAMERA_H5_BASE: string
    readonly NODE_ENV: 'development' | 'production' | 'test'
  }
}
