<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { $t } from '#/locales';

import DetailPanel from './detail-panel.vue';

/**
 * 欢迎语编辑抽屉：复用详情编辑表单（DetailPanel），
 * 新建/编辑共用；保存成功后关闭并通知宿主刷新列表。
 */
const emit = defineEmits<{ saved: [] }>();

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
</script>
<template>
  <EditDrawer
    class="w-full max-w-220"
    :title="drawerProps.isNew ? $t('welcome.create') : $t('welcome.edit')"
  >
    <div class="h-[calc(100vh-11rem)] overflow-hidden">
      <DetailPanel
        :default-corp-id="drawerProps.defaultCorpId"
        :is-new="drawerProps.isNew"
        :msg-id="drawerProps.msgId"
        @saved="onSaved"
      />
    </div>
  </EditDrawer>
</template>
