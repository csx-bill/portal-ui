# 模块联邦宿主接入指南

拷贝 `apps/web-antdv-next`（母版）创建新的宿主应用（如 `apps/web-wms`）并接入
system-common 公共页面（权限 / 字典 / 审计日志 / 文件管理）时，需要修改调整的地方。


**可参照的完整样例**：

| 样例 | 模式 | 说明 |
| --- | --- | --- |
| `apps/web-portal` | 后端菜单（`accessMode: 'backend'`） | 路由/菜单由后端接口下发，**推荐** |

---

## 改动总览

| 类型 | 数量 | 明细 |
| --- | --- | --- |
| 修改 | 8 个文件 | package.json、vite.config.ts、.env.development、.env.production、src/preferences.ts、src/bootstrap.ts、src/locales/index.ts、src/router/access.ts |
| 新增 | 2 个文件 | src/remote/system-common.ts、src/remote/federation-modules.d.ts |
| 依赖 | 1 行 | devDependencies 加联邦插件 |

前端路由模式的宿主额外新增 1 个 `src/router/routes/modules/system.ts`（见第七节）。

---

## 一、依赖（package.json）

devDependencies 增加一行（catalog 已在根 pnpm-workspace.yaml 中声明）：

```json
{
  "devDependencies": {
    "@originjs/vite-plugin-federation": "catalog:"
  }
}
```

另外，dependencies 需要覆盖 system-common 声明为联邦 shared 的依赖
（shared 名单由 `deriveFederationSharedDeps` 从 system-common/package.json
派生，宿主必须能解析同一批包才能提供共享实例）：

```json
{
  "dependencies": {
    "@vben/common-ui": "workspace:*",
    "@vben/locales": "workspace:*",
    "@vben/plugins": "workspace:*",
    "@vben/preferences": "workspace:*",
    "@vben/utils": "workspace:*",
    "@vueuse/core": "catalog:",
    "pinia": "catalog:",
    "vue": "catalog:",
    "vue-router": "catalog:",
    "vxe-pc-ui": "catalog:"
  }
}
```

> - `vxe-pc-ui` 供文件管理页的分页器使用（与 vxe-grid 内置分页同款组件），
>   必须由宿主提供同一实例，分页器的主题与语言才会与宿主一致。
> - `antdv-next` 由 `deriveFederationSharedDeps` 自动纳入 shared（见
>   internal/vite-config/src/federation.ts）：远端组件必须使用宿主实例，
>   主题（暗色算法/设计 token）才由宿主统一渲染；宿主 vite.config.ts
>   需将其加入 `optimizeDeps.exclude`，避免 dev 下形成双实例。

---

## 二、构建配置（vite.config.ts）

用以下结构替换母版的 vite.config.ts（`server.proxy` 按母版保留）：

```ts
import federation from '@originjs/vite-plugin-federation';

import { resolve } from 'node:path';

import { defineConfig, deriveFederationSharedDeps } from '@vben/vite-config';
import { loadEnv } from 'vite';

/**
 * web-xxx（Host）构建配置
 *
 * - 通过 VITE_SYSTEM_COMMON_REMOTE_URL 指向 system-common 的 remoteEntry.js
 *   （开发环境 :3200，生产环境同域 /system-common/remoteEntry.js）
 * - 联邦 shared 名单派生自 system-common 的 package.json（单一事实来源），
 *   宿主提供的集合恰好等于 remote 消费的集合，remote 增改依赖自动同步
 */
const sharedDeps = deriveFederationSharedDeps(
  resolve(process.cwd(), '../system-common/package.json'),
);

// dev 模式下这些 npm 包默认会被 vite 预打包进 .vite/deps，而模块联邦
// shared 提供的是源码 ESM 路径，会形成两个模块实例（provide/inject、
// i18n 全部失效）。必须排除预打包，让宿主与远程组件使用同一实例。
const singleInstanceDeps = ['pinia', 'vue', 'vue-router'];

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const remoteUrl = env.VITE_SYSTEM_COMMON_REMOTE_URL;

  return {
    application: {
      // vxe-table 懒加载改写子路径导入，会破坏模块联邦 shared 的模块标识，
      // 宿主与 remote 都必须关闭（remote 侧见 apps/system-common/vite.config.ts）
      vxeTableLazyImport: false,
    },
    vite: {
      plugins: [
        federation({
          name: 'web_xxx',
          remotes: {
            system_common: remoteUrl ?? 'http://localhost:3200/remoteEntry.js',
          },
          shared: sharedDeps,
        }),
      ],
      optimizeDeps: {
        exclude: singleInstanceDeps,
      },
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // mock代理目标地址
            target: 'http://localhost:5320/api',
            ws: true,
          },
        },
      },
    },
  };
});
```

