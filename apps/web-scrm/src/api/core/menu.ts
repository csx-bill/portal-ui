import type { RouteRecordStringComponent } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 获取当前登录用户角色授权的菜单树（动态路由用）
 */
export async function getAllMenusApi() {
  return requestClient.get<RouteRecordStringComponent[]>(
    '/system/menu/my-tree',
  );
}
