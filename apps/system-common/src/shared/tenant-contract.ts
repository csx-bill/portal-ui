/**
 * 租户契约常量（宿主 ↔ system-common）。
 *
 * 本文件是唯一事实来源：system-common 内部经 `#/shared/tenant-contract`
 * 引用；宿主（请求层的 X-Tenant-Id 拦截/懒加载）经 workspace 包导出
 * `@vben/system-common/constants` 以普通模块直接引用——不走模块联邦，
 * 保证远程未就绪时宿主请求层依然同步可用。
 *
 * 注意：保持本文件零 import（含 #/ 别名），否则无法在宿主构建中解析。
 */

/**
 * 当前租户 ID 在 localStorage 的持久化键。
 * 租户切换弹窗写入，宿主请求层读取后设置 X-Tenant-Id 请求头；
 * 键名变更是破坏性变更（已登录用户浏览器里还是旧键）。
 */
export const TENANT_STORAGE_KEY = 'last_tenant_id';

/** 租户列表接口路径（返回当前用户可用的租户） */
export const TENANT_LIST_URL = '/system/tenant/list';
