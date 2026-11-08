<script lang="ts" setup>
import type { SystemRole } from '#/api/system/role';

import { computed, ref } from 'vue';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { createRole, getRoleById, updateRole } from '#/api/system/role';

import { useFormSchema } from '../data';

/**
 * 角色新增/编辑抽屉：仅维护基础信息（名称/状态/备注/数据权限）。
 * 菜单权限已拆分到列表“授权”操作（modules/auth.vue）单独维护，
 * 因此编辑提交不携带 permissions，后端不会改动角色-菜单关联。
 */
const emits = defineEmits(['success']);

const formData = ref<SystemRole>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const id = ref<SystemRole['id']>();
const [Drawer, drawerApi] = useVbenDrawer<null | SystemRole>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    // 非自定义数据权限不改动自定义部门关联；自定义时组件值
    // （treeCheckStrictly 下为 {value,label,halfChecked} 对象）归一化为 ID 数组
    if (values.dataScope !== 2) {
      delete values.deptIds;
    } else if (Array.isArray(values.deptIds)) {
      values.deptIds = values.deptIds.map((item: any) =>
        item && typeof item === 'object' ? item.value : item,
      );
    }
    drawerApi.lock();
    (id.value ? updateRole({ ...values, id: id.value }) : createRole(values))
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

    if (data) {
      // 编辑始终拉详情，不依赖分页行数据（permissions/deptIds 仅详情接口保证回填）
      const detail = await getRoleById(data.id);
      formData.value = detail;
      id.value = detail.id;
      // 严格勾选模式下下拉树回显需要 {value} 对象形态
      formApi.setValues({
        ...detail,
        deptIds: Array.isArray(detail.deptIds)
          ? detail.deptIds.map((deptId) => ({ value: deptId }))
          : detail.deptIds,
      });
    } else {
      formData.value = undefined;
      id.value = undefined;
    }
  },
});

defineExpose({ drawerApi });

const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('systemCommon.system.role.name')])
    : $t('ui.actionTitle.create', [$t('systemCommon.system.role.name')]),
);
</script>
<template>
  <Drawer :title="getDrawerTitle">
    <Form />
  </Drawer>
</template>
