import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  const raw: any = await requestClient.get('/system/user/info');

  return {
    /** 按钮权限 */
    accessCodes: (raw.permissions as string[]) ?? [],
    userInfo: {
      avatar: raw.avatar ?? '',
      desc: '',
      homePath: '/',
      realName: raw.name ?? raw.username,
      roles: (raw.roles as string[]) ?? [],
      token: '',
      userId: String(raw.id),
      username: raw.username,
    } as UserInfo,
  };
}
