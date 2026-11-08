<script lang="ts" setup>
import type { SystemFile } from '#/api/system/file';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

/**
 * 文件缩略图（卡片视图与列表视图共用）。
 *
 * 图片/视频用元数据里的直连地址（上传时由后端下发，如 /local/{clientId}/xxx.png
 * 或对象存储域名）交给浏览器加载；其余类型显示分类占位图标。
 */
const props = withDefaults(
  defineProps<{
    file: SystemFile;
    /** 容器尺寸 class（如 "h-32 w-full" / "size-14"） */
    sizeClass?: string;
    /** object-fit：网格用 cover，列表用 contain */
    fit?: 'contain' | 'cover';
  }>(),
  {
    fit: 'cover',
    sizeClass: 'h-32 w-full',
  },
);

const isImage = computed(() => props.file.type?.startsWith('image/'));
const isVideo = computed(() => props.file.type?.startsWith('video/'));

const iconName = computed(() => {
  if (isImage.value) return 'lucide:image';
  if (isVideo.value) return 'lucide:video';
  return 'lucide:file-text';
});

/** 直连地址（早期数据可能缺失，此时回退占位图标） */
const directUrl = computed(() => props.file.url ?? undefined);
</script>

<template>
  <div
    class="flex items-center justify-center overflow-hidden rounded bg-gray-50 dark:bg-gray-800/60"
    :class="sizeClass"
  >
    <img
      v-if="directUrl && isImage"
      :src="directUrl"
      class="size-full"
      :class="fit === 'cover' ? 'object-cover' : 'object-contain'"
      :alt="file.fileName"
    />
    <video
      v-else-if="directUrl && isVideo"
      :src="directUrl"
      class="size-full object-contain"
    ></video>
    <IconifyIcon v-else :icon="iconName" class="size-8 opacity-40" />
  </div>
</template>
