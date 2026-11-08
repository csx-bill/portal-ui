import { getRequestClient } from '#/shared/request-context';

/** OAuth2 客户端（终端）记录（字段与后端 SysOauthClient 实体一致） */
export interface SystemOauthClient {
  /** 允许授权的所有 URL（逗号分隔） */
  allowRedirectUris?: string;
  /** 授权类型（逗号分隔，如 password,refresh_token） */
  allowGrantTypes?: string;
  /** 客户端ID */
  clientId: string;
  /** 客户端秘钥 */
  clientSecret: string;
  /** 授权范围（逗号分隔） */
  contractScopes?: string;
  /** 创建时间 */
  createTime?: string;
  /** 主键ID */
  id: number | string;
  /** 状态：0=禁用, 1=启用（与全项目语义统一） */
  status: number;
  [key: string]: any;
}

/** 客户端分页查询参数（后端 Page 对象绑定 current/size） */
export interface OauthClientPageParams {
  /** 客户端ID（后端为精确匹配） */
  clientId?: string;
  current?: number;
  size?: number;
  /** 状态：0=禁用, 1=启用 */
  status?: number;
}

/** 客户端分页返回（后端 IPage 结构） */
export interface OauthClientPageResult {
  current: number;
  pages: number;
  records: SystemOauthClient[];
  size: number;
  total: number;
}

/** 新增/更新客户端的提交参数（更新时必须带 id，后端 PUT 从 body 读取） */
export type OauthClientSaveParams = Omit<SystemOauthClient, 'id'> & {
  id?: SystemOauthClient['id'];
};

/**
 * OAuth2 客户端（终端）分页列表。
 * request 实例由宿主注入（见 src/shared/request-context.ts），
 * token / baseURL / 拦截器均继承宿主配置。
 * 注意：后端 SysOauthClientQuery.clientId 为无条件精确匹配
 */
export function getOauthClientPage(params: OauthClientPageParams) {
  return getRequestClient().get<OauthClientPageResult>('/system/client/page', {
    params,
  });
}

/**
 * OAuth2 客户端详情
 */
export function getOauthClientById(id: SystemOauthClient['id']) {
  return getRequestClient().get<SystemOauthClient>(`/system/client/${id}`);
}

/**
 * 新增 OAuth2 客户端。
 * 注意：后端会用请求头 Client-Id（当前应用）覆盖请求体里的 clientId
 */
export function createOauthClient(data: Omit<OauthClientSaveParams, 'id'>) {
  return getRequestClient().post<boolean>('/system/client', data);
}

/**
 * 更新 OAuth2 客户端（后端 PUT /system/client，id 放在请求体）
 */
export function updateOauthClient(data: OauthClientSaveParams) {
  return getRequestClient().put<boolean>('/system/client', data);
}

/**
 * 删除 OAuth2 客户端
 */
export function deleteOauthClient(id: SystemOauthClient['id']) {
  return getRequestClient().delete<boolean>(`/system/client/${id}`);
}

/**
 * 批量删除 OAuth2 客户端（后端以逗号分隔的 ids 查询参数接收）
 */
export function deleteOauthClients(ids: Array<SystemOauthClient['id']>) {
  return getRequestClient().delete<boolean>('/system/client', {
    params: { ids: ids.join(',') },
  });
}
