<script lang="ts" setup>
import type { SystemFileGroup } from '#/api/system/file';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { createFileGroup, updateFileGroup } from '#/api/system/file';

import { useGroupFormSchema } from '../data';

/**
 * 文件分组新增/编辑抽屉。
 * 后端 PUT /system/file/group 从请求体读取 id。
 */
const emit = defineEmits<{
  success: [];
}>();

const formData = ref<SystemFileGroup>();

const [Form, formApi] = useVbenForm({
  schema: useGroupFormSchema(() => formData.value),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<null | SystemFileGroup>({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData();
      formApi.reset();
      formData.value = data ?? undefined;
      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
    }
  },
});

defineExpose({ drawerApi });

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (valid) {
    drawerApi.lock();
    const values = await formApi.getValues();
    try {
      await (formData.value?.id
        ? updateFileGroup({ ...values, id: formData.value.id })
        : createFileGroup(values));
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  }
}

const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('systemCommon.system.file.group')])
    : $t('ui.actionTitle.create', [$t('systemCommon.system.file.group')]),
);
</script>
<template>
  <Drawer class="w-full max-w-100" :title="getDrawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
