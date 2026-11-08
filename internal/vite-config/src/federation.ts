import { readFileSync } from 'node:fs';

/**
 * 模块联邦 shared 名单的单一事实来源：system-common 的 package.json。
 *
 * 宿主（web-portal）与 remote（system-common）都通过
 * deriveFederationSharedDeps() 派生 shared 配置：
 * - remote 传入自己的 package.json；
 * - 宿主传入 remote 的 package.json（../system-common/package.json），
 *   保证宿主提供的集合恰好等于 remote 消费的集合，两侧永远一致，
 *   新增依赖无需在多处维护清单。
 *
 * shared 只声明 singleton、不声明 requiredVersion：
 * 依赖版本由 pnpm workspace 统一管控（workspace:* / catalog:），
 * 不存在版本漂移；version 仅作为 shareScope 的注册键。
 *
 * 注意：必须显式提供 version —— 联邦插件会尝试 resolve
 * `包名/package.json` 读取版本，vben workspace 包的 exports 未暴露
 * 该文件，Vite 8 会直接报错。
 */
const SHARED_VERSION = '1.0.0';

/**
 * 不参与联邦 shared 的依赖：
 * - dayjs：无全局状态冲突，由 remote 自带（tree-shake 后只含用到的格式化逻辑）
 *
 * 注意：antdv-next 必须参与 shared。远端若自带一份 antd，其组件不在宿主的
 * ConfigProvider 上下文内（不同模块实例，provide/inject 不互通），
 * 会按 antd 默认浅色渲染——暗色主题下表现为输入框白底等问题。
 * 共享后远端组件即宿主实例，主题（含暗色算法与设计 token）由宿主统一下发。
 * dev 模式下宿主须把 antdv-next 加入 optimizeDeps.exclude，
 * 否则预打包产物会与之形成双实例（同 pinia/vue/vue-router，见宿主 vite.config.ts）。
 */
const NOT_SHARED = new Set(['dayjs']);

/**
 * shared 名单与 import 说明符必须精确匹配（联邦插件按字符串相等判定）。
 * package.json 里声明的是包根名（@vben/plugins），而远程源码实际
 * import 的是其子路径（@vben/plugins/vxe-table），需要做一次映射，
 * 否则远程组件运行时取不到宿主注册的 vxe-table 适配器实例。
 */
const SHARED_PATH_OVERRIDES: Record<string, string> = {
  '@vben/plugins': '@vben/plugins/vxe-table',
};

function deriveFederationSharedDeps(
  packageJsonPath: string,
): Record<string, { singleton: boolean; version: string }> {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  return Object.fromEntries(
    Object.keys(pkg.dependencies ?? {})
      .filter((name) => !NOT_SHARED.has(name))
      .map((name) => [
        SHARED_PATH_OVERRIDES[name] ?? name,
        { singleton: true, version: SHARED_VERSION },
      ]),
  );
}

export { deriveFederationSharedDeps };
