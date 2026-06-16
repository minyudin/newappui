import path from 'path'
import os from 'os'
import { defineConfig } from '@tarojs/cli'

/**
 * Taro 4.2 配置 · 按官方默认模板最简版
 * ============================================================
 *  - 不自定义 webpack 压缩/chunk, 交回 Taro 默认
 *  - 别名 @ → src
 *  - defineConstants: API base 注入 (构建时自动探测 LAN IP)
 * ============================================================ */

/**
 * 自动探测本机 LAN IP (构建时) · 避免硬编码过期
 *  · 过滤回环 / 链路本地 / VMware / VirtualBox / WSL / Hyper-V / Docker 虚拟网卡
 *  · 过滤 169.254 链路本地、127.x 回环 + WSL/Hyper-V 默认子网 (172.16-31.x)
 *  · 优先返回第一个真实物理网卡的 IPv4 (通常是 192.168.x.x 家庭路由 / 10.x.x.x 企业网)
 *  · 全部失败则退回 127.0.0.1 (devtools 同机可用, 真机连不上)
 */
function detectLanIp(): string {
  const ifaces = os.networkInterfaces()
  const candidates: string[] = []
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue
    // 网卡名过滤: 常见虚拟网卡命名模式
    if (/vmware|virtualbox|wsl|vethernet|hyper-?v|loopback|docker|tailscale|zerotier|tun|tap/i.test(name)) continue
    for (const a of addrs) {
      if (a.family !== 'IPv4') continue
      if (a.internal) continue
      if (a.address.startsWith('169.254.')) continue // 链路本地
      if (a.address.startsWith('127.')) continue      // 回环 (双保险)
      // WSL / Hyper-V 默认给 vEthernet 分配的网段是 172.16.0.0/12
      // 但企业内网也可能用 172.x · 这里宁可宽松, 让用户用 .env 覆盖
      // (家庭/公司 WiFi 主流 192.168.x.x · 企业 10.x.x.x)
      // 不强行排除 172.x · 仅在网卡名命中虚拟模式时排除 (上面的 regex)
      candidates.push(a.address)
    }
  }
  return candidates[0] || '127.0.0.1'
}

export default defineConfig(async (merge, { command, mode }) => {
  // API base:
  //  · dev 联调 · 自动探测本机 LAN IP (同 WiFi 真机调试可用; devtools 也走该 IP)
  //  · 如探测不准 / 跨子网 · 用 env TARO_APP_API_BASE 覆盖
  //  · 生产部署 · 用 env TARO_APP_API_BASE 覆盖成正式域名
  const lanIp = detectLanIp()
  const DEV_LAN_API = `http://${lanIp}:8081/api/v1`
  const apiBase = process.env.TARO_APP_API_BASE || DEV_LAN_API
  console.log(`[taro config] TARO_APP_API_BASE = ${apiBase}`)

  // 摄像头 H5 播放页基地址 (必须 HTTPS + 备案 + 已加业务域名白名单)
  //  · 没配时, pages/camera 页会降级成占位提示, 不加载 webview
  //  · 配好后, webview 会 src=${CAMERA_H5_BASE}/play.html?url=xxx.flv
  const cameraH5Base = process.env.TARO_APP_CAMERA_H5_BASE || ''

  const baseConfig = {
    projectName: 'longarch-miniapp',
    date: '2026-04-24',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    // IMPORTANT:
    //  - h5/weapp 产物分目录，避免互相清理导致 Windows 下 emptyDirectory/unlink 报错
    //  - 也避免 “先 build:h5 后 build:weapp” 把 dist 结构搞乱
    outputRoot: process.env.TARO_ENV === 'h5' ? 'dist/h5' : 'dist/weapp',
    plugins: [],
    defineConstants: {
      'process.env.TARO_APP_API_BASE': JSON.stringify(apiBase),
      'process.env.TARO_APP_CAMERA_H5_BASE': JSON.stringify(cameraH5Base),
    },
    copy: {
      patterns: [],
      options: {},
    },
    framework: 'react',
    compiler: 'webpack5',
    cache: { enable: false },
    mini: {
      postcss: {
        pxtransform: { enable: true, config: {} },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
      webpackChain(chain: any) {
        chain.resolve.alias.set('@', path.resolve(__dirname, '..', 'src'))
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      webpackChain(chain: any) {
        chain.resolve.alias.set('@', path.resolve(__dirname, '..', 'src'))
      },
      output: {
        filename: 'js/[name].[hash:8].js',
        chunkFilename: 'js/[name].[chunkhash:8].js',
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css',
      },
      postcss: {
        autoprefixer: { enable: true, config: {} },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
  }

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig)
  }
  return merge({}, baseConfig)
})
