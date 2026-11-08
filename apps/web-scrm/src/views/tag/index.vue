<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { CorpTagApi } from '#/api';

import { computed, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Dropdown,
  Empty,
  Input,
  Menu,
  MenuItem,
  message,
  Modal,
  Select,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  delTagGroup,
  getCorpList,
  getTagGroupList,
  triggerTagSync,
} from '#/api';
import { $t } from '#/locales';

import { useTagColumns } from './data';
import GroupForm from './modules/group-form.vue';

/**
 * 客户标签页面（后端 WxCorpTagController /scrm/tag/*）。
 *
 * 通讯录式主从布局：顶部企业筛选（默认第一个授权企业），
 * 左侧标签组列表（/groupList 按 corpId 过滤，含组下标签，点击切换，
 * 支持新建/编辑/删除标签组），右侧为所选标签组下的标签（客户端数据，
 * 不分页；标签的增删改在"编辑标签组"抽屉内整组提交，服务端做差量）。
 * "同步标签"按钮直接对当前筛选企业触发全量同步（/sync/trigger）。
 */
// ==================== 左侧：标签组 ====================
const groupList = ref<CorpTagApi.WxCorpTagGroup[]>([]);
const groupLoading = ref(false);
const groupKeyword = ref('');
const selectedGroup = ref<CorpTagApi.WxCorpTagGroup>();

// 企业筛选（默认第一个授权企业；标签组按企业归属）
const corpOptions = ref<{ label: string; value: string }[]>([]);
const corpFilter = ref<string>();

async function loadCorpOptions() {
  const corps = await getCorpList();
  // 仅已授权企业有标签数据
  corpOptions.value = corps
    .filter((corp) => corp.authStatus === 1)
    .map((corp) => ({
      label: corp.corpName || corp.corpId,
      value: corp.corpId,
    }));
}

function onCorpChange() {
  // 切换企业：标签组归属随之变化，清空已选
  selectedGroup.value = undefined;
  loadGroups();
}

const filteredGroups = computed(() => {
  const kw = groupKeyword.value.trim().toLowerCase();
  if (!kw) return groupList.value;
  return groupList.value.filter((g) => g.groupName?.toLowerCase().includes(kw));
});

async function loadGroups() {
  groupLoading.value = true;
  try {
    groupList.value =
      (await getTagGroupList({ corpId: corpFilter.value || undefined })) ?? [];
    // 同步后尽量保留原选中组；已被删除则清空并刷新右侧
    const keepSelected =
      selectedGroup.value &&
      groupList.value.some((g) => g.id === selectedGroup.value?.id);
    selectedGroup.value = keepSelected
      ? groupList.value.find((g) => g.id === selectedGroup.value?.id)
      : groupList.value[0];
    tagGridApi.query();
  } finally {
    groupLoading.value = false;
  }
}

function onSelectGroup(group: CorpTagApi.WxCorpTagGroup) {
  selectedGroup.value = group;
  tagGridApi.query();
}

// ==================== 同步标签（对当前筛选企业） ====================
const syncing = ref(false);

function onSync() {
  const corpId = corpFilter.value;
  if (!corpId) return;
  syncing.value = true;
  const hideLoading = message.loading({
    content: $t('tag.syncing'),
    duration: 0,
    key: 'tag_sync_msg',
  });
  triggerTagSync(corpId)
    .then(async () => {
      message.success({
        content: $t('tag.syncSuccess'),
        key: 'tag_sync_msg',
      });
      await loadGroups();
    })
    .catch(() => {
      hideLoading();
    })
    .finally(() => {
      syncing.value = false;
    });
}

// ==================== 标签组 新增/编辑/删除 ====================
const [GroupFormDrawer, groupFormDrawerApi] = useVbenDrawer({
  connectedComponent: GroupForm,
  destroyOnClose: true,
});

function onCreateGroup() {
  // 新建时预选当前筛选企业
  groupFormDrawerApi.setData({ corpId: corpFilter.value }).open();
}

function onEditGroup(group: CorpTagApi.WxCorpTagGroup) {
  groupFormDrawerApi.setData({ group }).open();
}

