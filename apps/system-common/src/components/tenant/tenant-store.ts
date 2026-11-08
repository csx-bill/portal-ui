import type { TenantRecord } from '#/api/system/tenant';

import { ref } from 'vue';

import { defineStore } from 'pinia';

import { getTenantListApi } from '#/api/system/tenant';
import { TENANT_STORAGE_KEY } from '#/shared/tenant-contract';

/**
 * 租户 store（模块联邦共享单例）。
 * 宿主通过 system_common/components 引入本 store 与切换弹窗，
 * 不再各自维护一份实现；pinia 实例由宿主提供。
 * localStorage 持久化键与宿主请求层的契约见 @vben/constants。
 */
export const useTenantStore = defineStore('tenant', () => {
  // 启动时同步恢复上次租户 ID，确保首次 API 请求立即携带租户头
  const currentTenantId = ref<null | number | string>(
    localStorage.getItem(TENANT_STORAGE_KEY),
  );
  const tenantList = ref<TenantRecord[]>([]);
  const loaded = ref(false);

  /**
   * 加载可用租户列表。
   * 如果 localStorage 中的租户仍在列表中则沿用，否则选第一个。
   * 解析出的实际生效租户会回写 localStorage（宿主请求层按该键
   * 发送 X-Tenant-Id，两处必须保持一致）。
   */
  async function fetchTenantList() {
    try {
      tenantList.value = await getTenantListApi();
      if (tenantList.value.length === 0) return;

      const lastId = currentTenantId.value;
      const exists = lastId
        ? tenantList.value.some((t) => String(t.id) === String(lastId))
        : false;

      if (!exists) {
        const firstTenant = tenantList.value[0];
        if (firstTenant) {
          currentTenantId.value = firstTenant.id;
        }
      }
      if (currentTenantId.value) {
        localStorage.setItem(TENANT_STORAGE_KEY, String(currentTenantId.value));
      }
      loaded.value = true;
    } catch {
      // 忽略错误
    }
  }

  /**
   * 切换租户：保存到 localStorage 并刷新页面
   */
  function switchTenant(tenantId: number | string) {
    localStorage.setItem(TENANT_STORAGE_KEY, String(tenantId));
    window.location.reload();
  }

  function $reset() {
    localStorage.removeItem(TENANT_STORAGE_KEY);
    currentTenantId.value = null;
    tenantList.value = [];
    loaded.value = false;
  }

  return {
    currentTenantId,
    fetchTenantList,
    loaded,
    switchTenant,
    tenantList,
    $reset,
  };
});
