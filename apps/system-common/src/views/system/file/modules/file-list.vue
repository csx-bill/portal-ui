<script lang="ts" setup>
import type { SystemFile } from '#/api/system/file';

import { $t } from '@vben/locales';

import { Checkbox } from 'antdv-next';

import { hasPermission } from '#/shared/request-context';

import FileThumb from './file-thumb.vue';

/**
 * 文件列表视图（表格样式）：缩略图 / 名称 / 上传时间 / 操作
 */
defineProps<{
  files: SystemFile[];
  selectedSet: Set<string>;
}>();

const emit = defineEmits<{
  delete: [file: SystemFile];
  preview: [file: SystemFile];
  rename: [file: SystemFile];
  select: [file: SystemFile];
}>();
</script>

<template>
  <div class="w-full overflow-hidden rounded-md">
    <!-- 表头 -->
    <div
      class="flex items-center gap-3 bg-gray-50 px-4 py-3 text-sm font-medium dark:bg-gray-800/60"
    >
      <div class="w-6 shrink-0"></div>
      <div class="w-16 shrink-0 text-center">
        {{ $t('systemCommon.system.file.thumbColumn') }}
      </div>
      <div class="min-w-0 flex-1">
        {{ $t('systemCommon.system.file.nameColumn') }}
      </div>
      <div class="w-52 shrink-0">
        {{ $t('systemCommon.system.file.uploadTimeColumn') }}
      </div>
      <div class="w-40 shrink-0 text-right">
        {{ $t('systemCommon.system.file.actionColumn') }}
      </div>
    </div>

    <!-- 行 -->
    <div
      v-for="file in files"
      :key="file.id"
      class="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 hover:bg-gray-50/60 dark:hover:bg-gray-800/40"
    >
      <div class="w-6 shrink-0">
        <Checkbox
          :checked="selectedSet.has(String(file.id))"
          @change="emit('select', file)"
        />
      </div>
      <div class="w-16 shrink-0">
        <FileThumb :file="file" fit="contain" size-class="size-14" />
      </div>
      <div
        class="min-w-0 flex-1 truncate"
        :title="file.original ?? file.fileName"
      >
        {{ file.original ?? file.fileName }}
      </div>
      <div class="w-52 shrink-0 text-sm text-gray-500">
        {{ file.createTime ?? '-' }}
      </div>
      <div class="flex w-40 shrink-0 items-center justify-end gap-3 text-sm">
        <a
          v-if="hasPermission('file:update')"
          class="text-primary"
          @click="emit('rename', file)"
        >
          {{ $t('systemCommon.system.file.rename') }}
        </a>
        <a class="text-primary" @click="emit('preview', file)">
          {{ $t('systemCommon.system.file.view') }}
        </a>
        <a
          v-if="hasPermission('file:delete')"
          class="text-error"
          @click="emit('delete', file)"
        >
          {{ $t('common.delete') }}
        </a>
      </div>
    </div>
  </div>
</template>
