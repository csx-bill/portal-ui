/**
 * system-common 不创建任何 axios / request 实例（见架构设计方案 5.1）。
 *
 * 宿主在 bootstrap 阶段调用 setRequestClient(requestClient) 注入自己的
 * @vben/request 实例；远程模块内的 api 层统一通过 getRequestClient() 获取。
 * 该模块经 vite 模块联邦 expose 为 system_common/context，宿主与远程页面
 * 引用的是同一份模块实例，注册一次全局生效。
 */
import type { RequestClient } from '@vben/request';

let client: null | RequestClient = null;

/**
 * 注册宿主的 request 实例（宿主 bootstrap 阶段调用一次）
 */
export function setRequestClient(requestClient: RequestClient) {
  client = requestClient;
}

/**
 * 获取宿主的 request 实例（远程模块 api 层调用）
 */
export function getRequestClient(): RequestClient {
  if (!client) {
    throw new Error(
      '[system-common] request client 未注册：宿主需要在 bootstrap 阶段调用 setRequestClient(requestClient)。',
    );
  }
  return client;
}

/**
 * default 导出（命名空间对象），与 locales/index.ts 的处理一致：
 * 规避模块联邦宿主端 wrapDefault 对命名导出模块的包装问题。
 */
export default {
  getRequestClient,
  setRequestClient,
};

/**
 * ==================== 按钮权限校验 ====================
 *
 * system-common 是独立构建的联邦远程模块，同时服务多个宿主，
 * 权限码前缀（clientId）与权限集合（accessCodes）都在宿主侧，
 * 因此由宿主在 bootstrap 阶段注入校验函数，远程页面只声明功能码
 * （如 'menu:add'）。宿主实现负责与数据库配置的权限码比对：
 * 公共功能（全量码 clientId:action）与非公共功能（裸码 action）两种约定均兼容
 */

type PermissionChecker = (featureCode: string) => boolean;

let permissionChecker: PermissionChecker | undefined;

/**
 * 注册宿主的权限校验函数（宿主 bootstrap 阶段调用一次）
 */
export function setPermissionChecker(checker: PermissionChecker) {
  permissionChecker = checker;
}

/**
 * 判断当前用户是否拥有指定功能权限（远程页面按钮显隐调用）。
 * 宿主未注入校验器时默认放行（服务端注解校验兜底，不影响未接入宿主）
 */
export function hasPermission(featureCode: string): boolean {
  return permissionChecker ? permissionChecker(featureCode) : true;
}
