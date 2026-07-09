# 陇上管家 · Windows 本地一步跑通指南（给 Cursor / 新开发者）

> 目标：在 Windows 上克隆本仓库后，**一次性**把后端（Docker）、测试数据、小程序前端跑起来，并在微信开发者工具里看到完整可用的界面。
> 按顺序执行即可，全程不需要改任何业务代码。

---

## 0. 前置软件（装一次）

| 软件 | 版本 | 说明 |
|---|---|---|
| Docker Desktop | 最新 | 需启用 WSL2 后端 |
| Node.js | 20.x（项目验证过 20.18） | 官网 LTS 安装包 |
| 微信开发者工具 | Stable 最新 | https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html |
| Git | 最新 | — |

---

## 1. 启动后端全家桶（Docker 一条命令）

在仓库根目录（PowerShell）：

```powershell
copy .env.example .env
docker compose up -d --build
```

会拉起 6 个服务（默认 dev profile：微信 stub 登录 + 自动播种管理员账号）：

| 服务 | 端口 | 说明 |
|---|---|---|
| mysql | 3306 | root 密码 `123456`，库名 `longarch`，Flyway 自动建表 |
| redis | 6379 | 密码 `123456` |
| mosquitto | 1883 | MQTT broker（设备指令/心跳） |
| srs | 1935/1985/8880 | 摄像头流媒体 |
| server | **8081** | Spring Boot 后端（小程序/后台的 API） |
| admin | **8080** | React 管理后台（nginx 反代 /api） |

首次构建后端镜像要下 Maven 依赖，可能 5-15 分钟。验证后端就绪：

```powershell
curl http://localhost:8081/actuator/health   # 期望 {"status":"UP"}
```

管理后台：浏览器打开 http://localhost:8080 （dev 模式已自动播种管理员账号，见 `longarch-server/.../AdminUserSeeder.java`）。

---

## 2. 插入测试数据（一条命令）

后端起来后（Flyway 已建好表），执行本文件夹里的 `seed-test-data.sql`：

```powershell
docker compose exec -T mysql mysql -uroot -p123456 longarch < 交接/seed-test-data.sql
```

得到的数据：

- 3 个地块：A区·阳光番茄园(1) / B区·麦浪田(2) / C区·香草园(3)
- 3 个作物批次（番茄/小麦/罗勒）+ 传感器 7 天每小时历史数据
- 摄像头、滴灌/施肥执行设备、农事记录、AI 分析样例
- **可用认养码**（在小程序「兑换认养码」里输入）：
  - `LONG-TOMATO-2026`（番茄园主码）
  - `LONG-WHEAT-2026`（麦浪田主码）

> SQL 全部带 `ON DUPLICATE KEY UPDATE`，重复执行安全。

---

## 3. 编译小程序前端

```powershell
cd miniapp
npm install
npm run dev:weapp     # watch 模式，改代码自动重编译；产物在 miniapp/dist/weapp
```

> **一次性编译**用 `npm run build:weapp -- --mode development`。
>
> ⚠️ **千万不要**直接 `npm run build:weapp`（不带 mode）——那是生产模式，会读 `.env.production`，
> API 地址会被换成占位域名 `https://api.yourdomain.com`，登录时报 **HTTP 307**。
> 本地开发一律用 development 模式（读 `.env.development`，API 指向 `http://127.0.0.1:8081/api/v1`）。

---

## 4. 微信开发者工具

1. 打开开发者工具 → 导入项目 → 目录选 **`miniapp/dist/weapp`**（不是 miniapp 根目录）
2. AppID 用测试号或 `wxf60ed7658ed2c547`（project.config.json 已带）
3. **详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」**（本地 http 接口 + 天气接口需要）
4. Ctrl+B 编译 → 模拟器出现登录页 → 点「微信一键登录」（后端 stub 模式，任何 code 都能登录）
5. 登录后在「我的认养」→「兑换认养码」输入 `LONG-TOMATO-2026` 即可绑定地块，看到完整数据

### 真机预览
- 手机和电脑同一局域网
- 改 `miniapp/.env.development` 里 `TARO_APP_API_BASE=http://<电脑局域网IP>:8081/api/v1`，重新编译
- 真机包体已优化到 2MB 内（图片已压缩 + sourcemap 不上传）

### 天气功能的域名
首页天气用了两个免费接口（无需 key）：`api.open-meteo.com`（天气）、`api.bigdatacloud.net`（反向地理编码城市名）。
开发者工具勾选「不校验合法域名」即可；正式上线需在小程序后台把这两个域名加入 request 合法域名。

---

## 5. 项目结构速览

```
├─ miniapp/               Taro 4 + React 18 微信小程序（C端，18 个页面）
│  ├─ src/pages/          页面（登录/首页/认养/地块/任务/AI/我的/品牌故事…）
│  ├─ src/components/BrandNavBar/  自定义品牌导航栏（全局 navigationStyle: custom）
│  ├─ src/styles/         设计 tokens（$farm-green #5d63e0 / 圆角 / 阴影 / bl() 间距）
│  ├─ src/lib/weather.ts  天气（用户定位 → Open-Meteo，30min 缓存，失败回退兰州）
│  ├─ .env.development    本地 API 地址（127.0.0.1:8081）
│  └─ .env.production     生产 API 地址（上线前替换成真实 HTTPS 域名）
├─ longarch-server/       Spring Boot 3.2 / Java 17 后端（Flyway 自动迁移）
├─ longarch-admin-next/   React 19 + Vite 管理后台
├─ docker-compose.yml     一键全栈编排（本指南第 1 步）
└─ 交接/                  本文件夹（本指南 + 测试数据 SQL）
```

更多背景文档（仓库根目录）：`部署上线指南.md`、`硬件对接指南.md`、`项目现状交接.md`。

---

## 6. 常见问题

| 现象 | 原因/解法 |
|---|---|
| 登录报 HTTP 307 | 用了生产模式编译，见第 3 步警告；用 `--mode development` 重编 |
| 模拟器报「app.json is not found」 | dist 正在重编译时开发者工具读了一半；等编译完成后 项目→重新打开此项目 |
| 真机调试报主包超 2MB | 确认 `project.config.json` 的 packOptions 忽略 `*.map` 还在；别往 `src/assets` 加大图 |
| 登录后首页统计全是 0 | 正常——当前账号还没兑换认养码；兑换后即有数据 |
| AI 助手回复是固定文案 | 后端未配 `ZHIPU_API_KEY`（.env），配置后即真实回答 |
| 天气 chip 不显示 | 未授权定位且回退接口也失败；检查「不校验合法域名」是否勾选 |
