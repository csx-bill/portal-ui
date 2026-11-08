<script lang="ts" setup>
import type { CorpTagApi, CustomerApi } from '#/api';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { CheckboxGroup, message, Spin } from 'antdv-next';

import { getTagGroupList, markCustomerTag } from '#/api';
import { $t } from '#/locales';

import { customerTagIds } from '../data';

/**
 * 客户标签编辑抽屉：按企业标签库（标签组 → 标签）勾选，
 * 打开时按 extra_data 快照回显当前标签，确认时计算
 * 新增/移除差量调企微 externalcontact/mark_tag（92697），
 * 成功后后端会刷新该客户的本地快照。
 */
const emits = defineEmits(['success']);

const row = ref<CustomerApi.WxCustomer>();
const groups = ref<CorpTagApi.WxCorpTagGroup[]>([]);
const loading = ref(false);
/** 勾选的标签ID集合（跨标签组共享一份） */
const selectedTagIds = ref<string[]>([]);

const corpId = computed(() => row.value?.corpId ?? '');

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    if (!row.value) return;
    const original = new Set(customerTagIds(row.value));
    const add = selectedTagIds.value.filter((id) => !original.has(id));
    const remove = [...original].filter(
      (id) => !selectedTagIds.value.includes(id),
    );
    if (add.length === 0 && remove.length === 0) {
      drawerApi.close();
      return;
    }
    drawerApi.lock();
    markCustomerTag({
      addTag: add,
      corpId: corpId.value,
      externalUserId: row.value.externalUserId ?? '',
      removeTag: remove,
      userId: row.value.userId ?? '',
    })
      .then(() => {
        message.success($t('customer.tagEditSuccess'));
        emits('success');
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;
    row.value = drawerApi.getData() as CustomerApi.WxCustomer;
    // 按快照回显当前标签
    selectedTagIds.value = customerTagIds(
      row.value ?? ({} as CustomerApi.WxCustomer),
    );
    await loadGroups();
  },
});

defineExpose({ drawerApi });

const drawerTitle = computed(() =>
  row.value?.name
    ? `${$t('customer.tagEdit')}：${row.value.name}`
    : $t('customer.tagEdit'),
);

async function loadGroups() {
  if (!corpId.value) return;
  loading.value = true;
  try {
    groups.value = (await getTagGroupList({ corpId: corpId.value })) ?? [];
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <Drawer :title="drawerTitle" class="w-[480px]">
    <Spin :spinning="loading" :classes="{ root: 'w-full' }">
      <div class="flex flex-col gap-3">
        <div
          v-for="group in groups"
          :key="group.id"
          class="flex flex-col gap-1"
        >
          <div class="text-xs font-medium text-muted-foreground">
            {{ group.groupName }}
          </div>
          <CheckboxGroup
            v-model:value="selectedTagIds"
            class="flex flex-col gap-1 pl-2"
            :options="
              (group.tagList ?? []).map((tag) => ({
                label: tag.tagName ?? '',
                value: tag.tagId ?? '',
              }))
            "
          />
        </div>
        <div
          v-if="!loading && groups.length === 0"
          class="py-6 text-center text-sm text-muted-foreground"
        >
          {{ $t('customer.tagEmpty') }}
        </div>
      </div>
    </Spin>
  </Drawer>
</template>
