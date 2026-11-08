<script lang="ts" setup>
import type { SystemFile, SystemFileGroup } from '../../api/system/file';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon, Search } from '@vben/icons';
import { $t } from '@vben/locales';

import {
  Button,
  Checkbox,
  Empty,
  Input,
  message,
  Modal,
  Spin,
  Upload,
} from 'antdv-next';
import { VxePager } from 'vxe-pc-ui';

import {
  getFileGroupTree,
  getFilePage,
  uploadFile,
} from '../../api/system/file';

/**
 * 素材选择弹窗：布局与功能对齐文件管理页（类型页签 + 左侧分组树 +
 * 工具栏搜索/上传 + 平铺卡片网格 + 分页），用于从文件库选取素材。
 *
 * 宿主经模块联邦 expose（system_common/components）按需引入，
 * 通过 useVbenModal({ connectedComponent }) 连接；
 * 打开前 setData({ accept, multiple, mediaLimits })：
 * - accept：打开时定位的类型页签（image/video/file），确认时校验所选文件大类；
 * - multiple：是否多选（默认单选，多选可跨页累计）。
 * - mediaLimits（可选）：媒体文件限制（格式/大小），由宿主按业务传入；
 *   不传则不做限制校验。结构：
 *   { minBytes?: number, image?: { formats?: string[], maxBytes?: number },
 *     video?: { formats?: string[], maxBytes?: number }, file?: { maxBytes?: number } }
 * 点卡片选中，确认后通过 select 事件回传：单选为一个 { url, fileName }，
 * 多选为其数组。工具栏可直接上传（落在当前页签大类与所选分组），
 * 成功后自动选中新文件。
 */
defineOptions({ name: 'MediaPickerModal' });

const emit = defineEmits<{
  select: [
    files:
      | Array<{ fileName: string; url: string }>
      | { fileName: string; url: string },
  ];
}>();

/** 媒体文件限制（宿主按业务传入，规则作用于上传与选择确认） */
export interface MediaPickerLimitRule {
  /** 允许的文件扩展名（小写），如 ['jpg','jpeg','png'] */
  formats?: string[];
  /** 最大字节数 */
  maxBytes?: number;
}

export interface MediaPickerLimits {
  file?: MediaPickerLimitRule;
  image?: MediaPickerLimitRule;
  /** 所有文件最小字节数 */
  minBytes?: number;
  video?: MediaPickerLimitRule;
}

const accept = ref<'file' | 'image' | 'video'>('file');
const activeTab = ref<'file' | 'image' | 'video'>('image');
const multiple = ref(false);
const mediaLimits = ref<MediaPickerLimits>();
const groupTree = ref<SystemFileGroup[]>([]);
const fileList = ref<SystemFile[]>([]);
const loading = ref(false);
const keyword = ref('');
const uploading = ref(false);
/** 已选文件（跨页累计，确认时统一回传） */
const selectedFiles = ref<SystemFile[]>([]);
const selectedGroupId = ref<null | number | string | undefined>(undefined);
const selectedGroupName = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const TABS = [
  { label: $t('systemCommon.system.file.tabImage'), value: 'image' },
  { label: $t('systemCommon.system.file.tabVideo'), value: 'video' },
  { label: $t('systemCommon.system.file.tabFile'), value: 'file' },
] as const;

/** 与文件管理页一致的 vxe 分页器布局与页容量 */
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

const isImageFile = (file: SystemFile) =>
  file.type?.startsWith('image/') ?? false;
const isVideoFile = (file: SystemFile) =>
  file.type?.startsWith('video/') ?? false;
const fileNameOf = (file: SystemFile) => file.original || file.fileName || '';

// ==================== 媒体文件限制（由宿主经 setData 传入） ====================
// mediaLimits 未配置时不做校验；配置后校验：minBytes 最小字节、
// 各类型 formats 允许的扩展名、maxBytes 最大字节
const extOf = (name?: string) => name?.split('.').pop()?.toLowerCase() ?? '';

