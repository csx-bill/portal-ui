import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';
import { loadRemotePage } from '#/remote/system-common';

const routes: RouteRecordRaw[] = [
  {
    // 个人中心为 system-common 远程页面（ProfilePage），宿主零维护
    component: loadRemotePage('ProfilePage'),
    meta: {
      hideInMenu: true,
      icon: 'lucide:user',
      title: $t('page.auth.profile'),
    },
    name: 'Profile',
    path: '/profile',
  },
];

export default routes;
