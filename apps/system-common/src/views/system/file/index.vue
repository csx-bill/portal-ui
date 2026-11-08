<script lang="ts" setup>
import type { SystemFile, SystemFileGroup } from '#/api/system/file';

import { computed, h, onMounted, ref } from 'vue';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { IconifyIcon, Plus, Search } from '@vben/icons';
import { $t } from '@vben/locales';

import {
  Button,
  Checkbox,
  Dropdown,
  Empty,
  Input,
  Menu,
  MenuItem,
  message,
  Modal,
  Spin,
  Tooltip,
} from 'antdv-next';
// 分页器与角色页（vxe-grid 内置分页）保持一致：
// vxe-pc-ui 经模块联邦 shared 由宿主提供，拿到的是同一 VxeUI 实例（主题/语言一致）
import { VxePager } from 'vxe-pc-ui';

import {
  deleteFileGroup,
  deleteFiles,
  downloadFile,
  getFileGroupTree,
  getFilePage,
  moveFiles,
  updateFile,
} from '#/api/system/file';
import { hasPermission } from '#/shared/request-context';

import FileCard from './modules/file-card.vue';
import FileList from './modules/file-list.vue';
import GroupForm from './modules/group-form.vue';
import UploadModal from './modules/upload-modal.vue';

/**
 * 文件管理页面（模块联邦 expose 入口：./FileManagePage）
 *
 * 媒体库布局：顶部类型标签页（图片/视频/文件）+ 左侧分组列表
 * + 工具栏（上传/删除/移动 + 搜索）+ 卡片网格 + 底部分页。
 */
const TABS = [
  { key: 'image', label: $t('systemCommon.system.file.tabImage') },
  { key: 'video', label: $t('systemCommon.system.file.tabVideo') },
  { key: 'file', label: $t('systemCommon.system.file.tabFile') },
] as const;

