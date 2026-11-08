<script lang="ts" setup>
import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import type { SystemDict, SystemDictItem } from '#/api/system/dict';

import { computed, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { $t } from '@vben/locales';
import { useVbenVxeGrid } from '@vben/plugins/vxe-table';

import { Button, Empty, Input, message, Popconfirm } from 'antdv-next';

import {
  deleteDict,
  deleteDictItem,
  getDictItemList,
  getDictList,
} from '#/api/system/dict';
import { hasPermission } from '#/shared/request-context';

import { useItemColumns } from './data';
import ItemForm from './modules/item-form.vue';
import TypeForm from './modules/type-form.vue';

/**
 * 字典管理页面（模块联邦 expose 入口：./DictManagePage）
 *
 * 主从式布局：左侧字典类型列表（全量、客户端过滤），
 * 右侧所选类型的字典项（无分页，按 sortOrder 排序）。
 */
const [TypeFormDrawer, typeFormDrawerApi] = useVbenDrawer({
  connectedComponent: TypeForm,
  destroyOnClose: true,
});
const [ItemFormDrawer, itemFormDrawerApi] = useVbenDrawer({
  connectedComponent: ItemForm,
  destroyOnClose: true,
});

// ==================== 左侧：字典类型 ====================
const typeList = ref<SystemDict[]>([]);
const typeLoading = ref(false);
const typeKeyword = ref('');
const selectedType = ref<SystemDict>();

const filteredTypes = computed(() => {
  const kw = typeKeyword.value.trim().toLowerCase();
  if (!kw) return typeList.value;
  return typeList.value.filter(
    (t) =>
      t.dictType?.toLowerCase().includes(kw) ||
      t.description?.toLowerCase().includes(kw),
  );
});

async function loadTypes(keepSelection = true) {
  typeLoading.value = true;
  try {
    typeList.value = await getDictList();
    if (keepSelection && selectedType.value) {
      selectedType.value =
        typeList.value.find((t) => t.id === selectedType.value?.id) ??
        undefined;
    }
    if (!selectedType.value && typeList.value.length > 0) {
      selectedType.value = typeList.value[0];
      // 首次自动选中后主动拉取字典项：网格挂载时的自动查询
      // 发生在选中之前（当时还没有选中类型，查询结果为空）
      itemGridApi.query();
    }
    if (!selectedType.value) {
      itemGridApi.query();
    }
  } finally {
    typeLoading.value = false;
  }
}

function onSelectType(dict: SystemDict) {
  // 再次点击已选中类型 → 取消选中（对齐用户管理交互）
  selectedType.value = selectedType.value?.id === dict.id ? undefined : dict;
  itemGridApi.query();
}

function onCreateType() {
  typeFormDrawerApi.setData(null).open();
}
function onEditType() {
  if (!selectedType.value) return;
  typeFormDrawerApi.setData(selectedType.value).open();
}

function onDeleteType() {
  const row = selectedType.value;
  if (!row) return;
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.dictType]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteDict(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.dictType]),
        key: 'action_process_msg',
      });
      selectedType.value = undefined;
      loadTypes(false);
    })
    .catch(() => {
      hideLoading();
    });
}

// ==================== 右侧：字典项 ====================
const [ItemGrid, itemGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useItemColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async () => {
          const dictId = selectedType.value?.id;
          if (!dictId) return [];
          return await getDictItemList(dictId);
        },
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
  } as VxeTableGridOptions<SystemDictItem>,
});

function onCreateItem() {
  const dict = selectedType.value;
  if (!dict) return;
  itemFormDrawerApi.setData({ dictId: dict.id }).open();
}
function onEditItem(row: SystemDictItem) {
  itemFormDrawerApi.setData(row).open();
}

function onDeleteItem(row: SystemDictItem) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.label]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteDictItem(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.label]),
        key: 'action_process_msg',
      });
      itemGridApi.query();
    })
    .catch(() => {
      hideLoading();
    });
}

