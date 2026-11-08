<script lang="ts" setup>
import type { ContactApi, CorpApi, CorpTagApi, WelcomeApi } from '#/api';

import { computed, defineAsyncComponent, h, reactive, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  CheckboxGroup,
  Empty,
  Input,
  message,
  Modal,
  Select,
  Switch,
  TabPane,
  Tabs,
  Tag,
  TextArea,
  TimeRangePicker,
  TreeSelect,
} from 'antdv-next';

import {
  checkWelcomeBindConflicts,
  getContactList,
  getCorpList,
  getDeptTree,
  getTagGroupList,
  getWelcomeMsgById,
  saveWelcomeMsg,
} from '#/api';
import { WECOM_MEDIA_LIMITS } from '#/constants/media-limits';
import { $t } from '#/locales';

const props = defineProps<{
  defaultCorpId?: string;
  isNew?: boolean;
  msgId?: number | string;
}>();

const emits = defineEmits<{ saved: [] }>();

const CheckableTag = Tag.CheckableTag;

/** 素材选择弹窗（system-common 联邦组件，单选模式回传单个文件） */
const MediaPickerModalComp = defineAsyncComponent(() =>
  import('system_common/components').then((m) => m.MediaPickerModal),
);

const [MediaPickerModalView, mediaPickerModalApi] = useVbenModal({
  connectedComponent: MediaPickerModalComp,
  destroyOnClose: true,
});

type ContentItem = WelcomeApi.WelcomeContentItem;
type MediaType = 'image' | 'video';

/** 分时规则（欢迎语即规则列表：内容 + 生效时间，全天生效的规则兜底） */
interface RuleDraft {
  allDay: boolean;
  content: ContentItem[];
  effectiveAt: number[];
  endTime?: string;
  name: string;
  startTime?: string;
}

// ==================== 状态 ====================
const loading = ref(false);
const saving = ref(false);
const activeTab = ref('rules');

const corps = ref<CorpApi.WxCorpAuth[]>([]);
const form = reactive({
  corpId: undefined as string | undefined,
  name: '',
});
const rules = ref<RuleDraft[]>([]);
const bindUserIds = ref<string[]>([]);
const bindDeptIds = ref<string[]>([]);

const memberRows = ref<ContactApi.WxUser[]>([]);
const memberLoading = ref(false);
const deptTree = ref<ContactApi.DeptTreeNode[]>([]);
const deptLoading = ref(false);
const tagGroups = ref<CorpTagApi.WxCorpTagGroup[]>([]);

const pickerTargetType = ref('');
/** 素材选择目标：true 表示正在为小程序内容项选择封面图 */
const pickingMpCover = ref(false);

// 规则编辑弹窗
const [RuleModal, ruleModalApi] = useVbenModal({
  closeOnClickModal: false,
  onConfirm: onRuleConfirm,
});
const ruleEditingIndex = ref<number>();
const ruleDraft = reactive<RuleDraft>({
  allDay: false,
  content: [],
  effectiveAt: [1, 2, 3, 4, 5],
  endTime: '18:00:00',
  name: '',
  startTime: '09:00:00',
});

// 预览：自动跟随分时规则（无用户选择项）

const corpOptions = computed(() =>
  corps.value.map((corp) => ({
    label: corp.corpName || corp.corpId,
    value: corp.corpId,
  })),
);

const memberOptions = computed(() =>
  memberRows.value.map((user) => ({
    label: user.name || user.userId || '',
    value: String(user.id),
  })),
);

const weekdayOptions = computed(() => [
  { label: $t('welcome.weekday1'), value: 1 },
  { label: $t('welcome.weekday2'), value: 2 },
  { label: $t('welcome.weekday3'), value: 3 },
  { label: $t('welcome.weekday4'), value: 4 },
  { label: $t('welcome.weekday5'), value: 5 },
  { label: $t('welcome.weekday6'), value: 6 },
  { label: $t('welcome.weekday7'), value: 7 },
]);

const weekdayLabel = computed(() =>
  Object.fromEntries(weekdayOptions.value.map((o) => [o.value, o.label])),
);

// ==================== 规则内容编辑（弹窗内） ====================
const MSG_TYPES = computed(() => [
  { label: $t('welcome.msgTypeText'), value: 'text' },
  { label: $t('welcome.msgTypeImage'), value: 'image' },
  { label: $t('welcome.msgTypeVideo'), value: 'video' },
  { label: $t('welcome.msgTypeFile'), value: 'file' },
  { label: $t('welcome.msgTypeLink'), value: 'link' },
  { label: $t('welcome.msgTypeMiniprogram'), value: 'miniprogram' },
]);