/** 按当前页签校验媒体文件（格式/大小），返回错误文案；undefined 表示通过 */
function mediaValidateFail(file: {
  fileSize?: number;
  name?: string;
  original?: string;
  type?: string;
}): string | undefined {
  const limits = mediaLimits.value;
  const rule = limits?.[accept.value];
  if (!limits || !rule) return undefined;
  const ext = extOf(file.original || file.name);
  if (rule.formats?.length) {
    const mimeMatch =
      !!file.type &&
      rule.formats.some((format) => file.type === `${accept.value}/${format}`);
    if (!rule.formats.includes(ext) && !mimeMatch) {
      return $t('systemCommon.system.file.uploadBadType', [
        rule.formats.map((format) => format.toUpperCase()).join('/'),
      ]);
    }
  }
  if ((file.fileSize ?? 0) <= (limits.minBytes ?? 0)) {
    return $t('systemCommon.system.file.uploadTooSmall');
  }
  if (rule.maxBytes && (file.fileSize ?? 0) > rule.maxBytes) {
    return $t('systemCommon.system.file.uploadTooLarge', [
      sizeText(rule.maxBytes),
    ]);
  }
  return undefined;
}

/** 文件是否属于允许的大类（accept=file 时为非媒体文件） */
function matchesAccept(file: SystemFile) {
  if (accept.value === 'image') return isImageFile(file);
  if (accept.value === 'video') return isVideoFile(file);
  return !isImageFile(file) && !isVideoFile(file);
}

/** 可预览（图片/视频且有直连地址） */
const canPreview = (file: SystemFile) =>
  (isImageFile(file) || isVideoFile(file)) && !!file.url;

const selectedSet = computed(
  () => new Set(selectedFiles.value.map((f) => f.url ?? '')),
);
const allSelected = computed(
  () =>
    fileList.value.length > 0 &&
    fileList.value.every((f) => selectedSet.value.has(f.url ?? '')),
);

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
  loadFiles();
}

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
  loadFiles();
}

function onPageChange({
  currentPage: current,
  pageSize: size,
}: {
  currentPage: number;
  pageSize: number;
}) {
  page.value = current;
  pageSize.value = size;
  loadFiles();
}

function toggleSelect(file: SystemFile) {
  const url = file.url ?? '';
  const idx = selectedFiles.value.findIndex((f) => f.url === url);
  if (!multiple.value) {
    selectedFiles.value = idx === -1 ? [file] : [];
    return;
  }
  if (idx === -1) {
    selectedFiles.value.push(file);
  } else {
    selectedFiles.value.splice(idx, 1);
  }
}

/** 全选当前页（多选模式，与文件管理页一致） */
function toggleSelectAll() {
  const pageUrls = new Set(fileList.value.map((f) => f.url ?? ''));
  if (allSelected.value) {
    selectedFiles.value = selectedFiles.value.filter(
      (f) => !pageUrls.has(f.url ?? ''),
    );
  } else {
    for (const file of fileList.value) {
      if (!selectedSet.value.has(file.url ?? '')) {
        selectedFiles.value.push(file);
      }
    }
  }
}

function onBeforeUpload(file: File) {
  // 企微媒体文件限制校验（格式/大小），不通过则阻止上传
  const failReason = mediaValidateFail({
    fileSize: file.size,
    name: file.name,
    type: file.type,
  });
  if (failReason) {
    message.error(failReason);
    return false;
  }
  uploading.value = true;
  uploadFile(file, {
    // 与文件管理页上传一致：按当前页签大类落在对应目录与分组
    dir: activeTab.value,
    groupId:
      selectedGroupId.value === null
        ? undefined
        : (selectedGroupId.value as any),
  })
    .then(async (res) => {
      message.success($t('systemCommon.system.file.uploadSuccess'));
      const added: SystemFile = {
        fileName: res.fileName || file.name,
        id: res.url || file.name,
        original: file.name,
        type: file.type,
        url: res.url || '',
      };
      // 上传成功自动选中新文件
      if (multiple.value) {
        selectedFiles.value.push(added);
      } else {
        selectedFiles.value = [added];
      }
      page.value = 1;
      await loadFiles();
    })
    .catch(() => message.error($t('systemCommon.system.file.uploadFail')))
    .finally(() => {
      uploading.value = false;
    });
  // 阻止 antd Upload 自动上传
  return false;
}

