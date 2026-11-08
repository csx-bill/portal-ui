<script lang="ts" setup>
import type { SystemUser } from '#/api/system/user';

import { computed, reactive, ref } from 'vue';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { createUser, getUserById, updateUser } from '#/api/system/user';

import { useFormSchema } from '../data';

/**
 * 用户新增/编辑抽屉：账号信息 + 所属部门（下拉树多选）。
 * 密码新增必填（schema 规则随模式切换），编辑留空则不修改（后端跳过）。
 */
const emits = defineEmits(['success']);

const formData = ref<SystemUser>();

// options 必须是 reactive，useVbenForm 才会监听 schema 变化：
// 打开抽屉时按新增/编辑模式重建 schema，密码字段的必填规则随之切换
const [Form, formApi] = useVbenForm(
  reactive({
    schema: computed(() => useFormSchema(() => formData.value)),
    showDefaultActions: false,
  }),
);

const id = ref<SystemUser['id']>();
const [Drawer, drawerApi] = useVbenDrawer<null | SystemUser>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    // treeCheckStrictly 下 TreeSelect 值为 {value,label,halfChecked} 对象，
    // 提交前归一化为 ID 数组（后端只收 Long 列表）
    if (Array.isArray(values.deptIds)) {
      values.deptIds = values.deptIds.map((item: any) =>
        item && typeof item === 'object' ? item.value : item,
      );
    }
    drawerApi.lock();
    (id.value ? updateUser({ ...values, id: id.value }) : createUser(values))
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
      formData.value = data;
      id.value = data.id;
    } else {
      formData.value = undefined;
      id.value = undefined;
    }

    if (data) {
      // 分页列表的行数据已含 deptIds（后端分页接口回填）；
      // 若缺失（如旧缓存）则拉详情补全
      let detail = data;
      if (!Array.isArray(detail.deptIds)) {
        detail = { ...data, ...(await getUserById(data.id)) };
      }
      formData.value = detail;
      formApi.setValues({
        ...detail,
        // 严格勾选模式下 TreeSelect 回显需要 {value} 对象形态
        deptIds: Array.isArray(detail.deptIds)
          ? detail.deptIds.map((deptId) => ({ value: deptId }))
          : detail.deptIds,
      });
    }
  },
});

defineExpose({ drawerApi });

const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('systemCommon.system.user.user')])
    : $t('systemCommon.system.user.createTitle'),
);
</script>
<template>
  <Drawer :title="getDrawerTitle">
    <Form />
  </Drawer>
</template>
