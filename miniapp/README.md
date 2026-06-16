# 陇上管家 · 微信小程序端

> Taro 4.2 · React 18 · TypeScript · Sass
> 面向 **认养用户 (adopter)** 的 C 端入口 · 与 `longarch-admin-next` 后台栈对齐

---

## 一、当前能跑什么

| 页面 | 路径 | 功能 |
|---|---|---|
| 登录 | `pages/login/index` | `wx.login()` 拿 code → POST `/auth/wechat-login` → 存 token/userInfo |
| 我的认养 | `pages/adoptions/index` | 展示 userInfo · 拉 `/users/me` · 下拉刷新 · 退出登录 |

剩余 §6.2~6.8 (认养码/地块/视频/传感器/任务/AI) 计划中。

---

## 二、开发步骤

### 2.1 准备

确保你有:
- Node ≥ 18 (项目验证于 v22.17.0)
- pnpm ≥ 10 (`npm i -g pnpm` 如未装)
- **微信开发者工具** (https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- **后端 `longarch-server` 已在 8081 端口启动**, `wechat.miniapp.stub-mode: true`

### 2.2 安装依赖

```powershell
cd d:\longarch1\miniapp
pnpm install
```

首次约 90s 下载 ~250MB Taro + webpack 依赖。

### 2.3 启动 watch 编译

```powershell
pnpm dev:weapp
```

Taro 会持续监听 `src/` 变更, 产物输出到 `dist/`。

### 2.4 导入微信开发者工具

1. 打开微信开发者工具 → 「导入项目」
2. 项目目录选: **`d:\longarch1\miniapp\dist`** (注意是 dist 不是 miniapp)
3. AppID 选 「测试号」或填你自己的
4. 点 「导入」

### 2.5 关闭域名校验 (dev)

工具右上角 → 详情 → 本地设置:
- ✅ 不校验合法域名、web-view (业务域名)、TLS 版本以及 HTTPS 证书

否则 `http://localhost:8081` 会被拦住。

### 2.6 登录试跑

1. 工具内看到 「登录」页 (陇上管家字样)
2. 点 「微信一键登录」按钮
3. stub-mode 下任何 `wx.login()` 的 code 都会被后端接受
4. 成功后跳 「我的认养」, 看到自动创建的 adopter 用户

---

## 三、关键决策说明

### 3.1 为什么是 Taro-React 而非原生?

- 和 `longarch-admin-next` 的 React/TS 栈对齐, types/api/store 可复用
- 开发成本低于从 0 学 wxml/wxss

取舍: **UI 组件需重写** (shadcn/ui 不能用, 要用 `@tarojs/components` 的 `View/Text/Button`)

### 3.2 认证方案: Storage + `satoken` Header

小程序 `wx.request` 不会自动携带 HttpOnly cookie, 所以:

- 登录成功 → `Taro.setStorageSync('satoken', token)` + zustand store
- 每次请求 → 从 store 取 token → `header: { satoken: <token>, 'X-Client-Type': 'miniapp' }`
- Sa-Token 后端 `is-read-header: true` 已开启, `token-prefix: ""` 所以无 `Bearer ` 前缀

### 3.3 设计语言

与 admin-next 莫兰迪系统一致:
- 色值来自 `src/styles/tokens.scss` (`$paper #e8e8e5`, `$ink #2d2a26`, `$sage #9fb58e` ...)
- 无圆角 (`button { border-radius: 0; &::after { border: none } }`)
- hairline 1px 边框
- 衬线标题 (EB Garamond / Noto Serif SC)

微信小程序里 **`&:hover` 无效**, 所以交互反馈只能靠 `:active` 或 `hover-class`。

---

## 四、后续路线

| 阶段 | 交付 |
|---|---|
| **P1 (现在)** | 登录 + 我的认养骨架 |
| **P2** | 认养码兑换 + 地块详情 + 传感器摘要 |
| **P3** | 任务申请 + 任务队列 + 视频实时流 |
| **P4** | AI 对话入口 + 分享码生成 |
| **P5** | 生产配置 · HTTPS 域名 · 真 appId 备案 |

---

## 五、排障速查

| 症状 | 原因 | 解决 |
|---|---|---|
| 点登录按钮无反应 | 后端未启动 | `cd longarch-server; $env:JAVA_HOME='...'; mvn spring-boot:run` |
| `ERR_CONNECTION_REFUSED` | 8081 未监听 | 同上 |
| 请求被「不合法域名」拦 | urlCheck 开着 | 开发者工具 → 详情 → 本地设置 → 不校验合法域名 |
| 40002 登录失效 | token 过期或后端重启 | 自动清态跳登录, 再点一次登录按钮即可 |
| 编译报 `Cannot find module '@/...'` | alias 未生效 | 重跑 `pnpm dev:weapp`, 首次需先完整 build |
