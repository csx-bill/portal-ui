<script lang="ts" setup>
import type { SystemDept } from '#/api/system/dept';

import { computed, ref } from 'vue';

import { useVbenDrawer, useVbenForm, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { createDept, getDeptTree, updateDept } from '#/api/system/dept';

/**
 * 部门新增/编辑抽屉（左侧部门树的维护入口）。
 * 打开时携带 { dept, parentId }：
 * - 新增根部门：dept=null, parentId=undefined
 * - 新增子部门：dept=null, parentId=选中节点 ID
 * - 编辑：dept=行数据
 */
const emits = defineEmits(['success']);

const dept = ref<null | SystemDept>(null);

const [Form, formApi] = useVbenForm({
  schema: [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('systemCommon.system.dept.name'),
      rules: z
        .string()
        .min(
          2,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.dept.name'),
            2,
          ]),
        )
        .max(
          50,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.dept.name'),
            50,
          ]),
        ),
    },
    {
      component: 'ApiTreeSelect',
      componentProps: {
        allowClear: true,
        api: getDeptTree,
        childrenField: 'children',
        class: 'w-full',
        labelField: 'name',
        placeholder: $t('systemCommon.system.dept.parentPlaceholder'),
        treeDefaultExpandAll: true,
        valueField: 'id',
      },
      fieldName: 'parentId',
      label: $t('systemCommon.system.dept.parent'),
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', max: 9999, min: 0 },
      defaultValue: 0,
      fieldName: 'sortOrder',
      label: $t('systemCommon.system.dept.sortOrder'),
    },
  ],
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<{
  dept: null | SystemDept;
  parentId?: SystemDept['id'];
}>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    drawerApi.lock();
    const saving = dept.value?.id
      ? updateDept({ ...values, id: dept.value.id })
      : createDept(values);
    saving
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
    dept.value = data?.dept ?? null;
    formApi.reset();
    if (dept.value) {
      formApi.setValues(dept.value);
    } else {
      formApi.setValues({ parentId: data?.parentId, sortOrder: 0 });
    }
  },
});

defineExpose({ drawerApi });

const getDrawerTitle = computed(() =>
  dept.value?.id
    ? $t('systemCommon.system.dept.editTitle')
    : $t('systemCommon.system.dept.createTitle'),
);
</script>
<template>
  <Drawer :title="getDrawerTitle">
    <Form />
  </Drawer>
</template>
