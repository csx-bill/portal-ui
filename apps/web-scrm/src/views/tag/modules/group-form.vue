<script lang="ts" setup>
import type { CorpApi, CorpTagApi } from '#/api';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, Input, InputNumber, message, Select } from 'antdv-next';

import { createTagGroup, getCorpList, updateTagGroup } from '#/api';
import { $t } from '#/locales';

/**
 * 标签组新增/编辑抽屉（后端 POST/PUT /scrm/tag，均同步企微接口）。
 *
 * 新增：选授权企业 + 组名 + 初始标签（企微要求至少一个标签）；
 * 编辑：组名/排序 + 组下标签整组提交，服务端做差量
 * （列表中移除的标签被同步删除，清空全部标签会级联删除标签组）。
 */
const emits = defineEmits(['success']);

const corps = ref<CorpApi.WxCorpAuth[]>([]);
const isEdit = ref(false);
const saving = ref(false);

/** 编辑目标（含 id/groupId/corpId） */
const editGroup = ref<CorpTagApi.WxCorpTagGroup>();

const corpId = ref<string>();
const groupName = ref('');
const order = ref<number>();

interface TagRow {
  id?: number | string;
  tagId?: string;
  tagName: string;
}
const tags = ref<TagRow[]>([]);
const newTagName = ref('');

const corpOptions = computed(() =>
  corps.value
    .filter((corp) => corp.authStatus === 1)
    .map((corp) => ({
      label: corp.corpName || corp.corpId,
      value: corp.corpId,
    })),
);

function onAddTag() {
  const name = newTagName.value.trim();
  if (!name) return;
  if (tags.value.some((tag) => tag.tagName === name)) {
    message.warning($t('tag.tagNameDuplicate'));
    return;
  }
  tags.value.push({ tagName: name });
  newTagName.value = '';
}

function onRemoveTag(index: number) {
  tags.value.splice(index, 1);
}

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    if (!isEdit.value && !corpId.value) {
      message.warning($t('tag.corpRequired'));
      return;
    }
    if (!groupName.value.trim()) {
      message.warning($t('tag.groupNameRequired'));
      return;
    }
    if (tags.value.length === 0) {
      message.warning($t('tag.tagRequired'));
      return;
    }
    drawerApi.lock();
    saving.value = true;
    try {
      await (isEdit.value && editGroup.value
        ? updateTagGroup({
            corpId: editGroup.value.corpId ?? '',
            groupId: editGroup.value.groupId,
            groupName: groupName.value.trim(),
            id: editGroup.value.id,
            order: order.value,
            tagList: tags.value.map((tag) => ({
              id: tag.id,
              tagId: tag.tagId,
              tagName: tag.tagName.trim(),
            })),
          })
        : createTagGroup({
            corpId: corpId.value ?? '',
            groupName: groupName.value.trim(),
            order: order.value,
            tagList: tags.value.map((tag) => ({
              tagName: tag.tagName.trim(),
            })),
          }));
      message.success($t('tag.saveSuccess'));
      emits('success');
      drawerApi.close();
    } finally {
      saving.value = false;
      drawerApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData() as
      | undefined
      | { corpId?: string; group?: CorpTagApi.WxCorpTagGroup };
    isEdit.value = !!data?.group;
    editGroup.value = data?.group;
    // 编辑取组的企业；新建可由宿主预选（当前筛选企业）
    corpId.value = data?.group?.corpId ?? data?.corpId;
    groupName.value = data?.group?.groupName ?? '';
    order.value = data?.group?.order;
    tags.value = (data?.group?.tagList ?? []).map((tag) => ({
      id: tag.id,
      tagId: tag.tagId,
      tagName: tag.tagName ?? '',
    }));
    newTagName.value = '';
    if (!isEdit.value && corps.value.length === 0) {
      getCorpList().then((list) => (corps.value = list));
    }
  },
});

defineExpose({ drawerApi });

const getDrawerTitle = computed(() =>
  isEdit.value ? $t('tag.edit') : $t('tag.create'),
);
</script>
<template>
  <Drawer class="w-full max-w-100" :title="getDrawerTitle">
    <div class="mx-2 flex flex-col gap-4">
      <!-- 企业（仅新增时可选） -->
      <div v-if="!isEdit" class="flex items-center gap-3">
        <span class="w-20 shrink-0 text-sm text-muted-foreground">
          <span class="text-red-500">*</span>
          {{ $t('tag.corp') }}
        </span>
        <Select
          v-model:value="corpId"
          class="flex-1"
          :options="corpOptions"
          :placeholder="$t('tag.corpPlaceholder')"
          show-search
          option-filter-prop="label"
        />
      </div>
      <!-- 组名 -->
      <div class="flex items-center gap-3">
        <span class="w-20 shrink-0 text-sm text-muted-foreground">
          <span class="text-red-500">*</span>
          {{ $t('tag.groupName') }}
        </span>
        <Input
          v-model:value="groupName"
          class="flex-1"
          :maxlength="30"
          :placeholder="$t('tag.groupNamePlaceholder')"
        />
      </div>
      <!-- 排序值 -->
      <div class="flex items-center gap-3">
        <span class="w-20 shrink-0 text-sm text-muted-foreground">
          {{ $t('tag.order') }}
        </span>
        <InputNumber
          v-model:value="order"
          class="flex-1"
          :placeholder="$t('tag.orderPlaceholder')"
        />
      </div>
      <!-- 组下标签 -->
      <div class="flex flex-col gap-2">
        <span class="text-sm text-muted-foreground">
          <span class="text-red-500">*</span>
          {{ $t('tag.tagList') }}
        </span>
        <div
          v-for="(tag, index) in tags"
          :key="tag.id ?? tag.tagName"
          class="flex items-center gap-2"
        >
          <Input v-model:value="tag.tagName" class="flex-1" :maxlength="30" />
          <Button danger type="text" @click="onRemoveTag(index)">✕</Button>
        </div>
        <div class="flex items-center gap-2">
          <Input
            v-model:value="newTagName"
            class="flex-1"
            :maxlength="30"
            :placeholder="$t('tag.addTagPlaceholder')"
            @press-enter="onAddTag"
          />
          <Button @click="onAddTag">{{ $t('tag.addTag') }}</Button>
        </div>
        <div v-if="isEdit" class="text-xs text-muted-foreground">
          {{ $t('tag.editTip') }}
        </div>
      </div>
    </div>
  </Drawer>
</template>
