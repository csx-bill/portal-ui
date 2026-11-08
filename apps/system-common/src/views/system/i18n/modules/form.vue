<script lang="ts" setup>
import type { SystemI18n } from '#/api/system/i18n';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { createI18n, updateI18n } from '#/api/system/i18n';

import { useFormSchema } from '../data';

/**
 * 国际化词条新增/编辑抽屉。
 * 后端 PUT /system/i18n 从请求体读取 id，表单值本身不含 id，
 * 提交时用抽屉数据里的 id 补上。
 */
const emit = defineEmits<{
  success: [];
}>();

const formData = ref<SystemI18n>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<null | SystemI18n>({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData();
      formApi.reset();
      formData.value = data ?? undefined;
      // 等待表单字段挂载后再回填
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
        ? updateI18n({ ...values, id: formData.value.id })
        : createI18n(values));
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  }
}

const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('systemCommon.system.i18n.name')])
    : $t('ui.actionTitle.create', [$t('systemCommon.system.i18n.name')]),
);
</script>
<template>
  <Drawer class="w-full max-w-100" :title="getDrawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
