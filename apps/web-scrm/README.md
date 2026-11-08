# web-scrm

**新企通 SCRM · 企业微信客户运营平台**

提供获客、客户运营、群运营、内容触达与风险管控等一站式能力，围绕企业微信展开。

## 功能页面

页面为普通路由页面（`src/router/routes/modules/`），视图位于 `src/views/<module>/`：

| 页面 | 视图目录 | 说明 |
| --- | --- | --- |
| 工作台 | `dashboard` | 客户资产与运营效果总览，数据实时统计 |
| 企业管理 | `corp` | 企业微信授权/认证管理 |
| 通讯录 | `contact` | 企微成员通讯录 |
| 客户管理 | `customer` | 企微客户资产管理 |
| 获客链接 | `acquisition` | 创建/编辑/删除获客链接，客户通过链接添加成员 |
| 客户标签 | `tag` | 企业标签管理 |
| 客户群发 | `mass` | 客户群发任务 |
| 客群列表 | `groupchat` | 客户群管理 |
| 朋友圈任务 | `moment` | 朋友圈发表任务 |
| 欢迎语 | `welcome` | 添加客户欢迎语 |
| 客户继承 | `inheritance` | 离职/转接客户继承 |
| 聊天敏感词 | `intercept` | 会话风险管控规则 |

## 技术栈

vben-admin v5 monorepo 应用（`@vben/web-scrm`），pnpm + turbo：

- Vue 3 + TypeScript + Vite
- UI：`antdv-next`、`vxe-table` / `vxe-pc-ui`；状态：Pinia；国际化：zh-CN / en-US
- vben 表格/表单适配器在本 app 内维护：`src/adapter/form.ts`、`src/adapter/vxe-table.ts`、
  `src/adapter/component/index.ts`
- 模块联邦（`@originjs/vite-plugin-federation`）：本应用作为**宿主（Host）**，
  消费 `system-common` 的 `remoteEntry.js`；shared 名单派生自 system-common 的
  `package.json`（单一事实来源），`antdv-next` / `pinia` / `vue` / `vue-router` 单实例运行
- 页面样式与交互约定见本目录 [AGENTS.md](./AGENTS.md)

## 本地开发

启动本应用依赖：后端 `:8080`、system-common（Remote）开发服务器 `:3200`，本应用端口 `:5000`。

```bash
pnpm dev        # http://localhost:5000
pnpm typecheck  # vue-tsc 校验
pnpm build      # 生产构建
```

开发代理（`vite.config.ts`）：

- `/api` → `http://localhost:8080`（去前缀重写）
- `/local` → `http://localhost:8080`（上传文件的访问前缀，生产由 nginx 服务）

环境变量（`.env` / `.env.development`）：

- `VITE_APP_CLIENT_ID` / `VITE_APP_CLIENT_SECRET`：登录鉴权用的应用标识（`web-scrm`）
- `VITE_SYSTEM_COMMON_REMOTE_URL`：system-common 的 remoteEntry 地址
  （开发默认 `http://localhost:3200/remoteEntry.js`，生产为同域 `/system-common/remoteEntry.js`）
- `VITE_APP_TITLE` / `VITE_APP_NAMESPACE` / `VITE_APP_STORE_SECURE_KEY`：应用标题、
  缓存/store 隔离前缀、store 持久化加密密钥
