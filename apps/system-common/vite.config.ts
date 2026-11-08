import type { Plugin } from 'vite';

import { resolve } from 'node:path';
import process from 'node:process';

import { defineConfig, deriveFederationSharedDeps } from '@vben/vite-config';

import federation from '@originjs/vite-plugin-federation';

/**
 * rolldown 兼容补丁：修复远程组件样式注入。
 *
 * @originjs/vite-plugin-federation 在 generateBundle 阶段用正则
 * `(["'])__v__css__.*?\1` 把 remoteEntry 中的 CSS 占位符替换为产物
 * css 文件数组，但该正则只匹配单/双引号字符串；rolldown 的代码生成
 * 会把这些字符串输出为模板字面量（反引号），导致替换不生效，
 * 运行时报 "e.forEach is not a function"。
 *
 * 本插件在 federation 之后运行，把反引号形式的占位符统一替换为
 * bundle 内实际产出的 css 文件名数组（与插件自身逻辑等价）。
 */
function fixRemoteCssInjection(): Plugin {
  return {
    name: 'system-common:fix-remote-css-injection',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const entry = bundle['remoteEntry.js'];
      if (!entry || entry.type !== 'chunk') {
        return;
      }
      const cssFiles = Object.keys(bundle)
        .filter((file) => file.endsWith('.css'))
        .map((file) => file.split('/').pop());
      if (cssFiles.length === 0) {
        return;
      }
      entry.code = entry.code.replaceAll(
        /`__v__css__[^`]*`/g,
        JSON.stringify(cssFiles),
      );
    },
  };
}

/**
 * system-common（Remote）构建配置
 *
 * 运行时边界（见《前端模块联邦架构设计方案》第五节）：
 * - 不 createApp / createI18n / createPinia / initPreferences
 * - 所有上下文由宿主提供，本应用只导出组件与语言包
 *
 * 本地开发：`pnpm dev` = vite build --watch + vite preview（:3200），
 * 见 scripts/dev.mjs 的说明。
 *
 * 联邦 shared 名单派生自本应用的 package.json（单一事实来源），
 * 见 @vben/vite-config 的 deriveFederationSharedDeps。
 */
const sharedDeps = deriveFederationSharedDeps(
  resolve(process.cwd(), 'package.json'),
);

/**
 * 注意：defineConfig 的第二个参数必须显式传 'application'。
 * auto 模式根据 index.html 是否存在判断项目类型，而 remote 没有
 * index.html（入口由 rolldownOptions.input 提供），会被误判为
 * library 项目并注入 dependencies-external 函数，与联邦插件的
 * shared 处理冲突。
 */
export default defineConfig(async ({ mode }) => {
  const isProd = mode === 'production';

  return {
    application: {
      // remote 不需要 mock 服务（接口由宿主统一代理）
      nitroMock: false,
      // vxe-table 懒加载改写子路径导入，会破坏模块联邦 shared 的模块标识，
      // remote 与宿主都必须关闭（宿主侧见 apps/portal-web/vite.config.ts）
      vxeTableLazyImport: false,
      // remote 通过版本目录 + 软链发布，不需要 zip 归档
      archiver: false,
      // 占位页不需要全局 loading 动画（也不会调用 unmountGlobalLoading）
      injectAppLoading: false,
    },
    vite: {
      // 生产产物挂载在同域 /system-common/ 路径下（Nginx，见架构设计方案 9.1）；
      // 开发模式（build --mode development + preview）在根路径提供服务
      base: isProd ? '/system-common/' : '/',
      plugins: [
        federation({
          name: 'system_common',
          filename: 'remoteEntry.js',
          // 暴露面（Remote → Host）：
          // - ./pages：页面经注册表动态解析，新增公共页面只需在
          //   src/pages.ts 注册（无需改这里）
          // - ./components：公共组件/共享状态（如租户切换弹窗）
          // - ./context、./locales：运行时上下文与语言包
          exposes: {
            './components': './src/components/index.ts',
            './context': './src/shared/request-context.ts',
            './locales': './src/locales/index.ts',
            './pages': './src/pages.ts',
          },
          shared: sharedDeps,
        }),
        // 必须放在 federation 之后（generateBundle 按注册顺序执行）
        fixRemoteCssInjection(),
      ],
      build: {
        // remote 不是应用，没有 index.html 入口；remoteEntry.js 由插件
        // 以固定文件名直接产出，这里用包语义的汇总入口满足构建要求
        rolldownOptions: {
          input: 'src/index.ts',
        },
        // 模块联邦要求 esnext
        target: 'esnext',
        // 关闭样式拆分，避免远程组件样式丢失
        cssCodeSplit: false,
        // 插件按 assetsDir 前缀产出 remoteEntry.js（默认 'assets'），
        // 置空使其落在 dist 根目录，与部署路径 /system-common/remoteEntry.js 对齐
        assetsDir: '',
        // 注意：必须开启压缩。插件的远程样式注入正则只匹配引号字符串，
        // 未压缩产物中的模板字符串（反引号）无法被替换，运行时会报
        // "e.forEach is not a function"。调试需要通过 sourcemap 补偿。
        minify: true,
        // 开发模式构建带 sourcemap，便于在宿主中定位远程组件源码
        sourcemap: !isProd,
      },
      // 本地开发时宿主（:3000/:3001）跨端口 import remoteEntry.js，需要开启 CORS
      preview: {
        cors: true,
        port: 3200,
        strictPort: true,
      },
    },
  };
}, 'application');
