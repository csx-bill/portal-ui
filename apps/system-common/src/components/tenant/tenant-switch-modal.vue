<script lang="ts" setup>
import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { Tag } from 'antdv-next';

import { useTenantStore } from './tenant-store';

/**
 * 租户切换弹窗（经模块联邦 expose：system_common/components）。
 * 宿主通过 useVbenModal({ connectedComponent }) 连接本组件，
 * 租户数据与状态由共享的 useTenantStore 提供。
 */
defineOptions({ name: 'TenantSwitchModal' });

const tenantStore = useTenantStore();

// title 需要跟随语言切换刷新：options 里的 title 只在组件创建时求值一次
// （作为 DialogTitle 的渲染条件保留），实际文案用 #title 插槽响应式渲染
const [Modal] = useVbenModal({
  title: $t('systemCommon.components.tenant.switchTitle'),
  showCancelButton: false,
  showConfirmButton: false,
  onOpenChange(isOpen) {
    if (isOpen) {
      tenantStore.fetchTenantList();
    }
  },
});

function handleSwitch(tenantId: number | string) {
  if (String(tenantId) !== String(tenantStore.currentTenantId)) {
    tenantStore.switchTenant(tenantId);
  }
}
</script>

<template>
  <Modal>
    <template #title>
      {{ $t('systemCommon.components.tenant.switchTitle') }}
    </template>
    <div class="flex flex-col gap-1">
      <div
        v-for="tenant in tenantStore.tenantList"
        :key="tenant.id"
        class="flex cursor-pointer items-center justify-between rounded-md px-3 py-2.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        :class="{
          'bg-gray-50 dark:bg-gray-800/50':
            String(tenant.id) === String(tenantStore.currentTenantId),
        }"
        @click="handleSwitch(tenant.id)"
      >
        <div class="flex flex-col">
          <span class="font-medium">{{ tenant.name }}</span>
          <span class="text-xs text-gray-500">{{ tenant.code || '-' }}</span>
        </div>
        <Tag
          v-if="String(tenant.id) === String(tenantStore.currentTenantId)"
          color="success"
        >
          {{ $t('systemCommon.components.tenant.current') }}
        </Tag>
      </div>
    </div>
  </Modal>
</template>
