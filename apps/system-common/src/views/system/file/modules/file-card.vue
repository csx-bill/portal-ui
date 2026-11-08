<script lang="ts" setup>
import type { SystemFile } from '#/api/system/file';

import { computed } from 'vue';

import { Checkbox } from 'antdv-next';

import { hasPermission } from '#/shared/request-context';

import FileThumb from './file-thumb.vue';

/**
 * 文件卡片（平铺视图单元）：缩略图 + 文件名 + 悬停操作条
 */
const props = defineProps<{
  file: SystemFile;
  selected: boolean;
}>();

const emit = defineEmits<{
  delete: [file: SystemFile];
  download: [file: SystemFile];
  preview: [file: SystemFile];
  rename: [file: SystemFile];
  select: [file: SystemFile];
}>();

const sizeText = computed(() => {
  const size = props.file.fileSize;
  if (size === null || size === undefined) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
});
</script>

<template>
  <div
    class="group relative flex cursor-pointer flex-col rounded-md border p-2 transition-shadow hover:shadow-md"
  >
    <!-- 多选（悬停或已选中时显示） -->
    <div
      class="absolute left-3 top-3 z-10 transition-opacity"
      :class="selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
      @click.stop="emit('select', file)"
    >
      <Checkbox :checked="selected" />
    </div>

    <!-- 缩略图 -->
    <div @click="emit('preview', file)">
      <FileThumb :file="file" fit="cover" size-class="h-32 w-full" />
    </div>

    <!-- 文件名 + 大小 -->
    <div
      class="mt-2 truncate text-center text-sm"
      :title="file.original ?? file.fileName"
    >
      {{ file.original ?? file.fileName }}
    </div>
    <div class="truncate text-center text-xs text-gray-400">{{ sizeText }}</div>

    <!-- 悬停操作条 -->
    <div
      class="mt-1 flex items-center justify-center gap-3 text-xs opacity-0 transition-opacity group-hover:opacity-100"
    >
      <a
        v-if="hasPermission('file:update')"
        class="text-primary"
        @click.stop="emit('rename', file)"
      >
        {{ $t('systemCommon.system.file.rename') }}
      </a>
      <a class="text-primary" @click.stop="emit('preview', file)">
        {{ $t('systemCommon.system.file.view') }}
      </a>
      <a
        v-if="hasPermission('file:delete')"
        class="text-error"
        @click.stop="emit('delete', file)"
      >
        {{ $t('common.delete') }}
      </a>
    </div>
  </div>
</template>
