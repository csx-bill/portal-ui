import client from './client';
import dept from './dept';
import dict from './dict';
import file from './file';
import i18n from './i18n';
import menu from './menu';
import profile from './profile';
import role from './role';
import tenant from './tenant';
import user from './user';

/**
 * system 模块语言包聚合。
 * 新增 system 子模块（如 dept）只需：建 dept.ts → 在 views/system/dept
 * 使用 systemCommon.system.dept.* 键 → 这里加一行。
 */
export default {
  /** 菜单/路由分组标题（宿主直接以 key 引用，延迟翻译） */
  title: 'System',
  client,
  dept,
  dict,
  file,
  i18n,
  menu,
  profile,
  role,
  tenant,
  user,
};
