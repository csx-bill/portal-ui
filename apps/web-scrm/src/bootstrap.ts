import { createApp, watchEffect } from 'vue';

import { registerAccessDirective } from '@vben/access';
import { registerLoadingDirective } from '@vben/common-ui/es/loading';
import { preferences } from '@vben/preferences';
import { initStores, useAccessStore } from '@vben/stores';
import '@vben/styles';
import '@vben/styles/antdv-next';

import { useTitle } from '@vueuse/core';

import { $t, setupI18n } from '#/locales';

import { initComponentAdapter } from './adapter/component';
import { initSetupVbenForm } from './adapter/form';
import App from './app.vue';
import { router } from './router';

// vxe-table 适配器在模块加载时执行 setupVbenVxeTable（注册表格表单工厂等
// 全局配置）。远程组件（system-common）渲染依赖该初始化，必须在
// bootstrap 阶段完成，不能等某个页面按需触发
import './adapter/vxe-table';

async function bootstrap(namespace: string) {
  // 初始化组件适配器
  await initComponentAdapter();

  // 初始化表单组件
  await initSetupVbenForm();

  // // 设置弹窗的默认配置
  // setDefaultModalProps({
  //   fullscreenButton: false,
  // });
  // // 设置抽屉的默认配置
  // setDefaultDrawerProps({
  //   zIndex: 1020,
  // });

  const app = createApp(App);

  // 注册v-loading指令
  registerLoadingDirective(app, {
    loading: 'loading', // 在这里可以自定义指令名称，也可以明确提供false表示不注册这个指令
    spinning: 'spinning',
  });

  // 国际化 i18n 配置
  await setupI18n(app);

  // 注册 system-common 远程模块（语言包 + request 实例 + 按钮权限校验器），
  // 必须在 setupI18n 之后执行；远程未就绪时内部会静默跳过
  // （requestClient 走动态导入，避免与 router/store 的模块环产生初始化顺序问题）
  const { requestClient } = await import('./api/request');
  const { initSystemCommon } = await import('./remote/system-common');
  // 校验器在页面渲染时才执行（pinia 已就绪）。权限码与数据库配置原样比对，两种约定都支持：
  // 公共功能：库里存全量码（web-scrm:menu:add），比对 `${clientId}:${功能码}`
  // 非公共功能：库里存裸码（mass:update），直接比对功能码本身
  const clientId = import.meta.env.VITE_APP_CLIENT_ID;
  await initSystemCommon(requestClient, (featureCode) => {
    const codes = useAccessStore().accessCodes;
    return (
      codes.includes(`${clientId}:${featureCode}`) ||
      codes.includes(featureCode)
    );
  });

  // 配置 pinia-tore
  await initStores(app, { namespace });

  // 安装权限指令
  registerAccessDirective(app);

  // 初始化 tippy
  const { initTippy } = await import('@vben/common-ui/es/tippy');
  initTippy(app);

  // 配置路由及路由守卫
  app.use(router);

  // 配置Motion插件
  const { MotionPlugin } = await import('@vben/plugins/motion');
  app.use(MotionPlugin);

  // 动态更新标题
  watchEffect(() => {
    if (preferences.app.dynamicTitle) {
      const routeTitle = router.currentRoute.value.meta?.title;
      const pageTitle =
        (routeTitle ? `${$t(routeTitle)} - ` : '') + preferences.app.name;
      useTitle(pageTitle);
    }
  });

  app.mount('#app');
}

export { bootstrap };
