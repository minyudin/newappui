# 管理后台 longarch-admin-next (React 19 + Vite)
# 多阶段构建: pnpm 编译静态资源 -> nginx 提供服务并反代后端
# 构建: docker build -t longarch2-admin .
# 运行: docker run --rm -p 8080:80 longarch2-admin

FROM node:22-alpine AS build
WORKDIR /app

# 启用 corepack 并固定 pnpm 9 (pnpm 10+ 会因构建脚本未授权而中断)
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# 先拷贝依赖清单, 利用层缓存
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
