import { getRequestClient } from '#/shared/request-context';

/** 当前登录用户的个人资料（后端 /system/user/info 原始结构的关键字段） */
export interface UserProfile {
  avatar?: string;
  email?: string;
  gender?: number;
  id: number | string;
  mobile?: string;
  name?: string;
  username: string;
  [key: string]: any;
}

/**
 * 获取当前登录用户的个人资料。
 * request 实例由宿主注入（见 src/shared/request-context.ts），
 * token / baseURL / 拦截器均继承宿主配置。
 */
export function getProfileApi() {
  return getRequestClient().get<UserProfile>('/system/user/info');
}

/**
 * 更新当前登录用户的个人资料（姓名/用户名/手机号/邮箱/性别）。
 * username 变更时后端查重；null 字段后端跳过不更新。
 */
export function updateProfileApi(data: {
  email?: string;
  gender?: number;
  mobile?: string;
  name: string;
  username?: string;
}) {
  return getRequestClient().put<boolean>('/system/user/profile', data);
}

/**
 * 修改当前登录用户的密码（后端校验旧密码）
 */
export function updateProfilePasswordApi(data: {
  newPassword: string;
  oldPassword: string;
}) {
  return getRequestClient().put<boolean>('/system/user/profile/password', data);
}
