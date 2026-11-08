<script lang="ts" setup>
import type { SystemDict } from '#/api/system/dict';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { createDict, updateDict } from '#/api/system/dict';

import { useTypeFormSchema } from '../data';

/**
 * 字典类型新增/编辑抽屉。
 * 后端 PUT /system/dict 从请求体读取 id。
 */
const emit = defineEmits<{
  success: [];
}>();

const formData = ref<SystemDict>();

const [Form, formApi] = useVbenForm({
  schema: useTypeFormSchema(() => formData.value),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<null | SystemDict>({
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
        ? updateDict({ ...values, id: formData.value.id })
        : createDict(values));
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  }
}

const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('systemCommon.system.dict.name')])
    : $t('ui.actionTitle.create', [$t('systemCommon.system.dict.name')]),
);
</script>
<template>
  <Drawer class="w-full max-w-100" :title="getDrawerTitle">
    <Form class="mx-4" form-wrapper-class="grid-cols-1" />
  </Drawer>
</template>
