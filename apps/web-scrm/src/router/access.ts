import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { preferences } from '@vben/preferences';

import { message } from 'antdv-next';

import { getAllMenusApi } from '#/api';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';
import { loadRemotePage } from '#/remote/system-common';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

/** 后端菜单中远程组件的标识前缀 */
const REMOTE_COMPONENT_PREFIX = '/system_common/';

/**
 * 递归遍历后端菜单，把远程组件（component 形如
 * "system_common/PermissionManagePage"）注册进 pageMap。
 *
 * 页面清单由 system-common 的注册表在运行时解析，宿主不维护
 * 任何静态映射——后端新增公共页面时宿主零改动。
 *
 * @vben/utils 的 generateRoutesByBackend 匹配 pageMap 时会自动给
 * component 补 .vue 后缀，因此这里的 key 也带 .vue 后缀对齐。
 */
function registerRemotePages(pageMap: ComponentRecordType, menus: any[]) {
  for (const menu of menus ?? []) {
    const component = menu?.component;
    if (
      typeof component === 'string' &&
      component.startsWith(REMOTE_COMPONENT_PREFIX)
    ) {
      const exposeName = component.slice(REMOTE_COMPONENT_PREFIX.length);
      pageMap[`${component}.vue`] = loadRemotePage(exposeName);
    }
    registerRemotePages(pageMap, menu?.children);
  }
}

/**
 * 剔除按钮节点（menuType='button'）。按钮仅承载权限标识、供角色授权树使用，
 * 无 path/component，混入会导致路由转换失败、前端无法访问。
 */
function stripButtonMenus(menus: any[]): any[] {
  return (menus ?? [])
    .filter((menu) => menu?.menuType !== 'button')
    .map((menu) =>
      menu?.children?.length
        ? { ...menu, children: stripButtonMenus(menu.children) }
        : menu,
    );
}

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const pageMap: ComponentRecordType = import.meta.glob('../views/**/*.vue');

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(preferences.app.accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      message.loading({
        content: `${$t('common.loadingMenu')}...`,
        duration: 1.5,
      });
      const menus = await getAllMenusApi();
      // 拿到菜单后、路由转换前，动态注册其中的远程组件
      registerRemotePages(pageMap, menus as any[]);
      return stripButtonMenus(menus as any[]);
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

export { generateAccess };