/** 内容类型的固定展示顺序（取值与语言无关） */
const MSG_ORDER = ['text', 'image', 'video', 'file', 'link', 'miniprogram'];

const draftContents = computed(() =>
  MSG_ORDER.map((t) => ruleDraft.content.find((c) => c.msgType === t)).filter(
    (c): c is ContentItem => !!c,
  ),
);

function hasDraftContent(msgType: string) {
  return ruleDraft.content.some((c) => c.msgType === msgType);
}

function emptyContent(msgType: string): ContentItem {
  switch (msgType) {
    case 'link': {
      return { linkTitle: '', linkUrl: '', msgType };
    }
    case 'miniprogram': {
      return { mpAppid: '', mpPage: '', mpTitle: '', msgType, url: '' };
    }
    case 'text': {
      return { msgType, textContent: '' };
    }
    default: {
      return { filename: '', msgType, url: '' };
    }
  }
}

function toggleDraftContent(msgType: string) {
  const exists = ruleDraft.content.some((c) => c.msgType === msgType);
  if (exists) {
    ruleDraft.content = ruleDraft.content.filter((c) => c.msgType !== msgType);
    return;
  }
  ruleDraft.content.push(emptyContent(msgType));
}

function onOpenMediaPicker(type: MediaType) {
  pickingMpCover.value = false;
  pickerTargetType.value = type;
  mediaPickerModalApi
    .setData({ accept: type, mediaLimits: WECOM_MEDIA_LIMITS, multiple: false })
    .open();
}

/** 小程序封面选择：图片页签，回填到小程序内容项的封面字段 */
function onOpenMpCoverPicker() {
  pickingMpCover.value = true;
  pickerTargetType.value = 'image';
  mediaPickerModalApi
    .setData({
      accept: 'image',
      mediaLimits: WECOM_MEDIA_LIMITS,
      multiple: false,
    })
    .open();
}

function onMediaConfirm(
  type: MediaType,
  files:
    | Array<{ fileName: string; url: string }>
    | { fileName: string; url: string },
) {
  const list = Array.isArray(files) ? files : [files];
  const first = list[0];
  if (!first) return;
  // 小程序封面：回填到 miniprogram 内容项
  if (pickingMpCover.value) {
    pickingMpCover.value = false;
    const item = ruleDraft.content.find((c) => c.msgType === 'miniprogram');
    if (item) {
      item.filename = first.fileName;
      item.url = first.url;
    }
    return;
  }
  let item = ruleDraft.content.find((c) => c.msgType === type);
  if (!item) {
    item = emptyContent(type);
    ruleDraft.content.push(item);
  }
  item.filename = first.fileName;
  item.url = first.url;
}

function clearMediaFile(content: ContentItem) {
  content.url = '';
  content.filename = '';
}

function msgTypeLabel(msgType: string) {
  return MSG_TYPES.value.find((t) => t.value === msgType)?.label ?? msgType;
}

/** 媒体限制提示文案（由企微限制常量生成） */
function mediaHint(type: MediaType) {
  const rule = WECOM_MEDIA_LIMITS[type];
  if (!rule) return '';
  const formats = rule.formats?.map((format) => format.toUpperCase()).join('/');
  const maxText = `${rule.maxBytes / 1024 / 1024}MB`;
  return formats
    ? $t('welcome.mediaHintFormats', [formats, maxText])
    : $t('welcome.mediaHintMax', [maxText]);
}

/** 规则内容按固定类型顺序排列（文本 → 图片 → 视频 → 链接），与发送顺序一致 */
function sortedRuleContent(content: ContentItem[]) {
  return [...content].toSorted(
    (a, b) => MSG_ORDER.indexOf(a.msgType) - MSG_ORDER.indexOf(b.msgType),
  );
}

// ==================== 规则增删改 ====================
function onAddRule() {
  ruleEditingIndex.value = undefined;
  Object.assign(ruleDraft, {
    allDay: false,
    content: [{ msgType: 'text', textContent: '' }],
    effectiveAt: [1, 2, 3, 4, 5],
    endTime: '18:00:00',
    name: $t('welcome.timeItemName', [rules.value.length + 1]),
    startTime: '09:00:00',
  });
  ruleModalApi.setState({
    title:
      ruleEditingIndex.value === undefined
        ? $t('welcome.ruleAdd')
        : $t('welcome.ruleEdit'),
  });
  ruleModalApi.open();
}

