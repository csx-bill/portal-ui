import { getRequestClient } from '#/shared/request-context';

/** 菜单类型：catalog=目录, menu=菜单, button=按钮, embedded=内嵌, link=外链 */
export type MenuType = 'button' | 'catalog' | 'embedded' | 'link' | 'menu';

/** 徽标类型 */
export type MenuBadgeType = 'dot' | 'normal';

/** 徽标颜色集合（与 @vben-core/menu-ui 的 MenuBadge 对齐） */
export const menuBadgeVariants = [
  'default',
  'destructive',
  'primary',
  'success',
  'warning',
] as const;

/**
 * 菜单元数据（JSON 字段，结构对齐宿主路由的 RouteMeta）
 */
export interface SystemMenuMeta {
  /** 激活时显示的图标 */
  activeIcon?: string;
  /** 作为路由时，需要激活的菜单路径 */
  activePath?: string;
  /** 固定在标签栏 */
  affixTab?: boolean;
  /** 在标签栏固定的顺序 */
  affixTabOrder?: number;
  /** 徽标内容（当徽标类型为 normal 时有效） */
  badge?: string;
  /** 徽标类型 */
  badgeType?: MenuBadgeType;
  /** 徽标颜色 */
  badgeVariants?: (typeof menuBadgeVariants)[number];
  /** 在菜单中隐藏下级 */
  hideChildrenInMenu?: boolean;
  /** 在面包屑中隐藏 */
  hideInBreadcrumb?: boolean;
  /** 在菜单中隐藏 */
  hideInMenu?: boolean;
  /** 在标签栏中隐藏 */
  hideInTab?: boolean;
  /** 菜单图标 */
  icon?: string;
  /** 内嵌 Iframe 的 URL */
  iframeSrc?: string;
  /** 是否缓存页面 */
  keepAlive?: boolean;
  /** 外链页面的 URL */
  link?: string;
  /** 同一个路由最大打开的标签数 */
  maxNumOfOpenTab?: number;
  /** 无需基础布局 */
  noBasicLayout?: boolean;
  /** 是否在新窗口打开 */
  openInNewWindow?: boolean;
  /** 菜单排序 */
  order?: number;
  /** 额外的路由参数 */
  query?: Record<string, any>;
  /** 菜单标题 */
  title?: string;
}

/**
 * 系统菜单（字段与后端 SysMenu 实体一致：menuType / parentId / meta）
 */
export interface SystemMenu {
  /** 后端权限标识 */
  authCode?: string;
  /** 子菜单 */
  children?: SystemMenu[];
  /** 页面组件路径（宿主本地页面或 system_common/XxxPage 远程页面） */
  component?: string;
  /** 菜单 ID（后端 Long） */
  id: string;
  /** 菜单元数据 */
  meta?: SystemMenuMeta;
  /** 菜单名称（路由 name） */
  name: string;
  /** 上级菜单 ID */
  parentId?: string;
  /** 路由路径 */
  path?: string;
  /** 排序 */
  sortOrder?: number;
  /** 状态：0=禁用, 1=启用 */
  status: number;
  /** 菜单类型 */
  menuType: MenuType;
  [key: string]: any;
}

/** 新增/更新菜单的提交参数（更新时必须带 id，后端 PUT 从 body 读取） */
export type SystemMenuSaveParams = Omit<SystemMenu, 'children' | 'id'> & {
  id?: SystemMenu['id'];
};

/**
 * 获取完整菜单树。
 * request 实例由宿主注入（见 src/shared/request-context.ts），
 * token / baseURL / 拦截器均继承宿主配置。
 */
export function getMenuTree() {
  return getRequestClient().get<SystemMenu[]>('/system/menu/tree');
}

/**
 * 菜单名称是否已存在（编辑时传 excludeId 排除自身）
 */
export function isMenuNameExists(name: string, excludeId?: SystemMenu['id']) {
  return getRequestClient().get<boolean>('/system/menu/exists/name', {
    params: { excludeId, name },
  });
}

/**
 * 路由路径是否已存在（编辑时传 excludeId 排除自身）
 */
export function isMenuPathExists(path: string, excludeId?: SystemMenu['id']) {
  return getRequestClient().get<boolean>('/system/menu/exists/path', {
    params: { excludeId, path },
  });
}

/**
 * 新增菜单
 */
export function createMenu(data: SystemMenuSaveParams) {
  return getRequestClient().post<boolean>('/system/menu', data);
}

/**
 * 更新菜单
 */
export function updateMenu(data: SystemMenuSaveParams) {
  return getRequestClient().put<boolean>(`/system/menu`, data);
}

/**
 * 删除菜单（后端会递归删除子级）
 */
export function deleteMenu(id: SystemMenu['id']) {
  return getRequestClient().delete<boolean>(`/system/menu/${id}`);
}
