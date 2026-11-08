<script lang="ts" setup>
import type { ContactApi, CorpApi, CorpTagApi, MomentApi } from '#/api';

import { computed, defineAsyncComponent, reactive, ref } from 'vue';

import { useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  DatePicker,
  Input,
  message,
  RadioGroup,
  Select,
  Tag,
  TextArea,
  TreeSelect,
} from 'antdv-next';

import {
  getContactList,
  getCorpList,
  getDeptTree,
  getMomentTaskById,
  getTagGroupList,
  saveMomentTask,
} from '#/api';
import { $t } from '#/locales';

import { MOMENT_MEDIA_LIMITS, momentMediaHint } from '../data';

/**
 * 朋友圈任务新建/编辑抽屉（后端 POST /scrm/moment：id 为空新增，否则更新）。
 *
 * 文本为单实例 TextArea；链接为单实例表单；
 * 图片/视频为多附件宫格（点＋添加打开素材选择弹窗批量选取）。
 */
const emits = defineEmits(['success']);

const CheckableTag = Tag.CheckableTag;

/** 素材选择弹窗（system-common 联邦组件：文件管理式，可搜索/上传/多选） */
const MediaPickerModalComp = defineAsyncComponent(() =>
  import('system_common/components').then((m) => m.MediaPickerModal),
);

type ContentItem = MomentApi.WxMomentContent;
type MediaType = 'image' | 'video';

const corps = ref<CorpApi.WxCorpAuth[]>([]);

/** 发表成员下拉选项（所选企业的成员，来自 /scrm/contact/list） */
const members = ref<{ label: string; value: string }[]>([]);
const memberLoading = ref(false);

/** 部门树（来自 /scrm/contact/deptTree，按所选企业过滤） */
const deptTree = ref<ContactApi.DeptTreeNode[]>([]);
const deptLoading = ref(false);

/** 客户标签选项（所选企业的标签，来自 /scrm/tag/groupList） */
const tagGroups = ref<CorpTagApi.WxCorpTagGroup[]>([]);
const tagGroupLoading = ref(false);

/** 素材选择弹窗的目标内容类型 */
const pickerTargetType = ref('');

function onOpenMediaPicker(type: MediaType) {
  pickerTargetType.value = type;
  mediaPickerModalApi
    .setData({ accept: type, mediaLimits: MOMENT_MEDIA_LIMITS, multiple: true })
    .open();
}

/** 素材确认：该类型旧条目整组替换为所选文件（每个文件一条内容项） */
function onMediaConfirm(
  type: MediaType,
  files: Array<{ fileName: string; url: string }>,
) {
  contentList.value = contentList.value.filter((c) => c.msgType !== type);
  contentList.value.push(
    ...files.map((f) => ({
      filename: f.fileName,
      msgType: type,
      url: f.url,
    })),
  );
}

function removeMediaAttachment(type: MediaType, url: string) {
  contentList.value = contentList.value.filter(
    (c) => !(c.msgType === type && c.url === url),
  );
}

/** 某媒体类型已选文件的条目（空占位条目仅触发必填校验，不渲染） */
function itemsOfType(msgType: string) {
  return contentList.value.filter((c) => c.msgType === msgType && c.url);
}

const [MediaPickerModalView, mediaPickerModalApi] = useVbenModal({
  connectedComponent: MediaPickerModalComp,
  destroyOnClose: true,
});

async function loadMembers() {
  if (!form.corpId) {
    members.value = [];
    return;
  }
  memberLoading.value = true;
  try {
    const users = await getContactList({ corpId: form.corpId });
    members.value = (users ?? []).map((user) => ({
      label: user.name || user.userId || '',
      value: user.userId || '',
    }));
  } finally {
    memberLoading.value = false;
  }
}

async function loadDeptTree() {
  if (!form.corpId) {
    deptTree.value = [];
    return;
  }
  deptLoading.value = true;
  try {
    deptTree.value = (await getDeptTree()) ?? [];
  } finally {
    deptLoading.value = false;
  }
}

async function loadTags() {
  if (!form.corpId) {
    tagGroups.value = [];
    return;
  }
  tagGroupLoading.value = true;
  try {
    tagGroups.value = (await getTagGroupList({ corpId: form.corpId })) ?? [];
  } finally {
    tagGroupLoading.value = false;
  }
}

function onCorpChange() {
  visibleUserList.value = [];
  visibleDeptList.value = [];
  visibleTagList.value = [];
  loadMembers();
  loadDeptTree();
  loadTags();
}

