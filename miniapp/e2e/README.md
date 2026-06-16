# E2E · miniprogram-automator

> 真小程序端到端测试 · 操纵真微信开发者工具模拟器

## 一、前置

### 1.1 微信开发者工具 · 开服务端口

1. 工具顶部 → **设置** → **安全**
2. 勾选 **「服务端口」** (默认 9420)
3. 确认工具保持打开状态 (不能关)

### 1.2 找到 cli.bat 路径

默认安装位置:

```
Windows: C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat
macOS:   /Applications/wechatwebdevtools.app/Contents/MacOS/cli
```

如果不在默认位置, 设置环境变量:

```powershell
$env:MINIAPP_CLI_PATH = 'D:\你的路径\cli.bat'
```

### 1.3 构建产物已就位

```powershell
pnpm build:weapp
```

确认 `miniapp/dist/project.config.json` 存在。

### 1.4 后端已启动

e2e 登录测试会真调 `POST /auth/wechat-login`, 后端必须在 8081 端口。

## 二、跑测试

```powershell
# 单跑 e2e 套件
pnpm test:e2e

# 只跑单个文件
pnpm test:e2e --testPathPattern login
```

## 三、常见坑

| 症状 | 原因 | 修 |
|---|---|---|
| `Error: cli tool timeout` | 工具没开或端口没开 | 手动开工具 · 设置 → 安全 → 勾服务端口 |
| `ENOENT: no such file cli.bat` | cli 路径不对 | 设 `$env:MINIAPP_CLI_PATH` |
| `Component not found "comp"` | dist/ 是旧产物 | `pnpm build:weapp` 重新编译 |
| `请求被拦: 域名不合法` | 工具没开「不校验合法域名」 | 工具 → 详情 → 本地设置勾上 |
| 登录按钮点了无反应 | 后端 8081 没起 | 启动 `longarch-server` |

## 四、CI 为什么不跑 e2e?

GitHub Actions 等无头 runner 无法启动微信开发者工具 GUI。
**e2e 只在本地或带 GUI 的自建 runner 里跑**。
CI 只做 tsc + build + 单测 (见 `.github/workflows/miniapp-ci.yml`)。

## 五、添加新用例

1. 文件命名: `e2e/xxx.e2e.test.ts`
2. 引用: `import automator from 'miniprogram-automator'`
3. 套路:

```ts
const mp = await automator.launch({ cliPath, projectPath })
const page = await mp.reLaunch('/pages/xxx/index')
const el = await page.$('.css-selector')
await el!.tap()           // 点击
await el!.input('text')   // 填表
const text = await el!.text()  // 读文字
await mp.close()
```

参考 [官方 API 文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/api.html)。
