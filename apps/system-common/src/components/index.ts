import MediaPickerModal from './media-picker/index.vue';
import { useTenantStore } from './tenant/tenant-store';
/**
 * 公共组件与共享状态（模块联邦 expose 入口：./components）。
 *
 * 宿主按需引入，例如：
 * - 租户切换弹窗：defineAsyncComponent(() =>
 *     import('system_common/components').then((m) => m.TenantSwitchModal))
 * - 租户 store：需要编程式访问租户状态时引入 useTenantStore
 */
import TenantSwitchModal from './tenant/tenant-switch-modal.vue';

export { MediaPickerModal, TenantSwitchModal, useTenantStore };

// default 导出（命名空间对象）：规避联邦宿主端 wrapDefault 对
// 「无 default 的命名导出模块」的包装问题（与 pages.ts 的处理一致），
// 否则宿主侧解构不到命名导出
export default { MediaPickerModal, TenantSwitchModal, useTenantStore };
