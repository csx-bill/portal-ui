/**
 * system-common 远程模块的类型声明。
 *
 * 模块联邦的远程导入（system_common/xxx）在构建期由
 * @originjs/vite-plugin-federation 重写为 remoteEntry 加载，
 * TypeScript 无法静态分析，这里手工声明其导出形状。
 * 签名需与 apps/system-common/src/ 下的实现保持一致。
 *
 * 注意：声明文件内不能使用顶层 import（会使 declare module 退化为
 * 模块增强），统一使用 import('xxx').Type 形式的内联类型引用。
 */
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

  /**
   * 注册按钮权限校验函数：入参为功能码（如 'menu:add'），
   * 宿主实现拼接 clientId 前缀后与登录下发的 accessCodes 比对
   */
  export function setPermissionChecker(
    checker: (featureCode: string) => boolean,
  ): void;

  const _default: {
    getRequestClient: typeof getRequestClient;
    setRequestClient: typeof setRequestClient;
    setPermissionChecker: typeof setPermissionChecker;
  };
  export default _default;
}

declare module 'system_common/pages' {
  /**
   * 远程页面注册表：暴露名 → 页面组件加载器。
   * 唯一来源在 apps/system-common/src/pages.ts，宿主不维护页面映射。
   */
  export const remotePages: Record<string, () => Promise<any>>;
  export default remotePages;
}

declare module 'system_common/components' {
  /**
   * 公共组件与共享状态（来源：apps/system-common/src/components/index.ts）。
   * 宿主按需引入，例如租户切换弹窗 / 租户 store / 素材选择弹窗。
   */
  export const MediaPickerModal: import('vue').Component;

  export const TenantSwitchModal: import('vue').Component;

  export function useTenantStore(): {
    currentTenantId: import('vue').Ref<null | number | string>;
    fetchTenantList: () => Promise<void>;
    loaded: import('vue').Ref<boolean>;
    switchTenant: (tenantId: number | string) => void;
    tenantList: import('vue').Ref<
      Array<{
        code: string;
        id: number | string;
        name: string;
        remark: string;
        status: number;
      }>
    >;
    $reset: () => void;
  };
}
