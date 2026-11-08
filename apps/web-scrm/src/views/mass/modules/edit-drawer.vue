<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { $t } from '#/locales';

import DetailPanel from './detail-panel.vue';

/**
 * 任务编辑抽屉：复用详情编辑表单（DetailPanel），
 * 新建/编辑共用；保存成功后关闭并通知宿主刷新列表。
 * 详情面板内的"调用记录"入口隐藏（列表行上已有该操作）。
 */
const emit = defineEmits<{ invokeLog: []; saved: [] }>();

const drawerProps = ref<{
  corpId?: string;
  defaultCorpId?: string;
  isNew?: boolean;
  msgId?: number | string;
}>({});

const [EditDrawer, editDrawerApi] = useVbenDrawer({
  footer: false,
  onOpenChange(isOpen) {
    if (!isOpen) return;
    drawerProps.value = (editDrawerApi.getData() ??
      {}) as typeof drawerProps.value;
  },
});

function onSaved() {
  editDrawerApi.close();
  emit('saved');
}

function onInvokeLog() {
  editDrawerApi.close();
  emit('invokeLog');
}
</script>
<template>
  <EditDrawer
    class="w-full max-w-220"
    :title="drawerProps.isNew ? $t('mass.create') : $t('mass.edit')"
  >
    <div class="h-[calc(100vh-11rem)] overflow-hidden">
      <DetailPanel
        :default-corp-id="drawerProps.defaultCorpId"
        :hide-invoke-log="true"
        :is-new="drawerProps.isNew"
        :msg-id="drawerProps.msgId"
        @invoke-log="onInvokeLog"
        @saved="onSaved"
      />
    </div>
  </EditDrawer>
</template>
