import { getRequestClient } from '#/shared/request-context';
import { TENANT_LIST_URL } from '#/shared/tenant-contract';

/** 系统租户（字段与后端 SysTenant 实体一致） */
export interface TenantRecord {
  id: number | string;
  name: string;
  code: string;
  status: number;
  remark?: string;
  createTime?: string;
  [key: string]: any;
}

/** 租户分页查询参数（后端 Page 对象绑定 current/size） */
export interface TenantPageParams {
  current?: number;
  /** 租户名称（模糊匹配） */
  name?: string;
  size?: number;
  /** 状态：0=禁用, 1=启用 */
  status?: number;
}

/** 租户分页返回（后端 IPage 结构） */
export interface TenantPageResult {
  current: number;
  pages: number;
  records: TenantRecord[];
  size: number;
  total: number;
}

/** 新增/更新租户的提交参数（更新时必须带 id，后端 PUT 从 body 读取） */
export type TenantSaveParams = Omit<TenantRecord, 'id'> & {
  id?: TenantRecord['id'];
};

/**
 * 获取当前用户关联的租户列表（租户切换数据源）。
 * request 实例由宿主注入（见 src/shared/request-context.ts），
 * token / baseURL / 拦截器均继承宿主配置。
 */
export function getTenantListApi() {
  return getRequestClient().get<TenantRecord[]>(TENANT_LIST_URL);
}

/**
 * 租户分页列表
 */
export function getTenantPage(params: TenantPageParams) {
  return getRequestClient().get<TenantPageResult>('/system/tenant/page', {
    params,
  });
}

/**
 * 租户详情
 */
export function getTenantById(id: TenantRecord['id']) {
  return getRequestClient().get<TenantRecord>(`/system/tenant/${id}`);
}

/**
 * 新增租户
 */
export function createTenant(data: Omit<TenantSaveParams, 'id'>) {
  return getRequestClient().post<boolean>('/system/tenant', data);
}

/**
 * 更新租户（后端 PUT /system/tenant，id 放在请求体）
 */
export function updateTenant(data: TenantSaveParams) {
  return getRequestClient().put<boolean>('/system/tenant', data);
}

/**
 * 删除租户
 */
export function deleteTenant(id: TenantRecord['id']) {
  return getRequestClient().delete<boolean>(`/system/tenant/${id}`);
}

/**
 * 批量删除租户（后端以逗号分隔的 ids 查询参数接收）
 */
export function deleteTenants(ids: Array<TenantRecord['id']>) {
  return getRequestClient().delete<boolean>('/system/tenant', {
    params: { ids: ids.join(',') },
  });
}
