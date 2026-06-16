# Longarch Folio · Admin

> 智慧农业管理后台 · 莫兰迪纸本美学 · React 19 + TypeScript + Tailwind v4
>
> 与旧版 `longarch-admin`（Vue 3 + Element Plus）并存。功能等价，视觉与技术栈完全重写。

## 技术栈

- **React 19** + **TypeScript 6** + **Vite 8**
- **Tailwind CSS v4**（`@theme` 莫兰迪色板）+ **SCSS**（同源 tokens）
- **shadcn/ui**（按需加入，改皮莫兰迪）
- **React Router v7**
- **Zustand** + **Immer**
- **ECharts 6** + **echarts-for-react**
- **axios**（与旧版 `/api/v1` 契约保持一致）

## 视觉基因

| 类别 | 值 |
|------|------|
| 底色 | `#E8E8E5`（暖灰纸） |
| 文字 | `#2D2A26`（墨灰） |
| Accent | 莫兰迪绿 `#9FB58E` / 雾蓝 `#A0BCD0` / 沙黄 `#D9C9A8` / 砖红 `#C5826A` |
| 分隔 | hairline `1px solid #C8C4BB` |
| 原则 | **无圆角 · 无阴影 · 无渐变 · 编号至上（§1…§12）** |

## 开发

```bash
pnpm install            # 或 npm i
pnpm dev                # http://localhost:5175
pnpm build
pnpm typecheck
```

后端 API: `http://localhost:8081/api/v1`（由 `vite.config.ts` 代理转发）。

## 目录

```
src/
├── api/          axios 封装 + 30+ 端点（P2）
├── stores/       Zustand auth store（P2）
├── components/
│   ├── shell/    Sidebar · TopBar · AppShell（P3）
│   └── ui/       shadcn/ui 改皮组件（P4，按需）
├── pages/        §1–§12 页面（P5）
├── lib/          utils · cn()
├── styles/       tokens / mixins / typography（SCSS）
├── router/       React Router v7 路由（P3）
└── types/        TypeScript 类型（P2 补充）
```

## 阶段进度

- [x] **P1 · 骨架**：Vite + React 19 + TS + Tailwind v4 + 莫兰迪 tokens
- [ ] **P2 · API 层**：axios 封装 + Auth Store + 类型
- [ ] **P3 · AppShell**：Sidebar + TopBar + PageShell + 路由守卫
- [ ] **P4 · UI 组件**：shadcn/ui 改皮
- [ ] **P5 · 逐页移植**：12 个业务页

## API 契约（与旧版一致）

- `baseURL`: `/api/v1`
- `Authorization: Bearer <token>`
- 统一响应包络：`{ code, message, data }`，`code === 0` 为成功，`40002` 为登录过期
