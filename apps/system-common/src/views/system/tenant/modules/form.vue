<script lang="ts" setup>
import type { TenantRecord } from '#/api/system/tenant';

import { computed, ref } from 'vue';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { createTenant, getTenantById, updateTenant } from '#/api/system/tenant';

import { useFormSchema } from '../data';

/**
 * 租户新增/编辑抽屉。
 * 字段与后端 SysTenantCreateReq / SysTenantUpdateReq 对齐，
 * 更新时 id 放在请求体（后端 PUT 从 body 读取）。
 */
const emits = defineEmits(['success']);

const tenantId = ref<TenantRecord['id']>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<null | TenantRecord>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    drawerApi.lock();
    (tenantId.value
      ? updateTenant({ ...values, id: tenantId.value })
      : createTenant(values)
    )
      .then(() => {
        emits('success');
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    formApi.reset();

    if (data?.id) {
      tenantId.value = data.id;
      // 分页行数据虽已含全部字段，仍以详情接口为准，避免编辑到过期数据
      const detail = await getTenantById(data.id).catch(() => data);
      formApi.setValues({ ...data, ...detail });
    } else {
      tenantId.value = undefined;
    }
  },
});

defineExpose({ drawerApi });

const getDrawerTitle = computed(() =>
  tenantId.value
    ? $t('ui.actionTitle.edit', [$t('systemCommon.system.tenant.name')])
    : $t('ui.actionTitle.create', [$t('systemCommon.system.tenant.name')]),
);
</script>
<template>
  <Drawer class="w-full max-w-125" :title="getDrawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
