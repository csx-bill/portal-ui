/**
 * 远程页面注册表（模块联邦 expose 入口：./pages）。
 *
 * 宿主通过 loadRemotePage(暴露名) 从本注册表解析页面加载器，
 * 页面清单的唯一来源在这里——新增公共页面只需在本文件注册，
 * 各宿主不持有任何页面映射，零改动：
 * - 后端路由模式：component "/system_common/XxxPage" 运行时自动解析
 * - 本地路由模式：宿主路由 component 直接写 loadRemotePage('XxxPage')
 *
 * 页面组件零 props，所有上下文（i18n / pinia / preferences / request /
 * 全局组件）从宿主继承。
 */
export const remotePages = {
  ClientManagePage: () => import('./views/system/client/index.vue'),
  DictManagePage: () => import('./views/system/dict/index.vue'),
  FileManagePage: () => import('./views/system/file/index.vue'),
  I18nManagePage: () => import('./views/system/i18n/index.vue'),
  MenuManagePage: () => import('./views/system/menu/index.vue'),
  ProfilePage: () => import('./views/system/profile/index.vue'),
  RoleManagePage: () => import('./views/system/role/index.vue'),
  TenantManagePage: () => import('./views/system/tenant/index.vue'),
  UserManagePage: () => import('./views/system/user/index.vue'),
} as const;

export type RemotePageName = keyof typeof remotePages;

// default 导出：规避联邦宿主端 wrapDefault 对命名导出模块的包装问题
export default remotePages;