loadTypes();
</script>
<template>
  <Page auto-content-height>
    <TypeFormDrawer @success="loadTypes(false)" />
    <ItemFormDrawer @success="itemGridApi.query()" />
    <!-- 布局对齐用户管理：左侧面板卡片 + 右侧列表 -->
    <div class="flex h-full min-h-0 gap-2">
      <div
        class="flex w-60 shrink-0 flex-col gap-2 rounded-md border bg-card p-2"
      >
        <Input
          v-model:value="typeKeyword"
          allow-clear
          :placeholder="$t('systemCommon.system.dict.typeSearch')"
        />
        <div class="flex items-center gap-1">
          <Button
            v-if="hasPermission('dict:add')"
            size="small"
            style="flex: 1"
            type="primary"
            @click="onCreateType"
          >
            {{ $t('common.create') }}
          </Button>
          <Button
            v-if="hasPermission('dict:update')"
            :disabled="!selectedType"
            size="small"
            style="flex: 1"
            @click="onEditType"
          >
            {{ $t('common.edit') }}
          </Button>
          <Popconfirm
            v-if="hasPermission('dict:delete')"
            placement="topRight"
            :title="$t('ui.actionTitle.delete')"
            @confirm="onDeleteType"
          >
            <template #description>
              <div class="truncate">
                {{
                  $t('ui.actionMessage.deleteConfirm', [selectedType?.dictType])
                }}
              </div>
            </template>
            <Button
              danger
              :disabled="!selectedType"
              size="small"
              style="flex: 1"
            >
              {{ $t('common.delete') }}
            </Button>
          </Popconfirm>
        </div>
        <!-- 工具区与列表之间的分割线 -->
        <div class="-mx-2 border-b border-border"></div>
        <div class="min-h-0 flex-1 overflow-auto">
          <div v-if="typeLoading" class="p-4 text-center text-sm opacity-60">
            loading...
          </div>
          <Empty
            v-else-if="filteredTypes.length === 0"
            class="mt-8"
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
          />
          <div
            v-for="dict in filteredTypes"
            v-else
            :key="dict.id"
            class="cursor-pointer rounded-md px-2 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            :class="{
              'bg-primary/10 dark:bg-primary/20': dict.id === selectedType?.id,
            }"
            @click="onSelectType(dict)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-medium">{{ dict.dictType }}</span>
              <span
                v-if="dict.systemFlag === '1'"
                class="shrink-0 text-xs text-primary"
              >
                {{ $t('systemCommon.system.dict.systemFlag') }}
              </span>
            </div>
            <div v-if="dict.description" class="truncate text-xs text-gray-500">
              {{ dict.description }}
            </div>
          </div>
        </div>
      </div>
      <!-- 右侧：字典项 -->
      <div class="h-full min-w-0 flex-1">
        <ItemGrid>
          <template #toolbar-tools>
            <Button
              v-if="hasPermission('dict:add')"
              :disabled="!selectedType"
              type="primary"
              @click="onCreateItem"
            >
              <Plus class="size-5" />
              {{ $t('systemCommon.system.dict.addItem') }}
            </Button>
          </template>
          <template #operation="{ row }">
            <div class="flex table-operations justify-center">
              <Button
                v-if="hasPermission('dict:update')"
                size="small"
                type="link"
                @click="onEditItem(row)"
              >
                {{ $t('common.edit') }}
              </Button>
              <Popconfirm
                v-if="hasPermission('dict:delete')"
                placement="topLeft"
                :title="$t('ui.actionTitle.delete')"
                @confirm="onDeleteItem(row)"
              >
                <template #description>
                  <div class="truncate">
                    {{ $t('ui.actionMessage.deleteConfirm', [row.label]) }}
                  </div>
                </template>
                <Button danger size="small" type="link">
                  {{ $t('common.delete') }}
                </Button>
              </Popconfirm>
            </div>
          </template>
        </ItemGrid>
      </div>
    </div>
  </Page>
</template>