const defaultForm = () => ({
  id: undefined as number | string | undefined,
  corpId: undefined as string | undefined,
  taskName: '',
  visibleType: 'all',
  status: 1,
  executeType: 'IMMEDIATE',
  cronExpression: '',
  scheduledTime: '',
});

const form = reactive(defaultForm());
const visibleUserList = ref<string[]>([]);
const visibleDeptList = ref<string[]>([]);
const visibleTagList = ref<string[]>([]);
const contentList = ref<ContentItem[]>([]);
const saving = ref(false);

/** 消息类型选项（computed 求值，保证运行时切换语言后文案更新） */
const MSG_TYPES = computed(() => [
  { label: $t('moment.msgTypeText'), value: 'text' },
  { label: $t('moment.msgTypeImage'), value: 'image' },
  { label: $t('moment.msgTypeVideo'), value: 'video' },
  { label: $t('moment.msgTypeLink'), value: 'link' },
]);

const corpOptions = computed(() =>
  corps.value.map((corp) => ({
    label: corp.corpName || corp.corpId,
    value: corp.corpId,
  })),
);

const visibleTypeOptions = computed(() => [
  { label: $t('moment.visibleAll'), value: 'all' },
  { label: $t('moment.visibleUser'), value: 'user' },
  { label: $t('moment.visibleDepartment'), value: 'department' },
  { label: $t('moment.visibleTag'), value: 'tag' },
]);

const statusOptions = computed(() => [
  { label: $t('moment.statusDisabled'), value: 0 },
  { label: $t('moment.statusEnabled'), value: 1 },
]);

const executeTypeOptions = computed(() => [
  { label: $t('moment.executeImmediate'), value: 'IMMEDIATE' },
  { label: $t('moment.executeOnce'), value: 'ONCE' },
  { label: $t('moment.executeDaily'), value: 'DAILY' },
  { label: $t('moment.executeWeekly'), value: 'WEEKLY' },
  { label: $t('moment.executeMonthly'), value: 'MONTHLY' },
  { label: $t('moment.executeCron'), value: 'CRON' },
]);

/** 部门树 → TreeSelect 选项（按所选企业过滤，扁平 id 串作为值） */
function mapDeptNodes(nodes: ContactApi.DeptTreeNode[]): Array<any> {
  return nodes
    .filter((node) => node.corpId === form.corpId)
    .map((node) => {
      const children = mapDeptNodes(node.children ?? []);
      return {
        children: children.length > 0 ? children : undefined,
        label: node.name || String(node.deptId),
        value: String(node.deptId),
      };
    });
}

const deptOptions = computed(() => mapDeptNodes(deptTree.value));

/** 客户标签选项（所有标签组的标签展平） */
const tagOptions = computed(() =>
  tagGroups.value.flatMap((group) =>
    (group.tagList ?? []).map((tag) => ({
      label: tag.tagName || '',
      value: tag.tagId || '',
    })),
  ),
);

/** 朋友圈内容类型的固定展示顺序（每种类型最多出现一次，取值与语言无关） */
const MSG_ORDER = ['text', 'image', 'video', 'link'];

function emptyContent(msgType: string): ContentItem {
  switch (msgType) {
    case 'link': {
      return { msgType, linkTitle: '', linkDesc: '', linkUrl: '' };
    }
    case 'text': {
      return { msgType, textContent: '' };
    }
    default: {
      return { msgType, url: '', filename: '' };
    }
  }
}

function hasContent(msgType: string) {
  return contentList.value.some((c) => c.msgType === msgType);
}

/** 点击类型标签：未添加则新增内容块，已添加则移除该类型全部条目 */
function toggleContent(msgType: string) {
  const exists = contentList.value.some((c) => c.msgType === msgType);
  if (exists) {
    // 图片/视频可有多条，移除时整组清掉
    contentList.value = contentList.value.filter((c) => c.msgType !== msgType);
    return;
  }
  contentList.value.push(emptyContent(msgType));
}

/** 内容块按固定类型顺序渲染 */
const sortedContents = computed(() =>
  MSG_ORDER.map((t) => contentList.value.find((c) => c.msgType === t)).filter(
    (c): c is ContentItem => !!c,
  ),
);

function msgTypeLabel(msgType: string) {
  return MSG_TYPES.value.find((t) => t.value === msgType)?.label ?? msgType;
}