function sizeText(size?: number) {
  if (size === null || size === undefined) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

// ==================== 预览（与文件管理页一致） ====================
const previewFile = ref<SystemFile>();
/** 预览源：后端下发的直连地址（数据可能为 null，统一转 undefined） */
const previewSrc = computed(() => previewFile.value?.url ?? undefined);

function onPreview(file: SystemFile) {
  if (!file.url) {
    message.warning($t('systemCommon.system.file.urlUnavailable'));
    return;
  }
  previewFile.value = file;
}

const [PickerModal, modalApi] = useVbenModal({
  onConfirm() {
    if (selectedFiles.value.length === 0) {
      message.warning($t('systemCommon.system.file.selectRequired'));
      return;
    }
    // 页签仅定位初始大类，允许浏览其他页签，但确认时校验大类
    if (selectedFiles.value.some((file) => !matchesAccept(file))) {
      message.warning($t('systemCommon.system.file.typeNotAllowed'));
      return;
    }
    // 媒体文件限制校验（宿主 mediaLimits 配置了才生效：大小超限/小于最小字节）
    const rule = mediaLimits.value?.[accept.value];
    if (rule) {
      const invalid = selectedFiles.value.find(
        (file) =>
          (rule.maxBytes && (file.fileSize ?? 0) > rule.maxBytes) ||
          (file.fileSize ?? 0) <= (mediaLimits.value?.minBytes ?? 0),
      );
      if (invalid) {
        message.warning(
          rule.maxBytes
            ? $t('systemCommon.system.file.uploadTooLarge', [
                sizeText(rule.maxBytes),
              ])
            : $t('systemCommon.system.file.uploadTooSmall'),
        );
        return;
      }
    }
    const payload = selectedFiles.value.map((file) => ({
      fileName: fileNameOf(file),
      url: file.url ?? '',
    }));
    if (multiple.value) {
      emit('select', payload);
    } else if (payload[0]) {
      emit('select', payload[0]);
    }
    modalApi.close();
  },
  onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = modalApi.getData() as
      | undefined
      | {
          accept?: 'file' | 'image' | 'video';
          mediaLimits?: MediaPickerLimits;
          multiple?: boolean;
        };
    accept.value = data?.accept ?? 'file';
    mediaLimits.value = data?.mediaLimits;
    activeTab.value = accept.value;
    multiple.value = data?.multiple ?? false;
    keyword.value = '';
    selectedFiles.value = [];
    selectedGroupId.value = undefined;
    selectedGroupName.value = '';
    page.value = 1;
    loadGroups();
    loadFiles();
  },
});