function onDeleteGroup(group: CorpTagApi.WxCorpTagGroup) {
  Modal.confirm({
    content: $t('tag.deleteRowConfirm', [group.groupName]),
    onOk: async () => {
      await delTagGroup(group.id);
      message.success($t('tag.deleteSuccess'));
      loadGroups();
    },
    title: $t('tag.delete'),
  });
}

// ==================== 右侧：标签表格 ====================
const [TagGrid, tagGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useTagColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        // 组下标签随 groupList 一次返回，直接使用客户端数据
        query: async () => selectedGroup.value?.tagList ?? [],
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
  } as VxeTableGridOptions<CorpTagApi.WxCorpTag>,
});

/** 初始化：先加载企业并默认选中第一个授权企业，再加载标签组 */
async function init() {
  await loadCorpOptions();
  const firstCorp = corpOptions.value[0];
  if (!corpFilter.value && firstCorp) {
    corpFilter.value = firstCorp.value;
  }
  await loadGroups();
}
init();
</script>
<template>
  <Page auto-content-height>
    <GroupFormDrawer @success="loadGroups" />
    <!-- 布局对齐统一规范:左侧面板卡片 + 右侧列表 -->
    <div class="flex h-full min-h-0 gap-2">
      <!-- 左侧:标签组列表 -->
      <div
        class="flex w-60 shrink-0 flex-col gap-2 rounded-md border bg-card p-2"
      >
        <Select
          v-model:value="corpFilter"
          :options="corpOptions"
          :placeholder="$t('tag.corpPlaceholder')"
          show-search
          option-filter-prop="label"
          @change="onCorpChange"
        />
        <Input
          v-model:value="groupKeyword"
          allow-clear
          :placeholder="$t('tag.groupSearch')"
        />
        <div class="flex items-center gap-1">
          <Button
            v-access:code="'tag:add'"
            size="small"
            style="flex: 1"
            type="primary"
            @click="onCreateGroup"
          >
            {{ $t('tag.create') }}
          </Button>
          <Button
            v-access:code="'tag:sync'"
            :disabled="!corpFilter"
            size="small"
            style="flex: 1"
            :loading="syncing"
            @click="onSync"
          >
            {{ $t('tag.sync') }}
          </Button>
        </div>
        <!-- 工具区与列表之间的分割线:-mx-2 抵消 p-2,通到面板两缘 -->
        <div class="-mx-2 border-b border-border"></div>
        <div class="min-h-0 flex-1 overflow-auto">
          <div v-if="groupLoading" class="p-4 text-center text-sm opacity-60">
            loading...
          </div>
          <Empty
            v-else-if="filteredGroups.length === 0"
            class="mt-8"
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
          />
          <div
            v-for="group in filteredGroups"
            v-else
            :key="group.id"
            class="group/row flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            :style="
              group.id === selectedGroup?.id
                ? { backgroundColor: 'hsl(var(--accent))' }
                : undefined
            "
            @click="onSelectGroup(group)"
          >
            <span class="min-w-0 flex-1 truncate font-medium">
              {{ group.groupName }}
            </span>
            <span class="shrink-0 text-xs text-primary">
              {{ group.tagList?.length ?? 0 }}
            </span>
            <Dropdown
              v-access:code="['tag:update', 'tag:delete']"
              :trigger="['click']"
            >
              <IconifyIcon
                class="size-4 shrink-0 opacity-0 group-hover/row:opacity-100"
                icon="lucide:more-horizontal"
                @click.stop
              />
              <template #popupRender>
                <Menu>
                  <MenuItem
                    v-access:code="'tag:update'"
                    @click="onEditGroup(group)"
                  >
                    {{ $t('tag.edit') }}
                  </MenuItem>
                  <MenuItem
                    v-access:code="'tag:delete'"
                    danger
                    @click="onDeleteGroup(group)"
                  >
                    {{ $t('tag.delete') }}
                  </MenuItem>
                </Menu>
              </template>
            </Dropdown>
          </div>
        </div>
      </div>

      <!-- 右侧:所选标签组下的标签 -->
      <div class="h-full min-w-0 flex-1">
        <TagGrid />
      </div>
    </div>
  </Page>
</template>
