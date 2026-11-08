import { resolve } from 'node:path';
import process from 'node:process';

import { defineConfig, deriveFederationSharedDeps } from '@vben/vite-config';

import federation from '@originjs/vite-plugin-federation';
import { loadEnv } from 'vite';

/**
 * web-xxx（Host）构建配置
 *
 * - 通过 VITE_SYSTEM_COMMON_REMOTE_URL 指向 system-common 的 remoteEntry.js
 *   （开发环境 :3200，生产环境同域 /system-common/remoteEntry.js）
 * - 联邦 shared 名单派生自 system-common 的 package.json（单一事实来源），
 *   宿主提供的集合恰好等于 remote 消费的集合，remote 增改依赖自动同步
 */
const sharedDeps = deriveFederationSharedDeps(
  resolve(process.cwd(), '../system-common/package.json'),
);

// dev 模式下这些 npm 包默认会被 vite 预打包进 .vite/deps，而模块联邦
// shared 提供的是源码 ESM 路径，会形成两个模块实例（provide/inject、
// i18n 全部失效）。必须排除预打包，让宿主与远程组件使用同一实例。
// antdv-next 同理：远端组件必须落在宿主的 ConfigProvider 上下文内，
// 主题（暗色算法/设计 token）才会由宿主统一下发。
const singleInstanceDeps = ['antdv-next', 'pinia', 'vue', 'vue-router'];

// antdv-next 被排除预打包后，其依赖（如 @v-c/picker）会以源码形式直供，
// 而它们 import 的 dayjs 插件是 CJS 文件——以往由 esbuild 预打包完成
// CJS→ESM interop，现在需要显式把这些插件声明为预构建入口，
// 否则浏览器侧会报 "does not provide an export named 'default'"。
const preBundledDeps = [
  'dayjs/plugin/advancedFormat',
  'dayjs/plugin/customParseFormat',
  'dayjs/plugin/localeData',
  'dayjs/plugin/weekOfYear',
  'dayjs/plugin/weekYear',
  'dayjs/plugin/weekday',
];

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const remoteUrl = env.VITE_SYSTEM_COMMON_REMOTE_URL;

  return {
    application: {
      // vxe-table 懒加载改写子路径导入，会破坏模块联邦 shared 的模块标识，
      // 宿主与 remote 都必须关闭（remote 侧见 apps/system-common/vite.config.ts）
      vxeTableLazyImport: false,
    },
    vite: {
      plugins: [
        federation({
          name: 'web-scrm',
          remotes: {
            system_common: remoteUrl ?? 'http://localhost:3200/remoteEntry.js',
          },
          shared: sharedDeps,
        }),
      ],
      optimizeDeps: {
        exclude: singleInstanceDeps,
        include: preBundledDeps,
      },
      server: {
        proxy: {
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // 代理目标地址
            target: 'http://localhost:8080',
            ws: true,
          },
          // 上传接口下发的文件地址形如 /{bucket}/{clientId}/{dir}/{fileName}
          // （桶名默认 local，见后端 FileProperties.bucketName）。
          // 本地开发没有 nginx，该前缀由应用直接服务（LocalFileResourceConfig）；
          // 生产环境这个前缀会被 nginx 截走，不会进到应用。
          '/local': {
            changeOrigin: true,
            target: 'http://localhost:8080',
          },
        },
      },
    },
  };
});