function validate(): null | string {
  if (!form.corpId) return $t('moment.corpRequired');
  if (!form.taskName.trim()) return $t('moment.taskNameRequired');
  // 发表范围：user/department/tag 需要至少选择一个对象
  if (form.visibleType === 'user' && visibleUserList.value.length === 0) {
    return $t('moment.visibleRequired');
  }
  if (form.visibleType === 'department' && visibleDeptList.value.length === 0) {
    return $t('moment.visibleRequired');
  }
  if (form.visibleType === 'tag' && visibleTagList.value.length === 0) {
    return $t('moment.visibleRequired');
  }
  if (form.executeType === 'CRON' && !form.cronExpression.trim()) {
    return $t('moment.cronRequired');
  }
  if (contentList.value.length === 0) return $t('moment.contentRequired');
  const attachments = contentList.value.filter((c) => c.msgType !== 'text');
  if (attachments.length > 9) return $t('moment.attachmentMaxTip');
  // 文本与附件不能同时为空：文本留空时必须至少有一条附件
  const textItem = contentList.value.find((c) => c.msgType === 'text');
  if (!textItem?.textContent?.trim() && attachments.length === 0) {
    return $t('moment.contentBothEmpty');
  }
  for (const [index, content] of contentList.value.entries()) {
    const no = index + 1;
    if (['image', 'video'].includes(content.msgType) && !content.url?.trim()) {
      return $t('moment.contentItemRequired', [no]);
    }
    // 链接：标题与URL必填
    if (
      content.msgType === 'link' &&
      (!content.linkTitle?.trim() || !content.linkUrl?.trim())
    ) {
      return $t('moment.contentItemRequired', [no]);
    }
  }
  return null;
}

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const error = validate();
    if (error) {
      message.warning(error);
      return;
    }
    drawerApi.lock();
    saving.value = true;
    const payload: MomentApi.WxMomentTaskSaveReq = {
      id: form.id,
      corpId: form.corpId,
      taskName: form.taskName.trim(),
      visibleType: form.visibleType,
      // 后端按发表范围取对应的列表，其余传空数组
      visibleUserList: form.visibleType === 'user' ? visibleUserList.value : [],
      visibleDeptList:
        form.visibleType === 'department' ? visibleDeptList.value : [],
      visibleTagList: form.visibleType === 'tag' ? visibleTagList.value : [],
      status: form.status,
      executeType: form.executeType,
      cronExpression:
        form.executeType === 'CRON' ? form.cronExpression.trim() : '',
      scheduledTime: form.executeType === 'ONCE' ? form.scheduledTime : '',
      contentList: contentList.value
        // 文本留空视为未填写（有附件时不发送空文本条目）
        .filter((c) => c.msgType !== 'text' || !!c.textContent?.trim())
        .map((content) => ({
          ...content,
          // 附件排序按固定类型顺序
          sort: String(MSG_ORDER.indexOf(content.msgType)),
        })),
    };
    try {
      await saveMomentTask(payload);
      message.success($t('moment.saveSuccess'));
      emits('success');
      drawerApi.close();
    } catch {
      drawerApi.unlock();
    } finally {
      saving.value = false;
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    drawerApi.lock();
    try {
      if (corps.value.length === 0) {
        corps.value = await getCorpList();
      }
      const data = drawerApi.getData() as
        | MomentApi.WxMomentTask
        | null
        | undefined;
      Object.assign(form, defaultForm());
      visibleUserList.value = [];
      visibleDeptList.value = [];
      visibleTagList.value = [];
      contentList.value = [{ msgType: 'text', textContent: '' }];
      if (data?.id) {
        const detail = await getMomentTaskById(data.id);
        Object.assign(form, {
          id: detail.id,
          corpId: detail.corpId,
          taskName: detail.taskName ?? '',
          visibleType: detail.visibleType ?? 'all',
          status: detail.status ?? 1,
          executeType: detail.executeType ?? 'IMMEDIATE',
          cronExpression: detail.cronExpression ?? '',
          scheduledTime: detail.scheduledTime ?? '',
        });
        visibleUserList.value =
          detail.visibleType === 'user' ? (detail.visibleUserList ?? []) : [];
        visibleDeptList.value =
          detail.visibleType === 'department'
            ? (detail.visibleDeptList ?? [])
            : [];
        visibleTagList.value =
          detail.visibleType === 'tag' ? (detail.visibleTagList ?? []) : [];
        contentList.value =
          detail.contentList && detail.contentList.length > 0
            ? detail.contentList.map((content) => ({ ...content }))
            : [{ msgType: 'text', textContent: '' }];
        // 成员/部门/标签选项依赖企业，先加载
        await loadMembers();
        await loadDeptTree();
        await loadTags();
      }
    } finally {
      drawerApi.unlock();
    }
  },
});