// ==================== 状态 ====================
const activeTab = ref<'file' | 'image' | 'video'>('image');
const groupTree = ref<SystemFileGroup[]>([]);
/** undefined=全部；null=未分组；其他=具体分组 id */
const selectedGroupId = ref<null | number | string | undefined>(undefined);
const selectedGroupName = ref($t('systemCommon.system.file.allFiles'));
const keyword = ref('');
const fileList = ref<SystemFile[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
/** 与 vben 的 vxe-grid 分页器默认布局/尺寸保持一致 */
const PAGER_LAYOUTS: (
  | 'End'
  | 'Home'
  | 'NextJump'
  | 'NextPage'
  | 'Number'
  | 'PrevJump'
  | 'PrevPage'
  | 'Sizes'
  | 'Total'
)[] = [
  'Total',
  'Sizes',
  'Home',
  'PrevJump',
  'PrevPage',
  'Number',
  'NextPage',
  'NextJump',
  'End',
];
const PAGER_SIZES = [10, 20, 30, 50, 100, 200];
const selectedIds = ref<Array<SystemFile['id']>>([]);
const [UploadModalComponent, uploadModalApi] = useVbenModal({
  connectedComponent: UploadModal,
});
/** 视图模式：平铺(默认) / 列表 */
const viewMode = ref<'grid' | 'list'>('grid');

const selectedSet = computed(() => new Set(selectedIds.value.map(String)));
const allSelected = computed(
  () =>
    fileList.value.length > 0 &&
    selectedIds.value.length === fileList.value.length,
);

const [GroupFormDrawer, groupFormDrawerApi] = useVbenDrawer({
  connectedComponent: GroupForm,
  destroyOnClose: true,
});

// ==================== 分组 ====================
async function loadGroups() {
  groupTree.value = await getFileGroupTree();
}

function flattenGroups(
  nodes: SystemFileGroup[],
  depth = 0,
): Array<{ depth: number; group: SystemFileGroup }> {
  const result: Array<{ depth: number; group: SystemFileGroup }> = [];
  for (const g of nodes ?? []) {
    result.push(
      { depth, group: g },
      ...flattenGroups(g.children ?? [], depth + 1),
    );
  }
  return result;
}

const flatGroups = computed(() => flattenGroups(groupTree.value));

function onSelectGroup(key: null | number | string | undefined, name: string) {
  selectedGroupId.value = key;
  selectedGroupName.value = name;
  page.value = 1;
  clearSelection();
  loadFiles();
}

async function onDeleteGroup(group: SystemFileGroup) {
  try {
    await deleteFileGroup(group.id);
    message.success($t('ui.actionMessage.deleteSuccess', [group.name]));
    if (String(selectedGroupId.value) === String(group.id)) {
      onSelectGroup(undefined, $t('systemCommon.system.file.allFiles'));
    }
    await loadGroups();
  } catch {
    // 错误消息由请求层统一提示（如分组下存在文件）
  }
}

function openGroupForm(
  group?: SystemFileGroup,
  parentId?: SystemFileGroup['id'],
) {
  const payload: any = group ?? (parentId ? { parentId } : null);
  groupFormDrawerApi.setData(payload).open();
}

// ==================== 文件列表 ====================
async function loadFiles() {
  loading.value = true;
  try {
    const res = await getFilePage({
      current: page.value,
      fileName: keyword.value || undefined,
      groupId:
        selectedGroupId.value === null
          ? undefined
          : (selectedGroupId.value as any),
      size: pageSize.value,
      typeCategory: activeTab.value,
      ungrouped: selectedGroupId.value === null ? true : undefined,
    });
    fileList.value = res.records ?? [];
    total.value = Number(res.total ?? 0);
  } finally {
    loading.value = false;
  }
}

function onTabChange(key: string) {
  activeTab.value = key as 'file' | 'image' | 'video';
  page.value = 1;
  clearSelection();
  loadFiles();
}

/** VxePager 的 page-change 事件（与 vxe-grid 内置分页同款） */
function onPageChange({
  currentPage,
  pageSize: size,
}: {
  currentPage: number;
  pageSize: number;
}) {
  page.value = currentPage;
  pageSize.value = size;
  clearSelection();
  loadFiles();
}

// ==================== 选择与批量操作 ====================
function clearSelection() {
  selectedIds.value = [];
}

function toggleSelect(file: SystemFile) {
  const key = String(file.id);
  selectedIds.value = selectedSet.value.has(key)
    ? selectedIds.value.filter((id) => String(id) !== key)
    : [...selectedIds.value, file.id];
}

function toggleSelectAll() {
  selectedIds.value = allSelected.value ? [] : fileList.value.map((f) => f.id);
}

/** 单文件删除（列表视图操作列） */
async function onDeleteFile(file: SystemFile) {
  try {
    await deleteFiles([file.id]);
    message.success(
      $t('ui.actionMessage.deleteSuccess', [file.original ?? file.fileName]),
    );
    await loadFiles();
  } catch {
    // 统一错误提示
  }
}

async function onBatchDelete() {
  if (selectedIds.value.length === 0) return;
  try {
    await deleteFiles(selectedIds.value);
    message.success(
      $t('ui.actionMessage.deleteSuccess', [`${selectedIds.value.length}`]),
    );
    clearSelection();
    await loadFiles();
  } catch {
    // 统一错误提示
  }
}

// 移动弹窗
const moveTargetId = ref<null | number | string | undefined>(undefined);
const [MoveModal, moveModalApi] = useVbenModal({
  onConfirm: async () => {
    await moveFiles(
      selectedIds.value,
      moveTargetId.value === null ? undefined : (moveTargetId.value as any),
    );
    message.success($t('systemCommon.system.file.moveSuccess'));
    moveModalApi.close();
    clearSelection();
    await loadFiles();
  },
  title: $t('systemCommon.system.file.moveTitle'),
});

function openMoveModal() {
  if (selectedIds.value.length === 0) return;
  moveTargetId.value = undefined;
  moveModalApi.open();
}

// ==================== 上传 ====================
/** 打开上传弹窗：带上当前分类与所选分组 */
function triggerUpload() {
  uploadModalApi
    .setData({
      category: activeTab.value,
      groupId:
        selectedGroupId.value === null
          ? undefined
          : (selectedGroupId.value as any),
    })
    .open();
}

// ==================== 单文件操作 ====================
const previewFile = ref<SystemFile>();
const previewOpen = ref(false);

/** 预览源：上传时后端下发的直连地址 */
const previewSrc = computed(() => previewFile.value?.url ?? undefined);
const isPreviewImage = computed(() =>
  previewFile.value?.type?.startsWith('image/'),
);

function onPreview(file: SystemFile) {
  if (!file.type?.startsWith('image/') && !file.type?.startsWith('video/')) {
    onDownload(file);
    return;
  }
  if (!file.url) {
    message.warning($t('systemCommon.system.file.urlUnavailable'));
    return;
  }
  previewFile.value = file;
  previewOpen.value = true;
}

function closePreview() {
  previewOpen.value = false;
  previewFile.value = undefined;
}

function onDownload(file: SystemFile) {
  if (!downloadFile(file)) {
    message.warning($t('systemCommon.system.file.urlUnavailable'));
  }
}

function onRename(file: SystemFile) {
  const initial = file.original ?? '';
  let value = initial;
  Modal.confirm({
    content: () =>
      h(Input, {
        defaultValue: initial,
        onChange: (e: any) => {
          value = e.target.value;
        },
      }),
    onOk: async () => {
      if (!value.trim()) {
        message.warning($t('systemCommon.system.file.nameRequired'));
        throw new Error('empty');
      }
      await updateFile({ ...file, id: file.id, original: value });
      message.success($t('ui.actionMessage.operationSuccess'));
      await loadFiles();
    },
    title: $t('systemCommon.system.file.rename'),
  });
}

onMounted(async () => {
  await loadGroups();
  await loadFiles();
});
</script>

<template>
  <Page auto-content-height>
    <GroupFormDrawer @success="loadGroups" />
    <UploadModalComponent @success="loadFiles" />

    <!-- 移动弹窗 -->
    <MoveModal class="w-full max-w-100">
      <div class="max-h-80 overflow-auto">
        <div
          class="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          :class="{ 'bg-primary/10': moveTargetId === undefined }"
          @click="moveTargetId = undefined"
        >
          {{ $t('systemCommon.system.file.ungrouped') }}
        </div>
        <div
          v-for="item in flatGroups"
          :key="item.group.id"
          class="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          :class="{ 'bg-primary/10': moveTargetId === item.group.id }"
          :style="{ paddingLeft: `${12 + item.depth * 16}px` }"
          @click="moveTargetId = item.group.id"
        >
          {{ item.group.name }}
        </div>
      </div>
    </MoveModal>

    <!-- 预览弹窗 -->
    <Modal
      :footer="null"
      :open="previewOpen"
      :title="previewFile?.original ?? previewFile?.fileName"
      width="800px"
      @cancel="closePreview"
    >
      <div class="flex max-h-[70vh] items-center justify-center overflow-auto">
        <img
          v-if="isPreviewImage"
          :src="previewSrc"
          class="max-h-[65vh] max-w-full"
          :alt="previewFile?.fileName"
        />
        <video
          v-else
          :src="previewSrc"
          class="max-h-[65vh] max-w-full"
          controls
        ></video>
      </div>
    </Modal>

    <!-- 整页承载在一张卡片内（bg-card 与角色页的 vxe-grid 容器一致） -->
    <div class="flex h-full flex-col rounded-md bg-card">
      <!-- 顶部类型标签页 -->
      <div class="flex items-center gap-6 border-b border-border px-4">
        <div
          v-for="tab in TABS"
          :key="tab.key"
          class="cursor-pointer border-b-2 px-1 pb-2 text-base transition-colors"
          :class="
            activeTab === tab.key
              ? 'border-primary font-medium text-primary'
              : 'border-transparent text-gray-500 hover:text-primary'
          "
          @click="onTabChange(tab.key)"
        >
          {{ tab.label }}
        </div>
      </div>

      <div class="flex min-h-0 flex-1">
        <!-- 左侧分组 -->
        <div class="flex w-64 shrink-0 flex-col border-r border-border">
          <div class="flex-1 overflow-auto p-2">
            <!-- 全部 -->
            <div
              class="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              :class="{ 'bg-primary/10': selectedGroupId === undefined }"
              @click="
                onSelectGroup(
                  undefined,
                  $t('systemCommon.system.file.allFiles'),
                )
              "
            >
              <IconifyIcon
                icon="lucide:folder-open"
                class="size-4 text-yellow-500"
              />
              <span class="truncate">
                {{ $t('systemCommon.system.file.allFiles') }}
              </span>
            </div>
            <!-- 未分组 -->
            <div
              class="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              :class="{ 'bg-primary/10': selectedGroupId === null }"
              @click="
                onSelectGroup(null, $t('systemCommon.system.file.ungrouped'))
              "
            >
              <IconifyIcon icon="lucide:folder" class="size-4 text-gray-400" />
              <span class="truncate">
                {{ $t('systemCommon.system.file.ungrouped') }}
              </span>
            </div>
            <!-- 分组树（扁平渲染 + 层级缩进） -->
            <div
              v-for="item in flatGroups"
              :key="item.group.id"
              class="group/row flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              :class="{
                'bg-primary/10':
                  String(selectedGroupId) === String(item.group.id),
              }"
              :style="{ paddingLeft: `${8 + item.depth * 14}px` }"
              @click="onSelectGroup(item.group.id, item.group.name)"
            >
              <IconifyIcon
                icon="lucide:folder"
                class="size-4 shrink-0 text-yellow-500"
              />
              <span class="flex-1 truncate">{{ item.group.name }}</span>
              <Dropdown :trigger="['click']">
                <IconifyIcon
                  icon="lucide:more-horizontal"
                  class="size-4 opacity-0 group-hover/row:opacity-100"
                  @click.stop
                />
                <template #popupRender>
                  <Menu>
                    <MenuItem @click="openGroupForm(item.group)">
                      {{ $t('systemCommon.system.file.rename') }}
                    </MenuItem>
                    <MenuItem @click="openGroupForm(undefined, item.group.id)">
                      {{ $t('systemCommon.system.file.addSubGroup') }}
                    </MenuItem>
                    <MenuItem danger @click="onDeleteGroup(item.group)">
                      {{ $t('common.delete') }}
                    </MenuItem>
                  </Menu>
                </template>
              </Dropdown>
            </div>
          </div>
          <div class="border-t border-border p-2">
            <Button block @click="openGroupForm()">
              <Plus class="size-4" />
              {{ $t('systemCommon.system.file.addGroup') }}
            </Button>
          </div>
        </div>

        <!-- 右侧文件区 -->
        <div class="flex min-w-0 flex-1 flex-col">
          <!-- 工具栏 -->
          <div
            class="flex flex-wrap items-center gap-2 border-b border-border p-3"
          >
            <Button
              v-if="hasPermission('file:upload')"
              type="primary"
              @click="triggerUpload"
            >
              <IconifyIcon icon="lucide:upload" class="size-4" />
              {{ $t('systemCommon.system.file.upload') }}
            </Button>
            <Button
              v-if="hasPermission('file:delete')"
              :disabled="selectedIds.length === 0"
              @click="onBatchDelete"
            >
              {{ $t('common.delete') }}
            </Button>
            <Button
              v-if="hasPermission('file:update')"
              :disabled="selectedIds.length === 0"
              @click="openMoveModal"
            >
              {{ $t('systemCommon.system.file.move') }}
            </Button>
            <div class="ml-auto flex items-center gap-2">
              <Input
                v-model:value="keyword"
                allow-clear
                :placeholder="$t('systemCommon.system.file.searchPlaceholder')"
                style="width: 220px"
                @press-enter="loadFiles"
              />
              <Button @click="loadFiles">
                <Search class="size-4" />
              </Button>
              <!-- 视图切换：列表 / 平铺（默认平铺） -->
              <Tooltip :title="$t('systemCommon.system.file.viewList')">
                <Button
                  :type="viewMode === 'list' ? 'primary' : 'default'"
                  @click="viewMode = 'list'"
                >
                  <IconifyIcon icon="lucide:list" class="size-4" />
                </Button>
              </Tooltip>
              <Tooltip :title="$t('systemCommon.system.file.viewGrid')">
                <Button
                  :type="viewMode === 'grid' ? 'primary' : 'default'"
                  @click="viewMode = 'grid'"
                >
                  <IconifyIcon icon="lucide:layout-grid" class="size-4" />
                </Button>
              </Tooltip>
            </div>
          </div>

          <!-- 全选 + 当前分组 -->
          <div class="flex items-center gap-3 px-4 py-2">
            <Checkbox :checked="allSelected" @change="toggleSelectAll">
              {{ $t('systemCommon.system.file.selectAll') }}
            </Checkbox>
            <span class="text-xs text-gray-400">{{ selectedGroupName }}</span>
          </div>

          <!-- 卡片网格 -->
          <div class="min-h-0 flex-1 overflow-auto px-4 pb-2">
            <Spin :spinning="loading" class="w-full">
              <Empty
                v-if="fileList.length === 0 && !loading"
                class="mt-16"
                :image="Empty.PRESENTED_IMAGE_SIMPLE"
              />
              <!-- 列表视图 -->
              <FileList
                v-else-if="viewMode === 'list'"
                :files="fileList"
                :selected-set="selectedSet"
                @delete="onDeleteFile"
                @preview="onPreview"
                @rename="onRename"
                @select="toggleSelect"
              />
              <!-- 平铺视图（默认） -->
              <div
                v-else
                class="grid gap-3"
                style="
                  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                "
              >
                <FileCard
                  v-for="file in fileList"
                  :key="file.id"
                  :file="file"
                  :selected="selectedSet.has(String(file.id))"
                  @delete="onDeleteFile"
                  @download="onDownload"
                  @preview="onPreview"
                  @rename="onRename"
                  @select="toggleSelect"
                />
              </div>
            </Spin>
          </div>

          <!-- 分页（与角色页的 vxe 分页器一致） -->
          <VxePager
            background
            class="mt-2 w-full px-4 pb-3"
            :current-page="page"
            :layouts="PAGER_LAYOUTS"
            :page-size="pageSize"
            :page-sizes="PAGER_SIZES"
            size="mini"
            :total="total"
            @page-change="onPageChange"
          />
        </div>
      </div>
    </div>
  </Page>
</template>