async function loadGroups() {
  groupTree.value = (await getFileGroupTree()) ?? [];
}
</script>
<template>
  <PickerModal
    class="w-full max-w-260"
    :title="$t('systemCommon.system.file.selectMedia')"
  >
    <div class="flex h-125 flex-col">
      <!-- 顶部类型标签页（与文件管理页一致） -->
      <div class="flex items-center gap-6 border-b border-border px-1">
        <div
          v-for="tab in TABS"
          :key="tab.value"
          class="cursor-pointer border-b-2 px-1 pb-2 text-sm transition-colors"
          :class="
            activeTab === tab.value
              ? 'border-primary font-medium text-primary'
              : 'border-transparent text-gray-500 hover:text-primary'
          "
          @click="onTabChange(tab.value)"
        >
          {{ tab.label }}
        </div>
      </div>

      <div class="flex min-h-0 flex-1">
        <!-- 左侧分组树（与文件管理页一致：全部/未分组/分组树） -->
        <div class="flex w-64 shrink-0 flex-col border-r border-border">
          <div class="flex-1 overflow-auto p-2">
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
              class="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
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
            </div>
          </div>
        </div>

        <!-- 右侧文件区 -->
        <div class="flex min-w-0 flex-1 flex-col">
          <!-- 工具栏：上传 + 搜索（与文件管理页一致） -->
          <div
            class="flex flex-wrap items-center gap-2 border-b border-border p-3"
          >
            <Upload :before-upload="onBeforeUpload" :show-upload-list="false">
              <Button :loading="uploading" type="primary">
                <IconifyIcon icon="lucide:upload" class="size-4" />
                {{ $t('systemCommon.system.file.upload') }}
              </Button>
            </Upload>
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
            </div>
          </div>

          <!-- 全选 + 当前分组（多选模式，与文件管理页一致） -->
          <div v-if="multiple" class="flex items-center gap-3 px-4 py-2">
            <Checkbox :checked="allSelected" @change="toggleSelectAll">
              {{ $t('systemCommon.system.file.selectAll') }}
            </Checkbox>
            <span class="text-xs text-gray-400">{{ selectedGroupName }}</span>
            <span class="ml-auto text-xs text-gray-400">
              {{
                $t('systemCommon.system.file.selectedCount', [
                  selectedFiles.length,
                ])
              }}
            </span>
          </div>

          <!-- 卡片网格 -->
          <div class="min-h-0 flex-1 overflow-auto p-3">
            <Spin :spinning="loading" class="w-full">
              <Empty
                v-if="fileList.length === 0 && !loading"
                class="mt-16"
                :image="Empty.PRESENTED_IMAGE_SIMPLE"
              />
              <div
                v-else
                class="grid gap-3"
                style="
                  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                "
              >
                <div
                  v-for="file in fileList"
                  :key="file.id"
                  class="group relative flex cursor-pointer flex-col rounded-md border p-2 transition-all hover:shadow-md"
                  :class="
                    selectedSet.has(file.url ?? '')
                      ? 'border-primary'
                      : 'border-border'
                  "
                  @click="toggleSelect(file)"
                >
                  <!-- 多选（悬停或已选中时显示，与文件管理页一致） -->
                  <div
                    class="absolute left-3 top-3 z-10 transition-opacity"
                    :class="
                      selectedSet.has(file.url ?? '')
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                    "
                    @click.stop="toggleSelect(file)"
                  >
                    <Checkbox :checked="selectedSet.has(file.url ?? '')" />
                  </div>
                  <!-- 缩略图 -->
                  <div
                    class="flex h-32 w-full items-center justify-center overflow-hidden rounded bg-gray-50 dark:bg-gray-800/60"
                  >
                    <img
                      v-if="isImageFile(file) && file.url"
                      :src="file.url"
                      class="size-full object-cover"
                      :alt="fileNameOf(file)"
                    />
                    <video
                      v-else-if="isVideoFile(file) && file.url"
                      :src="file.url"
                      class="size-full object-contain"
                    ></video>
                    <IconifyIcon
                      v-else
                      :icon="
                        isVideoFile(file) ? 'lucide:video' : 'lucide:file-text'
                      "
                      class="size-8 opacity-40"
                    />
                  </div>
                  <!-- 文件名 + 大小 -->
                  <div
                    class="mt-2 truncate text-center text-sm"
                    :title="fileNameOf(file)"
                  >
                    {{ fileNameOf(file) }}
                  </div>
                  <div class="truncate text-center text-xs text-gray-400">
                    {{ sizeText(file.fileSize) }}
                  </div>
                  <!-- 悬停预览 -->
                  <div
                    v-if="canPreview(file)"
                    class="mt-1 flex items-center justify-center text-xs opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <a class="text-primary" @click.stop="onPreview(file)">
                      {{ $t('systemCommon.system.file.view') }}
                    </a>
                  </div>
                </div>
              </div>
            </Spin>
          </div>

          <!-- 分页（与文件管理页同款 vxe 分页器） -->
          <VxePager
            background
            class="w-full px-3 pb-2"
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

    <!-- 预览弹窗（与文件管理页一致） -->
    <Modal
      :footer="null"
      :open="!!previewFile"
      :title="previewFile?.original ?? previewFile?.fileName"
      width="800px"
      @cancel="previewFile = undefined"
    >
      <div class="flex max-h-[70vh] items-center justify-center overflow-auto">
        <img
          v-if="previewFile?.type?.startsWith('image/')"
          :alt="previewFile?.fileName"
          :src="previewSrc"
          class="max-h-[65vh] max-w-full"
        />
        <video
          v-else
          :src="previewSrc"
          class="max-h-[65vh] max-w-full"
          controls
        ></video>
      </div>
    </Modal>
  </PickerModal>
</template>
