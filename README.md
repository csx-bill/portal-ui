<div align="center">
  <img alt="logo" width="160" src="https://unpkg.com/@vbenjs/static-source@0.1.7/source/logo-v1.webp">
  <h1>Portal 前端（portal-ui）</h1>
</div>

基于 [Vue Vben Admin 5.x](https://doc.vben.pro/) 的门户平台前端，采用 `Vue3`、`Vite`、`TypeScript`、`Tailwind CSS v4`、`Turborepo` + `pnpm` 的 monorepo 架构，并通过模块联邦（Module Federation）拆分宿主应用与共享模块。

配套后端为同级目录 `../portal-service`（Java 21 / Maven 多模块：portal-boot、portal-auth、portal-system、portal-scrm、portal-common），本地开发默认监听 `:8080`。

## 仓库地址

- 前端 portal-ui（本仓库）：<https://github.com/csx-bill/portal-ui>
- 后端 portal-service：<https://github.com/csx-bill/portal-service>

## 项目结构

```
portal-ui
├── apps                     # 业务应用
│   ├── web-scrm             # SCRM 端（联邦宿主 Host）
│   └── system-common        # 系统公共模块（联邦远程 Remote）
├── packages                 # 共享包（@vben/*）
│   ├── @core                # 框架核心：base / composables / ui-kit / preferences
│   ├── effects              # 业务通用：access / request / layouts / common-ui / plugins 等
│   ├── constants / icons / locales / preferences / stores / styles / types / utils
├── internal                 # 工程配置：lint-configs / vite-config / tsconfig / tailwind-config
├── scripts                  # 工具与部署脚本
└── turbo.json               # Turborepo 任务编排
```

## 应用说明

| 应用 | 包名 | 角色 | 开发端口 | 说明 |
| --- | --- | --- | --- | --- |
| web-scrm | `@vben/web-scrm` | 宿主 Host | 5000 | SCRM 端应用 |
| system-common | `@vben/system-common` | 远程 Remote | 3200 | 两个宿主共享的系统公共模块 |

**模块联邦架构：**

- 两个宿主应用通过 `@originjs/vite-plugin-federation` 加载 system-common 的 `remoteEntry.js`，地址由环境变量 `VITE_SYSTEM_COMMON_REMOTE_URL` 控制（开发环境 `http://localhost:3200/remoteEntry.js`，生产环境为同域路径 `/system-common/remoteEntry.js`）。
- 联邦 shared 依赖名单派生自 system-common 的 `package.json`（单一事实来源），宿主与远程自动保持一致。
- system-common 的 dev 模式（`scripts/dev.mjs`）采用「监听源码变更 → 全量构建 → `vite preview` 提供 dist 产物」的方式运行在 `:3200`。修改其源码后会自动重建，刷新宿主页面即可看到最新效果。
- `vue`、`vue-router`、`pinia`、`antdv-next` 在宿主侧排除预打包，保证宿主与远程共用同一模块实例。

## 环境要求

- Node.js `^22.18.0` 或 `^24.12.0`
- pnpm `>= 11`（推荐通过 `corepack` 启用，版本由 `packageManager` 字段锁定）

## 快速开始

1. 安装依赖

```bash
pnpm install
```

2. 启动后端（可选）

接口在开发环境代理到 `http://localhost:8080`，需先在 `../portal-service` 启动后端服务；未启动时页面可正常打开，但接口请求会失败。

3. 启动应用

```bash
pnpm dev                  # 交互式选择要启动的应用
pnpm dev:system-common    # 系统公共模块 Remote（:3200）
pnpm dev:web-scrm         # SCRM 端（:5000）
```

> 调试涉及 system-common 的页面时，建议先启动 `dev:system-common` 再启动宿主。

## 命令说明

| 命令 | 说明 |
| --- | --- |
| `pnpm dev[:app]` | 启动开发服务器 |
| `pnpm build` | 构建全部应用 |
| `pnpm build[:app]` | 构建单个应用 |
| `pnpm check:type` | 类型检查（vue-tsc） |
| `pnpm lint` / `pnpm format` | 代码检查 / 格式化（eslint、oxlint、stylelint） |
| `pnpm check` | 循环依赖、依赖合法性、类型、拼写检查 |
| `pnpm test:unit` | 单元测试（vitest） |
| `pnpm commit` | 交互式生成规范化提交（czg） |
| `pnpm clean` / `pnpm reinstall` | 清理产物 / 重装依赖 |

## 环境变量

各应用的 `.env` / `.env.development` / `.env.production` 位于 `apps/<app>/` 下，常用变量：

| 变量 | 说明 |
| --- | --- |
| `VITE_PORT` | 开发服务器端口 |
| `VITE_GLOB_API_URL` | 接口地址前缀（开发环境为 `/api`） |
| `VITE_SYSTEM_COMMON_REMOTE_URL` | system-common 的 remoteEntry.js 地址 |
| `VITE_APP_CLIENT_ID` / `VITE_APP_CLIENT_SECRET` | 应用接入认证的客户端标识 |
| `VITE_APP_NAMESPACE` | 缓存/store 前缀，用于多应用隔离 |

开发环境代理规则（见各应用 `vite.config.ts`）：

- `/api` → `http://localhost:8080`（转发时去掉 `/api` 前缀，支持 WebSocket）
- `/local` → `http://localhost:8080`（本地上传文件，生产环境由 nginx 直接处理）

## 构建与部署

```bash
pnpm build:web-scrm       # 产物在 apps/web-scrm/dist
pnpm build:system-common  # 产物在 apps/system-common/dist（含 remoteEntry.js）
```

生产环境三个产物部署在同一域名下，system-common 通过 `/system-common/remoteEntry.js` 提供服务，接口由 nginx 转发，参考 `scripts/deploy/nginx.conf`。

## Git 提交规范

参考 [Angular](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular) 提交规范（可用 `pnpm commit` 交互式生成）：

- `feat` 新增功能
- `fix` 修复问题/BUG
- `style` 代码风格调整，不影响运行结果
- `perf` 性能优化
- `refactor` 重构
- `revert` 撤销修改
- `test` 测试相关
- `docs` 文档/注释
- `chore` 依赖更新/脚手架配置修改等
- `ci` 持续集成
- `types` 类型定义文件修改

## 浏览器支持

Tailwind CSS v4 要求 Safari 16.4+、Chrome 111+、Firefox 128+，仅支持现代浏览器，不支持 IE。

## 相关文档

- 框架层（组件、hooks、preferences 等）用法请参考 [Vue Vben Admin 文档](https://doc.vben.pro/)
- 后端接口与部署见 `../portal-service`

## License

基于 [Vue Vben Admin](https://github.com/vbenjs/vue-vben-admin)（MIT）开发。
