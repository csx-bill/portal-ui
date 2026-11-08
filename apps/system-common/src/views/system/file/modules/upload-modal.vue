<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { $t } from '@vben/locales';

import { message } from 'antdv-next';

import { uploadFile } from '#/api/system/file';

import { UPLOAD_ALLOWED_EXTENSIONS } from '../upload-config';

/**
 * 上传弹窗（拖拽 / 点击选择）。
 *
 * 允许的格式按当前标签页（图片 / 视频 / 文件）动态变化，
 * 约束统一取自 ../upload-config.ts（前端配置）。
 */
const emit = defineEmits<{
  success: [];
}>();

/** 当前标签页分类（决定可用格式与提示文案） */
const category = ref<'file' | 'image' | 'video'>('image');
const groupId = ref<number | string | undefined>(undefined);
const uploading = ref(false);
const dragging = ref(false);
const inputRef = ref<HTMLInputElement>();

/** 当前分类允许的扩展名（随标签页变化） */
const allowedExtensions = computed(
  () => UPLOAD_ALLOWED_EXTENSIONS[category.value],
);

/** input 的 accept：按分类收敛文件选择范围 */
const acceptAttr = computed(() =>
  allowedExtensions.value.map((ext) => `.${ext}`).join(','),
);

const formatsText = computed(() => allowedExtensions.value.join('/'));

interface UploadModalData {
  category?: 'file' | 'image' | 'video';
  groupId?: number | string;
}

const [Modal, modalApi] = useVbenModal<UploadModalData>({
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = modalApi.getData();
      category.value = data?.category ?? 'image';
      groupId.value = data?.groupId;
      dragging.value = false;
    }
  },
  // 参考设计只有关闭按钮，不需要全屏/确认/取消
  fullscreenButton: false,
  showCancelButton: false,
  showConfirmButton: false,
  title: $t('systemCommon.system.file.upload'),
});

function triggerSelect() {
  if (uploading.value) return;
  inputRef.value?.click();
}

async function onInputChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = '';
  await doUpload(files);
}

function onDrop(event: DragEvent) {
  dragging.value = false;
  if (uploading.value) return;
  const files = [...(event.dataTransfer?.files ?? [])];
  doUpload(files);
}

async function doUpload(files: File[]) {
  if (files.length === 0) return;

  // 前端先按同一套约束预校验，避免整批请求后才失败
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    // 按当前分类（图片/视频/文件）校验格式
    if (!allowedExtensions.value.includes(ext)) {
      message.error(
        $t('systemCommon.system.file.uploadBadType', [formatsText.value]),
      );
      return;
    }
  }

  uploading.value = true;
  try {
    for (const file of files) {
      // 上传接口负责落盘 + 写元数据：按当前标签页分目录存放
      // （/{bucket}/{clientId}/{image|video|file}/{fileName}），并归属到所选分组
      await uploadFile(file, {
        dir: category.value,
        groupId: groupId.value,
      });
    }
    message.success($t('systemCommon.system.file.uploadSuccess'));
    modalApi.close();
    emit('success');
  } catch {
    // 服务端校验失败的消息由请求层统一提示
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <Modal class="w-full max-w-150">
    <!-- 拖拽区 -->
    <div
      class="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed transition-colors"
      :class="
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary'
      "
      @click="triggerSelect"
      @dragleave="dragging = false"
      @dragover.prevent="dragging = true"
      @drop.prevent="onDrop"
    >
      <input
        ref="inputRef"
        class="hidden"
        :accept="acceptAttr"
        multiple
        type="file"
        @change="onInputChange"
      />
      <IconifyIcon
        v-if="uploading"
        icon="lucide:loader-circle"
        class="size-8 animate-spin text-primary"
      />
      <IconifyIcon
        v-else
        icon="lucide:upload-cloud"
        class="size-8 opacity-40"
      />
      <div v-if="uploading" class="text-sm">
        {{ $t('systemCommon.system.file.uploading') }}
      </div>
      <div v-else class="text-sm">
        {{ $t('systemCommon.system.file.dropHere') }}
        <span class="text-primary">{{
          $t('systemCommon.system.file.clickToUpload')
        }}</span>
      </div>
    </div>

    <!-- 约束提示（上限值来自后端配置） -->
    <div class="mt-3 text-sm text-muted-foreground">
      {{ $t('systemCommon.system.file.uploadHintMiddle') }}
      <span class="font-semibold text-error">{{ formatsText }}</span>
      {{ $t('systemCommon.system.file.uploadHintSuffix') }}
    </div>
  </Modal>
</template>