要点：

- `deriveFederationSharedDeps` 来自 `@vben/vite-config`（internal/vite-config/src/federation.ts），
  读取 system-common 的 package.json 派生 shared 名单，宿主与 remote 两侧天然一致；
- `optimizeDeps.exclude` 与 `vxeTableLazyImport: false` **缺一不可**（见第十一节坑位）。

---

## 三、环境变量

`.env.development` 追加：

```bash
# system-common（Remote）remoteEntry.js 地址，本地开发指向独立 dev server（:3200）
VITE_SYSTEM_COMMON_REMOTE_URL=http://localhost:3200/remoteEntry.js
```

`.env.production` 追加：

```bash
# 生产环境统一为同域路径（Nginx /system-common）
VITE_SYSTEM_COMMON_REMOTE_URL=/system-common/remoteEntry.js
```

---

## 四、应用偏好（src/preferences.ts）

**后端菜单模式（推荐）**——路由/菜单由后端接口下发：

```ts
export const overridesPreferences = defineOverridesPreferences({
  app: {
    accessMode: 'backend',
    name: import.meta.env.VITE_APP_TITLE,
  },
  copyright: appCopyrightPreferences,
});
```

前端路由模式则不改此项（保持默认 `'frontend'`），并按第七节补本地路由文件。

> 改 accessMode 后必须清一次浏览器 localStorage 里的 `*-preferences*` 缓存，
> 否则旧偏好持久化会让新模式不生效（见第十一节坑位 3）。

---

## 五、bootstrap（src/bootstrap.ts）

两处改动：

**1. 顶部静态导入区**追加（母版中没有任何页面加载 vxe-table 适配器，
但远程组件的表格依赖这次初始化）：

```ts
// vxe-table 适配器在模块加载时执行 setupVbenVxeTable（注册表格表单工厂等
// 全局配置）。远程组件（system-common）渲染依赖该初始化，必须在
// bootstrap 阶段完成，不能等某个页面按需触发
import './adapter/vxe-table';
```

**2. `setupI18n(app)` 之后**追加（在 `initStores` 之前）：

```ts
  // 注册 system-common 远程模块的运行时上下文（注入 request 实例），
  // 必须在 setupI18n 之后执行；远程未就绪时内部会静默跳过
  // （requestClient 走动态导入，避免与 router/store 的模块环产生初始化顺序问题）
  const { requestClient } = await import('./api/request');
  const { initSystemCommon } = await import('./remote/system-common');
  await initSystemCommon(requestClient);
```

---

## 六、语言包接入（src/locales/index.ts）

修改 `loadMessages`，把远程文案并入返回值（这是 vben 官方
「远程加载语言包」的扩展点，见 https://doc.vben.pro/guide/in-depth/locale.html ）：

```ts
import { loadSystemCommonMessages } from '#/remote/system-common';

async function loadMessages(lang: SupportedLanguagesType) {
  const [appLocaleMessages, systemCommonMessages] = await Promise.all([
    localesMap[lang]?.(),
    // system-common 远程语言包：语言装载时重新获取，
    // 保证切换语言后远程页面文案不丢失（远程未就绪时返回空对象）
    loadSystemCommonMessages(lang),
    loadThirdPartyMessage(lang),
  ]);
  return {
    ...appLocaleMessages?.default,
    systemCommon: systemCommonMessages,
    // 与 vben 的嵌套语言包结构一致，统一断言为宽松的 Record<string, string>
  } as unknown as Record<string, string>;
}
```

宿主**不需要**创建任何公共页面的语言文件——菜单/页面文案的唯一来源在
system-common 的 `locales/` 中。

---

## 七、路由（src/router/access.ts）

**后端菜单模式**：修改 `generateAccess`，在拿到菜单后把远程组件动态注册进
pageMap（完整替换母版该文件）：