function onEditRule(index: number) {
  const src = rules.value[index];
  if (!src) return;
  ruleEditingIndex.value = index;
  Object.assign(ruleDraft, {
    allDay: src.allDay,
    content: src.content.map((c) => ({ ...c })),
    effectiveAt: [...src.effectiveAt],
    endTime: src.endTime,
    name: src.name,
    startTime: src.startTime,
  });
  ruleModalApi.setState({
    title:
      ruleEditingIndex.value === undefined
        ? $t('welcome.ruleAdd')
        : $t('welcome.ruleEdit'),
  });
  ruleModalApi.open();
}

function onCopyRule(index: number) {
  const src = rules.value[index];
  if (!src) return;
  rules.value.splice(index + 1, 0, {
    allDay: src.allDay,
    content: src.content.map((c) => ({ ...c })),
    effectiveAt: [...src.effectiveAt],
    endTime: src.endTime,
    name: `${src.name}${$t('welcome.ruleCopySuffix')}`,
    startTime: src.startTime,
  });
}

function onRemoveRule(index: number) {
  rules.value.splice(index, 1);
}

/** 分时段规则时间是否重叠（存在共同星期且时间区间相交） */
function ruleOverlap(a: RuleDraft, b: RuleDraft): boolean {
  const dayHit = a.effectiveAt.some((day) => b.effectiveAt.includes(day));
  return (
    dayHit &&
    !!a.startTime &&
    !!a.endTime &&
    !!b.startTime &&
    !!b.endTime &&
    a.startTime < b.endTime &&
    b.startTime < a.endTime
  );
}

/** 同类规则时间段重叠即冲突（全天生效与分时段为兜底关系、允许共存） */
function findConflict(rule: RuleDraft, skipIndex: number) {
  return rules.value.find(
    (other, i) =>
      i !== skipIndex &&
      other.allDay === rule.allDay &&
      ruleOverlap(rule, other),
  );
}

function onRuleConfirm() {
  if (ruleDraft.content.length === 0) {
    message.warning($t('welcome.contentRequired'));
    return;
  }
  for (const item of ruleDraft.content) {
    if (item.msgType === 'text' && !item.textContent?.trim()) {
      message.warning($t('welcome.contentItemRequired'));
      return;
    }
    if (
      ['file', 'image', 'video'].includes(item.msgType) &&
      !item.url?.trim()
    ) {
      message.warning($t('welcome.contentItemRequired'));
      return;
    }
    if (
      item.msgType === 'link' &&
      (!item.linkTitle?.trim() || !item.linkUrl?.trim())
    ) {
      message.warning($t('welcome.contentItemRequired'));
      return;
    }
    if (
      item.msgType === 'miniprogram' &&
      (!item.mpTitle?.trim() ||
        !item.mpAppid?.trim() ||
        !item.mpPage?.trim() ||
        !item.url?.trim())
    ) {
      message.warning($t('welcome.contentItemRequired'));
      return;
    }
  }
  if (!ruleDraft.allDay) {
    if (ruleDraft.effectiveAt.length === 0) {
      message.warning($t('welcome.timeItemWeekdayRequired', ['']));
      return;
    }
    if (
      !ruleDraft.startTime ||
      !ruleDraft.endTime ||
      ruleDraft.startTime >= ruleDraft.endTime
    ) {
      message.warning($t('welcome.timeItemRangeRequired', ['']));
      return;
    }
  }
  const draft: RuleDraft = {
    allDay: ruleDraft.allDay,
    content: ruleDraft.content.map((c) => ({ ...c })),
    effectiveAt: ruleDraft.allDay
      ? [1, 2, 3, 4, 5, 6, 7]
      : [...ruleDraft.effectiveAt],
    endTime: ruleDraft.allDay ? '23:59:59' : ruleDraft.endTime,
    name: ruleDraft.name.trim(),
    startTime: ruleDraft.allDay ? '00:00:00' : ruleDraft.startTime,
  };
  // 同类规则时间段不得重叠
  const conflict = findConflict(draft, ruleEditingIndex.value ?? -1);
  if (conflict) {
    message.warning($t('welcome.ruleConflict', [draft.name, conflict.name]));
    return;
  }
  if (ruleEditingIndex.value === undefined) {
    rules.value.push(draft);
  } else {
    rules.value.splice(ruleEditingIndex.value, 1, draft);
  }
  ruleModalApi.close();
}

