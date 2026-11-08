<script lang="ts" setup>
import type { SystemOauthClient } from '#/api/system/client';

import { computed, ref } from 'vue';

import { useVbenDrawer, useVbenForm } from '@vben/common-ui';
import { $t } from '@vben/locales';

import {
  createOauthClient,
  getOauthClientById,
  updateOauthClient,
} from '#/api/system/client';

import { useFormSchema } from '../data';

/**
 * OAuth2 客户端（终端）新增/编辑抽屉。
 * 字段与后端 SysOauthClientCreateReq / SysOauthClientUpdateReq 对齐，
 * 更新时 id 放在请求体（后端 PUT 从 body 读取）。
 */
const emits = defineEmits(['success']);

const clientId = ref<SystemOauthClient['id']>();

/** 后端 allowGrantTypes 为逗号分隔串 → 表单多选下拉需要数组 */
function toGrantTypeArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
}

/** 表单多选数组 → 后端逗号分隔串 */
function toGrantTypeString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.join(',');
  return typeof value === 'string' ? value : undefined;
}

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<null | SystemOauthClient>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    const payload = {
      ...values,
      allowGrantTypes: toGrantTypeString(values.allowGrantTypes),
    };
    drawerApi.lock();
    (clientId.value
      ? updateOauthClient({ ...payload, id: clientId.value })
      : createOauthClient(payload)
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
      clientId.value = data.id;
      // 分页行数据虽已含全部字段，仍以详情接口为准，避免编辑到过期数据
      const detail = await getOauthClientById(data.id).catch(() => data);
      formApi.setValues({
        ...data,
        ...detail,
        allowGrantTypes: toGrantTypeArray(
          detail?.allowGrantTypes ?? data.allowGrantTypes,
        ),
      });
    } else {
      clientId.value = undefined;
    }
  },
});

defineExpose({ drawerApi });

const getDrawerTitle = computed(() =>
  clientId.value
    ? $t('ui.actionTitle.edit', [$t('systemCommon.system.client.name')])
    : $t('ui.actionTitle.create', [$t('systemCommon.system.client.name')]),
);
</script>
<template>
  <Drawer class="w-full max-w-125" :title="getDrawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
