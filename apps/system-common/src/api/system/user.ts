import { getRequestClient } from '#/shared/request-context';

/** 系统用户（字段与后端 SysUser 实体一致） */
export interface SystemUser {
  /** 用户 ID（后端 Long） */
  id: number | string;
  /** 用户名（登录账号） */
  username: string;
  /** 姓名 */
  name?: string;
  /** 密码（仅提交用；新增必填，编辑留空则不修改） */
  password?: string;
  /** 手机号 */
  mobile?: string;
  /** 邮箱 */
  email?: string;
  /** 性别：0-未知 1-男 2-女 */
  gender?: number;
  /** 状态：0=禁用, 1=启用 */
  status?: number;
  /** 所属部门 ID 列表（后端非数据库字段，随详情/分页返回） */
  deptIds?: Array<number | string>;
  /** 所属部门名称列表（仅列表展示用） */
  deptNames?: string[];
  [key: string]: any;
}

/** 用户分页查询参数（后端 Page 对象绑定 current/size） */
export interface UserPageParams {
  current?: number;
  /** 部门 ID（含其子部门） */
  deptId?: number | string;
  /** 关键字（用户名/姓名/手机号模糊查询） */
  keyword?: string;
  size?: number;
  status?: number;
}

/** 用户分页返回（后端 IPage 结构） */
export interface UserPageResult {
  current: number;
  pages: number;
  records: SystemUser[];
  size: number;
  total: number;
}

/** 新增/更新用户的提交参数（更新时必须带 id，后端 PUT 从 body 读取） */
export type SystemUserSaveParams = Omit<SystemUser, 'id'> & {
  id?: SystemUser['id'];
};

/**
 * 用户分页列表。
 * request 实例由宿主注入（见 src/shared/request-context.ts），
 * token / baseURL / 拦截器均继承宿主配置。
 */
export function getUserPage(params: UserPageParams) {
  return getRequestClient().get<UserPageResult>('/system/user/page', {
    params,
  });
}

/**
 * 用户详情（含 deptIds 所属部门 ID 列表）
 */
export function getUserById(id: SystemUser['id']) {
  return getRequestClient().get<SystemUser>(`/system/user/${id}`);
}

/**
 * 新增用户
 */
export function createUser(data: Omit<SystemUserSaveParams, 'id'>) {
  return getRequestClient().post<boolean>('/system/user', data);
}

/**
 * 更新用户（后端 PUT /system/user，id 放在请求体；密码留空则不修改）
 */
export function updateUser(data: SystemUserSaveParams) {
  return getRequestClient().put<boolean>('/system/user', data);
}

/**
 * 删除用户
 */
export function deleteUser(id: SystemUser['id']) {
  return getRequestClient().delete<boolean>(`/system/user/${id}`);
}
