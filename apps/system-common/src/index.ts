export { getSystemCommonLocaleMessages } from './locales';
/**
 * system-common 汇总入口（构建入口；模块联邦不 expose 本文件）。
 *
 * 本包不创建任何实例（见架构设计方案 5.1）：
 * 组件由宿主渲染、i18n/pinia/preferences 由宿主提供。
 */
export { getRequestClient, setRequestClient } from './shared/request-context';
