import enUS from './en-US';
import zhCN from './zh-CN';

/**
 * 语言包唯一来源在 system-common（见架构设计方案 7.1），
 * 宿主不感知具体内容，只在 loadMessages 钩子中获取数据源。
 */
const locales: Record<string, Record<string, any>> = {
  'en-US': enUS,
  'zh-CN': zhCN,
};

/**
 * 获取指定语言的远程文案（命名空间为 systemCommon）。
 *
 * 这是宿主 loadMessages 钩子的数据源（vben 官方"远程加载语言包"
 * 的扩展点）：初始装载与每次语言切换都会重新获取——vue-i18n 在
 * 语言切换时会整体替换目标语言的 messages，因此必须重新合并，
 * 否则切换后远程页面文案会丢失。
 */
export function getSystemCommonLocaleMessages(locale: string) {
  return locales[locale] ?? {};
}

/**
 * default 导出（命名空间对象）：
 * 模块联邦的宿主端运行时对「无 default 的命名导出模块」会做
 * wrapDefault 包装（named 函数被收进 .default 内层），宿主侧解构
 * 不到 named 函数。这里同时提供 default 导出与命名导出，
 * 两种宿主端形态都能正常消费。
 */
export default {
  getSystemCommonLocaleMessages,
};