// ==================== 选项加载 ====================
async function loadMembers() {
  if (!form.corpId) {
    memberRows.value = [];
    return;
  }
  memberLoading.value = true;
  try {
    memberRows.value = (await getContactList({ corpId: form.corpId })) ?? [];
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
  tagGroups.value = (await getTagGroupList({ corpId: form.corpId })) ?? [];
}

/** 新建态切换企业：绑定对象随企业失效，清空 */
function onCorpChange() {
  bindUserIds.value = [];
  bindDeptIds.value = [];
}

/** 部门树 → TreeSelect 选项（按所选企业过滤，取 wx_department.id） */
function mapDeptNodes(nodes: ContactApi.DeptTreeNode[]): Array<any> {
  return nodes
    .filter((node) => node.corpId === form.corpId)
    .map((node) => {
      const children = mapDeptNodes(node.children ?? []);
      return {
        children: children.length > 0 ? children : undefined,
        label: node.name || String(node.id),
        value: String(node.id),
      };
    });
}

const deptOptions = computed(() => mapDeptNodes(deptTree.value));

// ==================== 加载与保存 ====================
/** 子项 → 全天生效判定（全星期 + 00:00:00~23:59:59） */
function toRule(item: WelcomeApi.WelcomeTimeItem, index: number): RuleDraft {
  const allDay =
    (item.effectiveAt?.length ?? 0) === 7 &&
    item.startTime === '00:00:00' &&
    item.endTime === '23:59:59';
  return {
    allDay,
    content: (item.content ?? []).map((c) => ({ ...c })),
    effectiveAt: item.effectiveAt ?? [],
    endTime: item.endTime,
    name: item.name || $t('welcome.timeItemName', [index + 1]),
    startTime: item.startTime,
  };
}

async function loadDetail() {
  activeTab.value = 'rules';
  if (props.isNew) {
    if (corps.value.length === 0) {
      corps.value = (await getCorpList()) ?? [];
    }
    form.corpId = props.defaultCorpId;
    form.name = '';
    rules.value = [];
    bindUserIds.value = [];
    bindDeptIds.value = [];
    await loadMembers();
    await loadDeptTree();
    await loadTags();
    return;
  }
  if (!props.msgId) return;
  loading.value = true;
  try {
    if (corps.value.length === 0) {
      corps.value = (await getCorpList()) ?? [];
    }
    const detail = await getWelcomeMsgById(props.msgId);
    form.corpId = detail.corpId;
    form.name = detail.name ?? '';
    rules.value = (detail.timeItems ?? []).map((item, index) =>
      toRule(item, index),
    );
    bindUserIds.value = (detail.binds ?? [])
      .filter((bind) => bind.targetType === 1)
      .map((bind) => String(bind.targetId));
    bindDeptIds.value = (detail.binds ?? [])
      .filter((bind) => bind.targetType === 2)
      .map((bind) => String(bind.targetId));
    await loadMembers();
    await loadDeptTree();
    await loadTags();
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.msgId, props.isNew] as const,
  () => {
    loadDetail();
  },
  { immediate: true },
);

watch(
  () => form.corpId,
  () => {
    loadMembers();
    loadDeptTree();
    loadTags();
  },
);

// ==================== 校验与保存 ====================
function validate(): null | string {
  if (!form.corpId) return $t('welcome.corpRequired');
  if (!form.name.trim()) return $t('welcome.nameRequired');
  if (rules.value.length === 0) return $t('welcome.ruleRequired');
  for (const rule of rules.value) {
    if (rule.content.length === 0) {
      return $t('welcome.contentRequired');
    }
    for (const item of rule.content) {
      if (item.msgType === 'text' && !item.textContent?.trim()) {
        return $t('welcome.contentItemRequired');
      }
      if (['image', 'video'].includes(item.msgType) && !item.url?.trim()) {
        return $t('welcome.contentItemRequired');
      }
      if (
        item.msgType === 'link' &&
        (!item.linkTitle?.trim() || !item.linkUrl?.trim())
      ) {
        return $t('welcome.contentItemRequired');
      }
    }
    if (!rule.allDay) {
      if (rule.effectiveAt.length === 0) {
        return $t('welcome.timeItemWeekdayRequired', ['']);
      }
      if (!rule.startTime || !rule.endTime || rule.startTime >= rule.endTime) {
        return $t('welcome.timeItemRangeRequired', ['']);
      }
    }
  }
  for (const [index, rule] of rules.value.entries()) {
    const conflict = findConflict(rule, index);
    if (conflict) {
      return $t('welcome.ruleConflict', [rule.name, conflict.name]);
    }
  }
  return null;
}

function buildPayload(forceBind: boolean): WelcomeApi.WxWelcomeMsgSaveReq {
  return {
    id: props.isNew ? undefined : props.msgId,
    corpId: form.corpId,
    name: form.name.trim(),
    timeItems: rules.value.map((rule, index) => ({
      name: rule.name.trim(),
      effectiveAt: rule.allDay ? [1, 2, 3, 4, 5, 6, 7] : rule.effectiveAt,
      startTime: rule.allDay ? '00:00:00' : rule.startTime,
      endTime: rule.allDay ? '23:59:59' : rule.endTime,
      content: sortedRuleContent(rule.content).map((c) => ({ ...c })),
      sort: index,
    })),
    binds: [
      ...bindUserIds.value.map((id) => ({ targetId: id, targetType: 1 })),
      ...bindDeptIds.value.map((id) => ({ targetId: id, targetType: 2 })),
    ],
    forceBind,
  };
}

async function doSave(forceBind: boolean) {
  await saveWelcomeMsg(buildPayload(forceBind));
}

async function onSave() {
  const error = validate();
  if (error) {
    message.warning(error);
    return;
  }
  saving.value = true;
  try {
    // 绑定冲突预检（正常请求，无错误 toast）：有冲突则弹窗逐条展示，
    // 确认「改绑并保存」后带 forceBind 重试
    const conflicts = await checkWelcomeBindConflicts(buildPayload(false));
    if (conflicts.length > 0) {
      Modal.confirm({
        content: h(
          'div',
          { class: 'flex flex-col gap-1' },
          conflicts.map((text) => h('div', text)),
        ),
        okText: $t('welcome.bindForceOk'),
        title: $t('welcome.bindConflictTitle'),
        onOk: async () => {
          try {
            await doSave(true);
            message.success($t('welcome.saveSuccess'));
            emits('saved');
          } finally {
            saving.value = false;
          }
        },
        onCancel() {
          saving.value = false;
        },
      });
      return;
    }
    await doSave(false);
    message.success($t('welcome.saveSuccess'));
    emits('saved');
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <!-- 空态：未选择欢迎语且非新建 -->
  <div v-if="!isNew && !msgId" class="flex h-full items-center justify-center">
    <Empty
      :description="$t('welcome.selectTip')"
      :image="Empty.PRESENTED_IMAGE_SIMPLE"
    />
  </div>
  <div v-else class="flex h-full min-h-0 flex-col">
    <!-- 头部：企业（仅新建，必填）/ 标题（必填）/ 保存 -->
    <div class="flex items-center gap-3 border-b border-border px-4 py-3">
      <span v-if="isNew" class="shrink-0 text-sm text-muted-foreground">
        <span class="text-red-500">*</span>
        {{ $t('welcome.corp') }}
      </span>
      <Select
        v-if="isNew"
        v-model:value="form.corpId"
        class="w-55"
        :options="corpOptions"
        :placeholder="$t('welcome.corpPlaceholder')"
        show-search
        option-filter-prop="label"
        @change="onCorpChange"
      />
      <Tag v-else class="shrink-0" color="default">
        {{
          corpOptions.find((corp) => corp.value === form.corpId)?.label ??
          form.corpId
        }}
      </Tag>
      <span class="shrink-0 text-sm text-muted-foreground">
        <span class="text-red-500">*</span>
        {{ $t('welcome.name') }}
      </span>
      <Input
        v-model:value="form.name"
        class="max-w-65 flex-1"
        :maxlength="50"
        :placeholder="$t('welcome.namePlaceholder')"
      />
      <Button class="ml-auto" :loading="saving" type="primary" @click="onSave">
        {{ $t('welcome.save') }}
      </Button>
    </div>

    <!-- 页签：分时规则 / 绑定范围 -->
    <div class="min-h-0 flex-1 overflow-auto px-4 py-3">
      <Tabs v-model:active-key="activeTab">
        <!-- 分时规则（欢迎语即规则列表） -->
        <TabPane key="rules" :tab="$t('welcome.tabRules')">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <span class="text-xs text-muted-foreground">
                {{ $t('welcome.ruleOrderTip') }}
              </span>
              <Button
                class="ml-auto"
                size="small"
                type="primary"
                @click="onAddRule"
              >
                {{ $t('welcome.ruleAdd') }}
              </Button>
            </div>
            <div
              v-if="rules.length === 0"
              class="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground"
            >
              {{ $t('welcome.ruleListEmpty') }}
            </div>
            <div
              v-for="(rule, index) in rules"
              :key="index"
              class="flex flex-col gap-2 rounded-md border border-border p-3"
            >
              <div class="flex items-center gap-2">
                <span
                  class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
                >
                  {{ index + 1 }}
                </span>
                <span class="font-medium">{{ rule.name }}</span>
                <Tag v-if="rule.allDay" class="mr-0" color="success">
                  {{ $t('welcome.ruleAllDay') }}
                </Tag>
                <div class="ml-auto flex items-center gap-1">
                  <Button size="small" @click="onEditRule(index)">
                    {{ $t('welcome.ruleEdit') }}
                  </Button>
                  <Button size="small" @click="onCopyRule(index)">
                    {{ $t('welcome.ruleCopy') }}
                  </Button>
                  <Button danger size="small" @click="onRemoveRule(index)">
                    {{ $t('common.delete') }}
                  </Button>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-1 pl-8">
                <template v-if="!rule.allDay">
                  <Tag
                    v-for="day in rule.effectiveAt"
                    :key="day"
                    class="mr-0"
                    color="blue"
                  >
                    {{ weekdayLabel[day] }}
                  </Tag>
                  <span class="text-xs text-muted-foreground">
                    {{ rule.startTime }} ~ {{ rule.endTime }}
                  </span>
                </template>
                <span v-else class="text-xs text-muted-foreground">
                  {{ $t('welcome.ruleAllDayTip') }}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-2 pl-8">
                <template
                  v-for="item in sortedRuleContent(rule.content)"
                  :key="item.msgType"
                >
                  <!-- 文本 -->
                  <span
                    v-if="item.msgType === 'text' && item.textContent?.trim()"
                    class="max-w-56 truncate text-xs"
                    :title="item.textContent"
                  >
                    {{ item.textContent }}
                  </span>
                  <!-- 图片：真实缩略图 -->
                  <img
                    v-else-if="item.msgType === 'image' && item.url"
                    :alt="item.filename"
                    class="size-10 rounded border border-border object-cover"
                    :src="item.url"
                  />
                  <!-- 视频 -->
                  <span
                    v-else-if="item.msgType === 'video' && item.url"
                    class="flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <IconifyIcon class="size-4" icon="lucide:video" />
                    {{ $t('welcome.msgTypeVideo') }}
                  </span>
                  <!-- 链接 -->
                  <span
                    v-else-if="item.msgType === 'link'"
                    class="flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <IconifyIcon class="size-3" icon="lucide:link" />
                    {{ item.linkTitle }}
                  </span>
                  <!-- 文件 -->
                  <span
                    v-else-if="item.msgType === 'file' && item.url"
                    class="flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <IconifyIcon class="size-4" icon="lucide:file-text" />
                    {{ item.filename || $t('welcome.msgTypeFile') }}
                  </span>
                  <!-- 小程序 -->
                  <span
                    v-else-if="item.msgType === 'miniprogram'"
                    class="flex items-center gap-1 text-xs text-muted-foreground"
                  >
                    <IconifyIcon class="size-4" icon="lucide:app-window" />
                    {{ item.mpTitle }}
                  </span>
                </template>
              </div>
            </div>
          </div>
        </TabPane>

        <!-- 绑定范围 -->
        <TabPane key="bind" :tab="$t('welcome.tabBind')">
          <div class="flex flex-col gap-4">
            <div class="flex items-start gap-3">
              <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
                {{ $t('welcome.bindUser') }}
              </span>
              <Select
                v-model:value="bindUserIds"
                class="flex-1"
                allow-clear
                :loading="memberLoading"
                :max-tag-count="5"
                mode="multiple"
                :options="memberOptions"
                :placeholder="$t('welcome.bindUserPlaceholder')"
                show-search
                option-filter-prop="label"
              />
            </div>
            <div class="flex items-start gap-3">
              <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
                {{ $t('welcome.bindDept') }}
              </span>
              <TreeSelect
                v-model:value="bindDeptIds"
                allow-clear
                class="flex-1"
                :loading="deptLoading"
                :max-tag-count="5"
                multiple
                :placeholder="$t('welcome.bindDeptPlaceholder')"
                show-search
                :tree-data="deptOptions"
                tree-default-expand-all
                tree-node-filter-prop="label"
              />
            </div>
            <div class="text-xs text-muted-foreground">
              {{ $t('welcome.bindTip') }}
            </div>
          </div>
        </TabPane>
      </Tabs>
    </div>

    <!-- 素材选择弹窗（system-common 联邦组件，单选模式回传单个文件） -->
    <MediaPickerModalView
      @select="
        (
          files:
            | Array<{ fileName: string; url: string }>
            | { fileName: string; url: string },
        ) => onMediaConfirm(pickerTargetType as MediaType, files)
      "
    />

    <!-- 分时规则编辑弹窗 -->
    <RuleModal class="w-[560px]">
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm text-muted-foreground">
            {{ $t('welcome.ruleName') }}
          </span>
          <Input
            v-model:value="ruleDraft.name"
            class="flex-1"
            :maxlength="30"
            :placeholder="$t('welcome.timeItemNamePlaceholder')"
          />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm text-muted-foreground">
            {{ $t('welcome.ruleAllDay') }}
          </span>
          <Switch
            :checked="ruleDraft.allDay"
            @change="
              (checked: any) => {
                ruleDraft.allDay = checked ? true : false;
              }
            "
          />
          <span class="text-xs text-muted-foreground">
            {{ $t('welcome.ruleAllDayTip') }}
          </span>
        </div>
        <template v-if="!ruleDraft.allDay">
          <div class="flex items-start gap-3">
            <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
              {{ $t('welcome.effectiveAt') }}
            </span>
            <CheckboxGroup
              v-model:value="ruleDraft.effectiveAt"
              :options="weekdayOptions"
            />
          </div>
          <div class="flex items-center gap-3">
            <span class="w-20 shrink-0 text-sm text-muted-foreground">
              {{ $t('welcome.timeRange') }}
            </span>
            <TimeRangePicker
              :value="
                ruleDraft.startTime && ruleDraft.endTime
                  ? [ruleDraft.startTime, ruleDraft.endTime]
                  : undefined
              "
              value-format="HH:mm:ss"
              @change="
                (_dates: any, dateStrings: string[]) => {
                  if (dateStrings && dateStrings.length === 2) {
                    ruleDraft.startTime = dateStrings[0];
                    ruleDraft.endTime = dateStrings[1];
                  } else {
                    ruleDraft.startTime = undefined;
                    ruleDraft.endTime = undefined;
                  }
                }
              "
            />
          </div>
        </template>
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">
            <span class="text-red-500">*</span>
            {{ $t('welcome.ruleContent') }}
          </span>
          <div class="flex flex-wrap items-center gap-1">
            <CheckableTag
              v-for="t in MSG_TYPES"
              :key="t.value"
              :checked="hasDraftContent(t.value)"
              @change="() => toggleDraftContent(t.value)"
            >
              {{ t.label }}
            </CheckableTag>
          </div>
          <div class="flex flex-col gap-2">
            <template v-for="content in draftContents" :key="content.msgType">
              <!-- 文本 -->
              <div
                v-if="content.msgType === 'text'"
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
                    @click="toggleDraftContent(content.msgType)"
                  >
                    ✕
                  </Button>
                </div>
                <TextArea
                  v-model:value="content.textContent"
                  :auto-size="{ minRows: 3, maxRows: 6 }"
                  :placeholder="$t('welcome.textContent')"
                />
              </div>
              <!-- 图片/视频/文件（单文件）：宫格样式 -->
              <div
                v-else-if="['image', 'video', 'file'].includes(content.msgType)"
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
                    @click="toggleDraftContent(content.msgType)"
                  >
                    ✕
                  </Button>
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ mediaHint(content.msgType as MediaType) }}
                </div>
                <div class="flex flex-col gap-2">
                  <div class="flex flex-wrap gap-2">
                    <div
                      v-if="content.url"
                      class="group relative size-20 overflow-hidden rounded-md border"
                    >
                      <img
                        v-if="content.msgType === 'image' && content.url"
                        :src="content.url"
                        class="size-full object-cover"
                      />
                      <div
                        v-else
                        class="flex size-full items-center justify-center bg-gray-100 dark:bg-gray-800"
                      >
                        <IconifyIcon
                          :icon="
                            content.msgType === 'video'
                              ? 'lucide:video'
                              : 'lucide:file-text'
                          "
                          class="size-8 opacity-40"
                        />
                      </div>
                      <div
                        class="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-green-500 text-white"
                      >
                        <IconifyIcon icon="lucide:check" class="size-3" />
                      </div>
                      <div
                        class="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex"
                      >
                        <Button
                          danger
                          size="small"
                          type="text"
                          @click="clearMediaFile(content)"
                        >
                          <IconifyIcon
                            icon="lucide:trash-2"
                            class="size-4 text-white"
                          />
                        </Button>
                      </div>
                    </div>
                    <div
                      class="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      @click="onOpenMediaPicker(content.msgType as MediaType)"
                    >
                      <IconifyIcon icon="lucide:plus" class="size-5" />
                      <span class="text-xs">{{ $t('welcome.addMedia') }}</span>
                    </div>
                  </div>
                  <div
                    v-if="content.msgType === 'file' && content.filename"
                    class="text-xs text-muted-foreground"
                  >
                    {{ content.filename }}
                  </div>
                </div>
              </div>
              <!-- 链接 -->
              <div
                v-else-if="content.msgType === 'link'"
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
                    @click="toggleDraftContent(content.msgType)"
                  >
                    ✕
                  </Button>
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-28 shrink-0 text-sm text-muted-foreground">
                    <span class="text-red-500">*</span>
                    {{ $t('welcome.linkTitle') }}
                  </span>
                  <Input
                    v-model:value="content.linkTitle"
                    class="flex-1"
                    :placeholder="$t('welcome.linkTitlePlaceholder')"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-28 shrink-0 text-sm text-muted-foreground">
                    {{ $t('welcome.linkDesc') }}
                  </span>
                  <Input
                    v-model:value="content.linkDesc"
                    class="flex-1"
                    :placeholder="$t('welcome.linkDescPlaceholder')"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-28 shrink-0 text-sm text-muted-foreground">
                    <span class="text-red-500">*</span>
                    {{ $t('welcome.linkUrl') }}
                  </span>
                  <Input
                    v-model:value="content.linkUrl"
                    class="flex-1"
                    :placeholder="$t('welcome.linkUrlPlaceholder')"
                  />
                </div>
              </div>
              <!-- 小程序：标题/appid/页面路径/封面图（封面转临时素材取 pic_media_id） -->
              <div
                v-else-if="content.msgType === 'miniprogram'"
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
                    @click="toggleDraftContent(content.msgType)"
                  >
                    ✕
                  </Button>
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-28 shrink-0 text-sm text-muted-foreground">
                    <span class="text-red-500">*</span>
                    {{ $t('welcome.mpTitle') }}
                  </span>
                  <Input
                    v-model:value="content.mpTitle"
                    class="flex-1"
                    :maxlength="64"
                    :placeholder="$t('welcome.mpTitlePlaceholder')"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-28 shrink-0 text-sm text-muted-foreground">
                    <span class="text-red-500">*</span>
                    {{ $t('welcome.mpAppid') }}
                  </span>
                  <Input
                    v-model:value="content.mpAppid"
                    class="flex-1"
                    :placeholder="$t('welcome.mpAppidPlaceholder')"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-28 shrink-0 text-sm text-muted-foreground">
                    <span class="text-red-500">*</span>
                    {{ $t('welcome.mpPage') }}
                  </span>
                  <Input
                    v-model:value="content.mpPage"
                    class="flex-1"
                    :placeholder="$t('welcome.mpPagePlaceholder')"
                  />
                </div>
                <div class="flex flex-col gap-2">
                  <span class="text-sm text-muted-foreground">
                    <span class="text-red-500">*</span>
                    {{ $t('welcome.mpCover') }}
                  </span>
                  <div class="flex flex-wrap gap-2">
                    <div
                      v-if="content.url"
                      class="group relative size-20 overflow-hidden rounded-md border"
                    >
                      <img :src="content.url" class="size-full object-cover" />
                      <div
                        class="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-green-500 text-white"
                      >
                        <IconifyIcon icon="lucide:check" class="size-3" />
                      </div>
                      <div
                        class="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex"
                      >
                        <Button
                          danger
                          size="small"
                          type="text"
                          @click="clearMediaFile(content)"
                        >
                          <IconifyIcon
                            icon="lucide:trash-2"
                            class="size-4 text-white"
                          />
                        </Button>
                      </div>
                    </div>
                    <div
                      class="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      @click="onOpenMpCoverPicker"
                    >
                      <IconifyIcon icon="lucide:plus" class="size-5" />
                      <span class="text-xs">{{ $t('welcome.addMedia') }}</span>
                    </div>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ $t('welcome.mpCoverTip') }}
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </RuleModal>
  </div>
</template>
