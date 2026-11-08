import { getRequestClient } from '#/shared/request-context';

/** 系统角色（字段与后端 SysRole 实体一致） */
export interface SystemRole {
  /** 角色 ID（后端 Long） */
  id: number | string;
  /** 角色名称 */
  name: string;
  /** 状态：0=禁用, 1=启用 */
  status: number;
  /** 备注信息 */
  remark?: string;
  /** 数据权限：1=全部, 2=自定义, 3=本级及子级, 4=本级, 5=本人 */
  dataScope?: number;
  /** 自定义数据权限的部门 ID 列表（dataScope=2 时生效，随详情/分页返回） */
  deptIds?: Array<number | string>;
  /** 权限菜单 ID 列表（后端非数据库字段，随详情/分页返回） */
  permissions?: Array<number | string>;
  [key: string]: any;
}

/** 角色分页查询参数（后端 Page 对象绑定 current/size） */
export interface RolePageParams {
  current?: number;
  name?: string;
  size?: number;
  status?: number;
}

/** 角色分页返回（后端 IPage 结构） */
export interface RolePageResult {
  current: number;
  pages: number;
  records: SystemRole[];
  size: number;
  total: number;
}

/** 新增/更新角色的提交参数（更新时必须带 id，后端 PUT 从 body 读取） */
export type SystemRoleSaveParams = Omit<SystemRole, 'id'> & {
  id?: SystemRole['id'];
};

/**
 * 角色分页列表。
 * request 实例由宿主注入（见 src/shared/request-context.ts），
 * token / baseURL / 拦截器均继承宿主配置。
 */
/**
 * 全部角色列表（下拉选项用，后端 GET /system/role/list）
 */
export function getRoleList() {
  return getRequestClient().get<SystemRole[]>('/system/role/list');
}

export function getRolePage(params: RolePageParams) {
  return getRequestClient().get<RolePageResult>('/system/role/page', {
    params,
  });
}

/**
 * 角色详情（含 permissions 菜单 ID 列表）
 */
export function getRoleById(id: SystemRole['id']) {
  return getRequestClient().get<SystemRole>(`/system/role/${id}`);
}

/**
 * 新增角色
 */
export function createRole(data: Omit<SystemRoleSaveParams, 'id'>) {
  return getRequestClient().post<boolean>('/system/role', data);
}

/**
 * 更新角色（后端 PUT /system/role，id 放在请求体）
 */
export function updateRole(data: SystemRoleSaveParams) {
  return getRequestClient().put<boolean>('/system/role', data);
}

/**
 * 删除角色
 */
export function deleteRole(id: SystemRole['id']) {
  return getRequestClient().delete<boolean>(`/system/role/${id}`);
}