defineExpose({ drawerApi });

const getDrawerTitle = computed(() =>
  form.id ? $t('moment.edit') : $t('moment.create'),
);
</script>
<template>
  <Drawer class="w-full max-w-160" :title="getDrawerTitle">
    <div class="mx-2 flex flex-col gap-5">
      <!-- 基本信息 -->
      <div class="flex flex-col gap-3">
        <div class="text-sm font-medium text-foreground">
          {{ $t('moment.basicTitle') }}
        </div>
        <div class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm text-muted-foreground">
            <span class="text-red-500">*</span>
            {{ $t('moment.corp') }}
          </span>
          <Select
            v-model:value="form.corpId"
            class="min-w-50 flex-1"
            :options="corpOptions"
            :placeholder="$t('moment.corpPlaceholder')"
            show-search
            option-filter-prop="label"
            @change="onCorpChange"
          />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm text-muted-foreground">
            <span class="text-red-500">*</span>
            {{ $t('moment.taskName') }}
          </span>
          <Input
            v-model:value="form.taskName"
            class="flex-1"
            :maxlength="50"
            :placeholder="$t('moment.taskNamePlaceholder')"
          />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm text-muted-foreground">
            {{ $t('moment.visibleType') }}
          </span>
          <RadioGroup
            v-model:value="form.visibleType"
            :options="visibleTypeOptions"
          />
        </div>
        <!-- 指定成员 -->
        <div v-if="form.visibleType === 'user'" class="flex items-start gap-3">
          <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
            <span class="text-red-500">*</span>
            {{ $t('moment.visibleUser') }}
          </span>
          <Select
            v-model:value="visibleUserList"
            class="flex-1"
            allow-clear
            :loading="memberLoading"
            mode="multiple"
            :options="members"
            :placeholder="$t('moment.userPlaceholder')"
            show-search
            option-filter-prop="label"
          />
        </div>
        <!-- 指定部门 -->
        <div
          v-if="form.visibleType === 'department'"
          class="flex items-start gap-3"
        >
          <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
            <span class="text-red-500">*</span>
            {{ $t('moment.visibleDepartment') }}
          </span>
          <TreeSelect
            v-model:value="visibleDeptList"
            allow-clear
            class="flex-1"
            :loading="deptLoading"
            multiple
            :placeholder="$t('moment.deptPlaceholder')"
            show-search
            :tree-data="deptOptions"
            tree-default-expand-all
            tree-node-filter-prop="label"
            :max-tag-count="3"
          />
        </div>
        <!-- 指定客户标签 -->
        <div v-if="form.visibleType === 'tag'" class="flex items-start gap-3">
          <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
            <span class="text-red-500">*</span>
            {{ $t('moment.visibleTag') }}
          </span>
          <Select
            v-model:value="visibleTagList"
            class="flex-1"
            allow-clear
            :loading="tagGroupLoading"
            :max-tag-count="3"
            mode="multiple"
            :options="tagOptions"
            :placeholder="$t('moment.tagPlaceholder')"
            show-search
            option-filter-prop="label"
          />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm text-muted-foreground">
            {{ $t('moment.status') }}
          </span>
          <RadioGroup v-model:value="form.status" :options="statusOptions" />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm text-muted-foreground">
            {{ $t('moment.executeType') }}
          </span>
          <Select
            v-model:value="form.executeType"
            class="min-w-50 flex-1"
            :options="executeTypeOptions"
          />
        </div>
        <div v-if="form.executeType === 'ONCE'" class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm text-muted-foreground">
            {{ $t('moment.scheduledTime') }}
          </span>
          <DatePicker
            v-model:value="form.scheduledTime"
            class="flex-1"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            :placeholder="$t('moment.scheduledTime')"
          />
        </div>
        <div v-if="form.executeType === 'CRON'" class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm text-muted-foreground">
            <span class="text-red-500">*</span>
            {{ $t('moment.cronExpression') }}
          </span>
          <Input
            v-model:value="form.cronExpression"
            class="flex-1"
            :placeholder="$t('moment.cronTip')"
          />
        </div>
      </div>

      <!-- 朋友圈内容：每种类型只能出现一次，点击类型标签添加/移除 -->
      <div class="flex flex-col gap-3 border-t border-border pt-4">
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-foreground">
            <span class="text-red-500">*</span>
            {{ $t('moment.contentTitle') }}
          </span>
          <span class="text-xs text-muted-foreground">
            {{ $t('moment.contentUnique') }}
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <CheckableTag
            v-for="t in MSG_TYPES"
            :key="t.value"
            :checked="hasContent(t.value)"
            @change="() => toggleContent(t.value)"
          >
            {{ t.label }}
          </CheckableTag>
        </div>
        <div
          v-for="content in sortedContents"
          :key="content.msgType"
          class="flex flex-col gap-2 rounded-md border border-border p-3"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm font-medium text-foreground">
              {{ msgTypeLabel(content.msgType) }}
            </span>
            <Button
              danger
              size="small"
              type="text"
              @click="toggleContent(content.msgType)"
            >
              ✕
            </Button>
          </div>
          <div
            v-if="['image', 'video'].includes(content.msgType)"
            class="text-xs text-muted-foreground"
          >
            {{ momentMediaHint(content.msgType as 'image' | 'video') }}
          </div>
          <TextArea
            v-if="content.msgType === 'text'"
            v-model:value="content.textContent"
            :auto-size="{ minRows: 3, maxRows: 6 }"
            :placeholder="$t('moment.textContent')"
          />
          <!-- 链接：标题/描述/URL（标题与URL必填） -->
          <div v-if="content.msgType === 'link'" class="flex flex-col gap-2">
            <div class="flex items-center gap-3">
              <span class="w-28 shrink-0 text-sm text-muted-foreground">
                <span class="text-red-500">*</span>
                {{ $t('moment.linkTitle') }}
              </span>
              <Input
                v-model:value="content.linkTitle"
                class="flex-1"
                :placeholder="$t('moment.linkTitlePlaceholder')"
              />
            </div>
            <div class="flex items-center gap-3">
              <span class="w-28 shrink-0 text-sm text-muted-foreground">
                {{ $t('moment.linkDesc') }}
              </span>
              <Input
                v-model:value="content.linkDesc"
                class="flex-1"
                :placeholder="$t('moment.linkDescPlaceholder')"
              />
            </div>
            <div class="flex items-center gap-3">
              <span class="w-28 shrink-0 text-sm text-muted-foreground">
                <span class="text-red-500">*</span>
                {{ $t('moment.linkUrl') }}
              </span>
              <Input
                v-model:value="content.linkUrl"
                class="flex-1"
                :placeholder="$t('moment.linkUrlPlaceholder')"
              />
            </div>
          </div>
          <!-- 图片/视频：缩略图宫格 + ＋添加 tile -->
          <template v-if="['image', 'video'].includes(content.msgType)">
            <div class="flex flex-col gap-2">
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="item in itemsOfType(content.msgType)"
                  :key="item.url"
                  class="group relative size-20 overflow-hidden rounded-md border"
                >
                  <img
                    v-if="content.msgType === 'image'"
                    :src="item.url"
                    class="size-full object-cover"
                  />
                  <div
                    v-else
                    class="flex size-full items-center justify-center bg-gray-100 dark:bg-gray-800"
                  >
                    <IconifyIcon
                      icon="lucide:video"
                      class="size-8 opacity-40"
                    />
                  </div>
                  <!-- 绿色 ✓ -->
                  <div
                    class="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-green-500 text-white"
                  >
                    <IconifyIcon icon="lucide:check" class="size-3" />
                  </div>
                  <!-- 悬停删除 -->
                  <div
                    class="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex"
                  >
                    <Button
                      danger
                      size="small"
                      type="text"
                      @click="
                        removeMediaAttachment(
                          content.msgType as MediaType,
                          item.url ?? '',
                        )
                      "
                    >
                      <IconifyIcon
                        icon="lucide:trash-2"
                        class="size-4 text-white"
                      />
                    </Button>
                  </div>
                </div>
                <!-- ＋添加 tile -->
                <div
                  class="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  @click="onOpenMediaPicker(content.msgType as MediaType)"
                >
                  <IconifyIcon icon="lucide:plus" class="size-5" />
                  <span class="text-xs">{{ $t('moment.addMedia') }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
      <!-- 素材选择弹窗（system-common 联邦组件，multiple 模式回传数组） -->
      <MediaPickerModalView
        @select="
          (files: Array<{ fileName: string; url: string }>) =>
            onMediaConfirm(pickerTargetType as MediaType, files)
        "
      />
    </div>
  </Drawer>
</template>
