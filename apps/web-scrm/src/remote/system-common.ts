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

/** 按钮权限校验函数：入参为功能码（如 'menu:add'），宿主实现负责拼接 clientId 前缀 */
type PermissionChecker = (featureCode: string) => boolean;

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
 * catch 异常后继续启动，不影响宿主自身运行。
 */
async function initSystemCommon(
  requestClient: RequestClient,
  permissionChecker?: PermissionChecker,
) {
  try {
    const context = await import('system_common/context');
    context.setRequestClient(requestClient);
    // 按钮权限校验器：远程页面声明功能码，宿主拼接 clientId 前缀后比对 accessCodes
    if (permissionChecker) {
      context.setPermissionChecker(permissionChecker);
    }
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