```ts
import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { message } from 'antdv-next';

import { getAllMenusApi } from '#/api';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';
import { loadRemotePage } from '#/remote/system-common';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

/** 后端菜单中远程组件的标识前缀 */
const REMOTE_COMPONENT_PREFIX = 'system_common/';

/**
 * 递归遍历后端菜单，把远程组件（component 形如
 * "system_common/PermissionManagePage"）注册进 pageMap。
 *
 * 页面清单由 system-common 的注册表在运行时解析，宿主不维护
 * 任何静态映射——后端新增公共页面时宿主零改动。
 *
 * @vben/utils 的 generateRoutesByBackend 匹配 pageMap 时会自动给
 * component 补 .vue 后缀，因此这里的 key 也带 .vue 后缀对齐。
 */
function registerRemotePages(pageMap: ComponentRecordType, menus: any[]) {
  for (const menu of menus ?? []) {
    const component = menu?.component;
    if (typeof component === 'string' && component.startsWith(REMOTE_COMPONENT_PREFIX)) {
      const exposeName = component.slice(REMOTE_COMPONENT_PREFIX.length);
      pageMap[`${component}.vue`] = loadRemotePage(exposeName);
    }
    registerRemotePages(pageMap, menu?.children);
  }
}

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const pageMap: ComponentRecordType = import.meta.glob('../views/**/*.vue');

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      message.loading({
        content: `${$t('common.loadingMenu')}...`,
        duration: 1.5,
      });
      const menus = await getAllMenusApi();
      // 拿到菜单后、路由转换前，动态注册其中的远程组件
      registerRemotePages(pageMap, menus as any[]);
      return menus;
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

export { generateAccess };
```

**前端路由模式**：access.ts 同样按上述修改（动态注册逻辑两种模式通用），
另需新增 `src/router/routes/modules/system.ts`：

```ts
import type { RouteRecordRaw } from 'vue-router';

import { loadRemotePage } from '#/remote/system-common';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'lucide:settings',
      order: 100,
      title: 'systemCommon.title',       // 远程 i18n key，延迟翻译
    },
    name: 'System',
    path: '/system',
    redirect: '/system/permission',
    children: [
      {
        meta: { icon: 'lucide:shield-check', title: 'systemCommon.permission.title' },
        name: 'SystemPermission',
        path: 'permission',
        component: loadRemotePage('PermissionManagePage'),
      },
      {
        meta: { icon: 'lucide:book-marked', title: 'systemCommon.dict.title' },
        name: 'SystemDict',
        path: 'dict',
        component: loadRemotePage('DictManagePage'),
      },
      {
        meta: { icon: 'lucide:scroll-text', title: 'systemCommon.audit.title' },
        name: 'SystemAudit',
        path: 'audit',
        component: loadRemotePage('AuditLogPage'),
      },
      {
        meta: { icon: 'lucide:folder-open', title: 'systemCommon.file.title' },
        name: 'SystemFile',
        path: 'file',
        component: loadRemotePage('FileManagePage'),
      },
    ],
  },
];

export default routes;
```

> `component` **直接使用** `loadRemotePage(...)` 的返回值，与 vue-router
> 懒加载组件行为一致；不要用 `defineAsyncComponent` 再包一层（坑位 1）。

---

## 八、远程接入层（新增 2 个文件）

**`src/remote/system-common.ts`**（全文复制）：

```ts
/**
 * system-common 远程模块接入层（Host 侧）
 *
 * 宿主侧共三处与联邦相关的改动（接入流程）：
 * 1. vite.config.ts 配置 federation remotes
 * 2. bootstrap 阶段调用 initSystemCommon()（注入 request 实例）
 * 3. 本文件 + 路由接入（access.ts 动态注册 / routes/modules/system.ts）
 *
 * 注意：本文件刻意不引入任何静态运行时依赖（仅类型），
 * 避免与 router / store / locales 产生循环引用。
 */
import type { RequestClient } from '@vben/request';

type RemotePageLoader = () => Promise<any>;

/** 远程页面注册表（system_common/pages），整个会话只加载一次 */
let pagesRegistry: Promise<Record<string, RemotePageLoader>> | undefined;

function loadPagesRegistry() {
  pagesRegistry ??= import('system_common/pages').then(
    (m) => m.remotePages as Record<string, RemotePageLoader>,
  );
  return pagesRegistry;
}

/**
 * 按暴露名加载远程页面（如 'PermissionManagePage'）。
 *
 * 页面清单的唯一来源在 system-common 的 src/pages.ts，
 * 宿主不持有任何页面映射，新增公共页面时宿主零改动：
 * - 后端路由模式：菜单 component "system_common/XxxPage" 运行时自动解析
 *   （见 src/router/access.ts）
 * - 本地路由模式：路由 component 直接写 loadRemotePage('XxxPage')
 */
function loadRemotePage(exposeName: string): RemotePageLoader {
  return async () => {
    const pages = await loadPagesRegistry();
    const loader = pages[exposeName];
    if (!loader) {
      throw new Error(`[system-common] 远程页面未注册：${exposeName}`);
    }
    return loader();
  };
}

/**
 * 在 bootstrap 阶段注册远程模块的运行时上下文：注入宿主的
 * @vben/request 实例（远程组件内 api 直接复用）。
 *
 * 语言包不走这里：远程文案由宿主的 loadMessages 钩子装载
 * （见 src/locales/index.ts，与 vben 官方"远程加载语言包"
 * 的扩展点一致），初始装载与语言切换都会重新合并。
 *
 * 容错：system-common 未就绪时（如本地开发未启动），
 * catch 异常后继续启动，不影响宿主自身运行（见架构设计方案 7.4）。
 */
async function initSystemCommon(requestClient: RequestClient) {
  try {
    const context = await import('system_common/context');
    context.setRequestClient(requestClient);
  } catch (error) {
    console.warn(
      '[system-common] 远程模块未就绪，已跳过 request 注册（不影响宿主启动）',
      error,
    );
  }
}

/**
 * 获取远程语言包中指定语言的文案。
 *
 * 宿主切换语言时 vue-i18n 会整体替换目标语言的 messages，
 * 因此语言包需要在每次语言装载时重新合并（见 src/locales/index.ts），
 * 该函数即为此提供数据源；远程模块未就绪时返回空对象。
 */
async function loadSystemCommonMessages(lang: string) {
  try {
    const remote = await import('system_common/locales');
    return remote.getSystemCommonLocaleMessages(lang);
  } catch {
    return {};
  }
}

export { initSystemCommon, loadRemotePage, loadSystemCommonMessages };
```

