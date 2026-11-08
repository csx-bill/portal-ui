<script lang="ts" setup>
import type { SystemDictItem } from '#/api/system/dict';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { createDictItem, updateDictItem } from '#/api/system/dict';

import { useItemFormSchema } from '../data';

/**
 * 字典项新增/编辑抽屉。
 * 新增时抽屉数据为 { dictId }（所属字典）；编辑时为行数据。
 * 后端 PUT /system/dict/item 从请求体读取 id。
 */
const emit = defineEmits<{
  success: [];
}>();

const formData = ref<SystemDictItem>();
const dictId = ref<SystemDictItem['dictId']>();

const [Form, formApi] = useVbenForm({
  schema: useItemFormSchema(
    () => dictId.value,
    () => formData.value,
  ),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<
  null | SystemDictItem | { dictId: SystemDictItem['dictId'] }
>({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData();
      formApi.reset();
      if (data && 'id' in data) {
        formData.value = data;
        dictId.value = data.dictId;
      } else {
        formData.value = undefined;
        dictId.value = (data as { dictId?: SystemDictItem['dictId'] })?.dictId;
      }
      await nextTick();
      if (formData.value) {
        formApi.setValues(formData.value);
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
        ? updateDictItem({ ...values, id: formData.value.id })
        : createDictItem({ ...values, dictId: dictId.value }));
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  }
}

const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('systemCommon.system.dict.item')])
    : $t('ui.actionTitle.create', [$t('systemCommon.system.dict.item')]),
);
</script>
<template>
  <Drawer class="w-full max-w-100" :title="getDrawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
