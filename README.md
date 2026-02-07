# PitchPerfect - 新人销售话术助手

面向服务零售新人销售的对话助手。通过输入商户画像与意向产品，快速生成可复制的销售话术，提升处理疑义与签约效率。

## 功能概览

- 商户画像表单：行业、规模、商圈、关注点、意向产品
- 商户提问区：支持快捷疑义按钮与自定义问题
- 话术生成：四段式输出（核心价值/应对疑义/案例类比/推进动作）
- 一键复制话术与历史回填
- 基础反爬与密钥保护：前端不直连大模型

## 技术栈

- React + Vite + TypeScript
- Tailwind CSS
- Node.js 原生 http 服务端代理
- PostgreSQL（账号与记忆持久化）

## 三方对话流程

1. 新人销售输入商户画像并选择意向产品
2. 商户 Agent 抛出交易/流量/案例疑义
3. 销售助手 Agent 生成话术建议并推进签约

## 本地启动

1. 安装依赖

```
npm install
```

2. 配置环境变量（不会被提交）

`.env.local`
```
LONGCAT_API_KEY=你的密钥
ALLOWED_ORIGINS=http://localhost:5173
PORT=8787
RATE_LIMIT_MAX=30
RATE_LIMIT_WINDOW_MS=60000
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=postgres
PGPASSWORD=12345678
PGDATABASE=postgres
```

> 服务端启动时会自动创建表：`users`、`memory_entries`、`script_generations`、`saved_scripts`、`drill_scores`

3. 启动服务

```
npm run dev
```

4. 打开页面

```
http://localhost:5173/
```

## 常用脚本

- `npm run dev`：同时启动前端与服务端代理
- `npm run dev:client`：仅启动前端
- `npm run dev:server`：仅启动服务端代理
- `npm run build`：构建前端

## 生产部署（示例）

### 方案 A：静态资源 + Node 服务端代理

1. 构建前端
```
npm run build
```

2. 启动服务端代理（建议使用进程管理器）
```
node server/index.js
# 或使用 pm2
pm2 start server/index.js --name pitchperfect-proxy
```

3. 使用 Nginx 代理 `/api`，静态目录指向 `dist/`
```
server {
  listen 80;
  server_name your-domain.com;

  location /api/ {
    proxy_pass http://127.0.0.1:8787;
  }

  location / {
    root /path/to/dist;
    try_files $uri /index.html;
  }
}
```

### 方案 B：仅服务端代理 + 前端部署在静态托管

- 静态页面部署到任意 CDN/对象存储
- 反向代理 `/api` 到你的 Node 服务端

## 服务端代理与反爬

- 前端统一请求 `/api/chat`，不暴露 LongCat API 域名与密钥
- 服务端仅从 `LONGCAT_API_KEY` 读取密钥
- Origin 白名单校验（默认仅 `http://localhost:5173`）
- IP 频率限制：默认 30 次/分钟，可通过环境变量调整

### 限流调优

```
RATE_LIMIT_MAX=30
RATE_LIMIT_WINDOW_MS=60000
```

- `RATE_LIMIT_MAX`：窗口内最大请求数
- `RATE_LIMIT_WINDOW_MS`：窗口时长（毫秒）

## API 说明

- 前端请求：`POST /api/chat`
- 服务端代理：`http://localhost:8787/api/chat`
- 响应错误：
  - `403` Origin 不在白名单
  - `429` 超出请求频率
  - `500` 服务端异常或密钥缺失

## 常见问题排查

- `403 Forbidden`：检查 `ALLOWED_ORIGINS` 是否包含当前访问域名
- `500 Missing LONGCAT_API_KEY`：检查 `.env.local` 是否配置密钥并重启 `npm run dev`
- `429 Too Many Requests`：降低请求频率或调整服务端限流
- `Network 中出现 LongCat 域名`：检查 `vite.config.ts` 是否含 `/api` 代理

## 目录结构

- `src/` 前端代码
- `server/` 服务端代理
- `issues/` 任务追踪 CSV（被 gitignore，需要 `git add -f`）
- `plan/` 规划文件

## 安全提示

- 不要提交 `.env.local`
- 不要在前端代码中硬编码密钥