**`src/remote/federation-modules.d.ts`**（全文复制）：

```ts
/**
 * system-common 远程模块的类型声明。
 *
 * 模块联邦的远程导入（system_common/xxx）在构建期由
 * @originjs/vite-plugin-federation 重写为 remoteEntry 加载，
 * TypeScript 无法静态分析，这里手工声明其导出形状。
 * 签名需与 apps/system-common/src/ 下的实现保持一致。
 *
 * 注意 1：声明文件内不能使用顶层 import（会使 declare module 退化为
 * 模块增强），统一使用 import('xxx').Type 形式的内联类型引用。
 * 注意 2：文件名不能与同目录的 system-common.ts 同名（system-common.d.ts），
 * 否则 TypeScript 会忽略整个声明文件。
 */
declare module 'system_common/pages' {
  /**
   * 远程页面注册表：暴露名 → 页面组件加载器。
   * 唯一来源在 apps/system-common/src/pages.ts，宿主不维护页面映射。
   */
  export const remotePages: Record<string, () => Promise<any>>;
  export default remotePages;
}

declare module 'system_common/locales' {
  /**
   * 获取指定语言的远程文案（命名空间为 systemCommon）。
   * 由宿主的 loadMessages 钩子调用（见 src/locales/index.ts），
   * 初始装载与语言切换时都会重新获取。
   */
  export function getSystemCommonLocaleMessages(
    locale: string,
  ): Record<string, any>;

  const _default: {
    getSystemCommonLocaleMessages: typeof getSystemCommonLocaleMessages;
  };
  export default _default;
}

declare module 'system_common/context' {
  export function setRequestClient(
    requestClient: import('@vben/request').RequestClient,
  ): void;
  export function getRequestClient(): import('@vben/request').RequestClient;

  const _default: {
    getRequestClient: typeof getRequestClient;
    setRequestClient: typeof setRequestClient;
  };
  export default _default;
}
```

---

## 九、启动与验证

```bash
# 1. 安装依赖（新增的 federation devDep 生效）
pnpm install

# 2. 启动 remote（:3200，必须先于宿主）
pnpm dev:system-common

# 3. 启动新宿主
pnpm --filter @vben/web-xxx dev
```
---

## 十、坑位提示（均实测踩过，不要省略）

1. **远程页面不要用 `defineAsyncComponent` 包一层**——与 vben 布局的
   Transition/KeepAlive 组合会触发 `insertBefore`/`parentNode` null 渲染崩溃；
   `loadRemotePage(...)` 的返回值直接作为路由 component。
2. **`optimizeDeps.exclude`（3 个包）与 `vxeTableLazyImport: false` 缺一不可**——
   前者防 dev 双 vue 实例（provide/inject 断链），后者防 vxe 子路径改写
   破坏 shared 模块标识。
3. **改 `accessMode` 后清一次偏好缓存**——vben 偏好持久化在 localStorage
   （`<namespace>-preferences*`），不清则新模式不生效。
4. **`meta.title` / 菜单 title 必须是远程 key 字符串**（如
   `'systemCommon.permission.title'`）——路由/菜单模块的加载早于远程语言包
   装载，`$t()` 立即求值会显示原始 key。
5. **`vite.config.ts` 变更触发 dev server 自动重启后，浏览器整页重开**——
   deps 重新预构建的中间态会让已打开页面里的远程模块白屏。

---

## 附：接入后的维护模型

新增公共页面：system-common 侧改 `views/ + api/ + pages.ts + locales/`，
后端菜单加一条；**宿主零改动**。
