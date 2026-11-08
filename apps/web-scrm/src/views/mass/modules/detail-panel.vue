<script lang="ts" setup>
import type { CorpApi, CorpTagApi, MassApi } from '#/api';

import { computed, defineAsyncComponent, reactive, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  DatePicker,
  Empty,
  Input,
  message,
  RadioGroup,
  Select,
  Switch,
  TabPane,
  Tabs,
  Tag,
  TextArea,
} from 'antdv-next';

import {
  getContactList,
  getCorpList,
  getCustomerList,
  getGroupChatList,
  getMassTaskById,
  getTagGroupList,
  saveMassTask,
} from '#/api';
import { WECOM_MEDIA_LIMITS } from '#/constants/media-limits';
import { $t } from '#/locales';

const props = defineProps<{
  /** 新建态（右侧面板进入空白编辑，企业默认取 defaultCorpId） */
  defaultCorpId?: string;
  /** 隐藏"调用记录"入口（编辑抽屉场景，列表行上已有该操作） */
  hideInvokeLog?: boolean;
  isNew?: boolean;
  msgId?: number | string;
}>();

const emits = defineEmits<{ invokeLog: []; saved: [] }>();

const CheckableTag = Tag.CheckableTag;

/** 素材选择弹窗（system-common 联邦组件：与文件管理页同构，
 * 类型页签 + 分组树 + 搜索/上传 + 卡片多选 + 分页） */
const MediaPickerModalComp = defineAsyncComponent(() =>
  import('system_common/components').then((m) => m.MediaPickerModal),
);

const [MediaPickerModalView, mediaPickerModalApi] = useVbenModal({
  connectedComponent: MediaPickerModalComp,
  destroyOnClose: true,
});

type ContentItem = MassApi.WxMassContent;
type MediaType = 'file' | 'image' | 'video';

const corps = ref<CorpApi.WxCorpAuth[]>([]);

/** 发送成员下拉选项（所选企业的成员，来自 /scrm/contact/list） */
const members = ref<{ label: string; value: string }[]>([]);
const memberLoading = ref(false);
const selectedSender = ref<string>();

/** 客户多选选项（所选企业的客户，来自 /scrm/customer/list） */
const customers = ref<{ label: string; value: string }[]>([]);
const customerLoading = ref(false);
const selectedTargets = ref<string[]>([]);

/** 客户群多选选项（按群主=发送成员过滤，来自 /scrm/groupchat/list） */
const groups = ref<{ label: string; value: string }[]>([]);
const groupLoading = ref(false);
const selectedGroups = ref<string[]>([]);

/** 标签组（含组下标签，来自 /scrm/tag/groupList，标签客户类型用） */
const tagGroups = ref<CorpTagApi.WxCorpTagGroup[]>([]);
const tagGroupLoading = ref(false);

/**
 * 标签筛选规则：每个条件组选择一个标签组 + 该组下若干标签（组内为或关系），
 * 条件组之间为且关系；每组最多 100 个标签（与企微群发标签筛选规则一致）
 */
interface TagRule {
  groupId?: string;
  tagIds: string[];
}
const emptyTagRule = (): TagRule => ({ groupId: undefined, tagIds: [] });
const tagRules = ref<TagRule[]>([emptyTagRule()]);

/** 素材选择弹窗的目标内容类型 */
const pickerTargetType = ref('');

const loading = ref(false);
const saving = ref(false);
const activeTab = ref('basic');

const form = reactive({
  allowSelect: false,
  chatType: 'single',
  corpId: undefined as string | undefined,
  cronExpression: '',
  executeType: 'IMMEDIATE',
  id: undefined as number | string | undefined,
  scheduledTime: '',
  status: 1,
  taskName: '',
});
const contentList = ref<ContentItem[]>([]);

function onOpenMediaPicker(type: MediaType) {
  pickerTargetType.value = type;
  mediaPickerModalApi
    .setData({ accept: type, mediaLimits: WECOM_MEDIA_LIMITS, multiple: true })
    .open();
}

/** 素材确认：该类型旧条目整组替换为所选文件（每个文件一条内容项） */
function onMediaConfirm(
  type: MediaType,
  files:
    | Array<{ fileName: string; url: string }>
    | { fileName: string; url: string },
) {
  const list = Array.isArray(files) ? files : [files];
  contentList.value = contentList.value.filter((c) => c.msgType !== type);
  contentList.value.push(
    ...list.map((f) => ({
      filename: f.fileName,
      msgType: type,
      url: f.url,
    })),
  );
}

/** 媒体限制提示文案（由企微限制常量生成） */
function mediaHint(type: MediaType) {
  const rule = WECOM_MEDIA_LIMITS[type];
  if (!rule) return '';
  const formats = rule.formats?.map((format) => format.toUpperCase()).join('/');
  const maxText = `${rule.maxBytes / 1024 / 1024}MB`;
  return formats
    ? $t('mass.mediaHintFormats', [formats, maxText])
    : $t('mass.mediaHintMax', [maxText]);
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

async function loadMembers() {
  if (!form.corpId) {
    members.value = [];
    selectedSender.value = undefined;
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

async function loadCustomers() {
  if (form.chatType !== 'single' || !form.corpId) {
    customers.value = [];
    selectedTargets.value = [];
    return;
  }
  customerLoading.value = true;
  try {
    // 客户按所选发送成员过滤（成员变更后客户集合随之变化）
    const list = await getCustomerList({
      corpId: form.corpId,
      userId: selectedSender.value,
    });
    customers.value = (list ?? []).map((customer) => ({
      label: customer.name || customer.externalUserId || '',
      value: customer.externalUserId || '',
    }));
  } finally {
    customerLoading.value = false;
  }
}

async function loadGroups() {
  if (form.chatType !== 'group' || !form.corpId || !selectedSender.value) {
    groups.value = [];
    selectedGroups.value = [];
    return;
  }
  groupLoading.value = true;
  try {
    // 群按群主（所选发送成员）过滤
    const chats = await getGroupChatList({
      corpId: form.corpId,
      owner: selectedSender.value,
    });
    groups.value = (chats ?? []).map((chat) => ({
      label: chat.chatName || chat.chatId || '',
      value: chat.chatId || '',
    }));
  } finally {
    groupLoading.value = false;
  }
}

function onSenderChange() {
  // 发送成员变更：客户/群集合随之变化，清空已选并重新加载
  selectedTargets.value = [];
  selectedGroups.value = [];
  loadCustomers();
  loadGroups();
}

async function loadTagGroups() {
  if (form.chatType !== 'tag' || !form.corpId) {
    tagGroups.value = [];
    tagRules.value = [emptyTagRule()];
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
  selectedSender.value = undefined;
  selectedTargets.value = [];
  selectedGroups.value = [];
  tagRules.value = [emptyTagRule()];
  loadMembers();
  loadCustomers();
  loadGroups();
  loadTagGroups();
}

function onChatTypeChange() {
  loadMembers();
  loadCustomers();
  loadGroups();
  loadTagGroups();
}

const defaultForm = () => ({
  id: undefined as number | string | undefined,
  corpId: undefined as string | undefined,
  taskName: '',
  chatType: 'single',
  allowSelect: false,
  status: 1,
  executeType: 'IMMEDIATE',
  cronExpression: '',
  scheduledTime: '',
});

const MSG_TYPES = computed(() => [
  { label: $t('mass.msgTypeText'), value: 'text' },
  { label: $t('mass.msgTypeImage'), value: 'image' },
  { label: $t('mass.msgTypeVideo'), value: 'video' },
  { label: $t('mass.msgTypeFile'), value: 'file' },
  { label: $t('mass.msgTypeLink'), value: 'link' },
  { label: $t('mass.msgTypeMiniprogram'), value: 'miniprogram' },
]);

const corpOptions = computed(() =>
  corps.value.map((corp) => ({
    label: corp.corpName || corp.corpId,
    value: corp.corpId,
  })),
);

const chatTypeOptions = computed(() => [
  { label: $t('mass.chatTypeSingle'), value: 'single' },
  { label: $t('mass.chatTypeGroup'), value: 'group' },
  { label: $t('mass.chatTypeTag'), value: 'tag' },
]);

const statusOptions = computed(() => [
  { label: $t('mass.statusDisabled'), value: 0 },
  { label: $t('mass.statusEnabled'), value: 1 },
]);

const executeTypeOptions = computed(() => [
  { label: $t('mass.executeImmediate'), value: 'IMMEDIATE' },
  { label: $t('mass.executeOnce'), value: 'ONCE' },
  { label: $t('mass.executeDaily'), value: 'DAILY' },
  { label: $t('mass.executeWeekly'), value: 'WEEKLY' },
  { label: $t('mass.executeMonthly'), value: 'MONTHLY' },
  { label: $t('mass.executeCron'), value: 'CRON' },
]);

const targetLabel = computed(() => {
  switch (form.chatType) {
    case 'single': {
      return $t('mass.targetLabelSingle');
    }
    case 'group': {
      return $t('mass.targetLabelGroup');
    }
    default: {
      return $t('mass.targetLabelTag');
    }
  }
});

const targetPlaceholder = computed(() => {
  switch (form.chatType) {
    case 'single': {
      return $t('mass.targetTipSingle');
    }
    case 'group': {
      return $t('mass.targetTipGroup');
    }
    default: {
      return $t('mass.targetTipTag');
    }
  }
});

/** 标签规则 → 企微 group_list JSON：每个有标签的条件组一条记录（组内或、组间且） */
function buildTagFilter(): string {
  const rules = tagRules.value.filter((rule) => rule.tagIds.length > 0);
  if (rules.length === 0) return '';
  return JSON.stringify({
    group_list: rules.map((rule) => ({ tag_list: rule.tagIds })),
  });
}

/** 编辑回显：group_list JSON 还原为条件组（按标签反查所属标签组） */
function restoreTagRules(tagFilter?: string) {
  const reset = () => (tagRules.value = [emptyTagRule()]);
  if (!tagFilter) {
    reset();
    return;
  }
  try {
    const parsed = JSON.parse(tagFilter) as {
      group_list?: { tag_list?: string[] }[];
    };
    const entries = (parsed.group_list ?? []).map((group) => {
      const tagIds = group.tag_list ?? [];
      // 后端存储的 group_list 无 group_id，按第一个标签反查所属标签组
      const first = tagIds[0];
      const owner = tagGroups.value.find((g) =>
        (g.tagList ?? []).some((t) => t.tagId === first),
      );
      return { groupId: owner?.groupId, tagIds } as TagRule;
    });
    tagRules.value = entries.length > 0 ? entries : [emptyTagRule()];
  } catch {
    reset();
  }
}

/** 标签分组选项：过滤掉已被其他条件组占用的标签组（同组重复无意义） */
function groupOptionsFor(ruleIndex: number) {
  const used = new Set(
    tagRules.value
      .filter((_, i) => i !== ruleIndex)
      .map((rule) => rule.groupId),
  );
  return tagGroups.value
    .filter((g) => !used.has(g.groupId))
    .map((g) => ({ label: g.groupName || '', value: g.groupId || '' }));
}

/** 某条件组所选标签组下的标签选项 */
function tagOptionsFor(rule: TagRule) {
  const group = tagGroups.value.find((g) => g.groupId === rule.groupId);
  return (group?.tagList ?? []).map((tag) => ({
    label: tag.tagName || '',
    value: tag.tagId || '',
  }));
}

function addTagRule() {
  tagRules.value.push(emptyTagRule());
}

function removeTagRule(index: number) {
  tagRules.value.splice(index, 1);
}

function onRuleGroupChange(rule: TagRule) {
  // 切换条件组的标签组后，原标签不再适用
  rule.tagIds = [];
}

/** 群发内容类型的固定展示顺序（每种类型最多出现一次，取值与语言无关） */
const MSG_ORDER = ['text', 'image', 'video', 'file', 'link', 'miniprogram'];

function emptyContent(msgType: string): ContentItem {
  switch (msgType) {
    case 'link': {
      return { msgType, linkTitle: '', linkDesc: '', linkUrl: '' };
    }
    case 'miniprogram': {
      return { msgType, miniTitle: '', miniPage: '', miniAppid: '' };
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
    // 图片/视频/文件可有多条，移除时整组清掉
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

/** 文本内容按 UTF-8 字节数计算（企微限制 4000 字节，中文占 3 字节） */
function textByteLength(text?: string) {
  return new TextEncoder().encode(text ?? '').length;
}

function validate(): null | string {
  if (!form.corpId) return $t('mass.corpRequired');
  if (!form.taskName.trim()) return $t('mass.taskNameRequired');
  // 客户群必选发送成员（群列表按群主联动）；客户群发选填
  if (form.chatType === 'group' && !selectedSender.value) {
    return $t('mass.senderRequired');
  }
  if (form.chatType === 'single' && selectedTargets.value.length === 0) {
    return $t('mass.targetRequired');
  }
  if (form.chatType === 'group' && selectedGroups.value.length === 0) {
    return $t('mass.targetRequired');
  }
  if (form.chatType === 'group' && selectedGroups.value.length > 2000) {
    return $t('mass.groupMaxTip');
  }
  if (form.chatType === 'tag') {
    const rules = tagRules.value.filter((rule) => rule.tagIds.length > 0);
    if (rules.length === 0) return $t('mass.tagFilterRequired');
    for (const rule of rules) {
      if (rule.tagIds.length > 100) return $t('mass.tagGroupMaxTip');
    }
  }
  if (form.executeType === 'CRON' && !form.cronExpression.trim()) {
    return $t('mass.cronRequired');
  }
  if (contentList.value.length === 0) return $t('mass.contentRequired');
  const attachments = contentList.value.filter((c) => c.msgType !== 'text');
  if (attachments.length > 9) return $t('mass.attachmentMaxTip');
  // 文本与附件不能同时为空：文本留空时必须至少有一条附件
  const textItem = contentList.value.find((c) => c.msgType === 'text');
  if (!textItem?.textContent?.trim() && attachments.length === 0) {
    return $t('mass.contentBothEmpty');
  }
  for (const [index, content] of contentList.value.entries()) {
    const no = index + 1;
    if (content.msgType === 'text') {
      // 文本可为空（有附件时），仅在填写了内容后校验字节上限
      if (
        content.textContent?.trim() &&
        textByteLength(content.textContent) > 4000
      ) {
        return $t('mass.textContentMaxTip');
      }
      continue;
    }
    if (
      ['file', 'image', 'video'].includes(content.msgType) &&
      !content.url?.trim()
    ) {
      return $t('mass.contentItemRequired', [no]);
    }
    // 链接：标题与URL必填；小程序：标题/AppID/页面路径必填
    if (
      content.msgType === 'link' &&
      (!content.linkTitle?.trim() || !content.linkUrl?.trim())
    ) {
      return $t('mass.contentItemRequired', [no]);
    }
    if (
      content.msgType === 'miniprogram' &&
      (!content.miniTitle?.trim() ||
        !content.miniAppid?.trim() ||
        !content.miniPage?.trim())
    ) {
      return $t('mass.contentItemRequired', [no]);
    }
  }
  return null;
}

async function onSave() {
  const error = validate();
  if (error) {
    message.warning(error);
    return;
  }
  saving.value = true;
  // 后端保存目标时直接遍历该字段，tag 类型也必须传数组（可为空）
  let targetIdList: string[] = [];
  if (form.chatType === 'single') {
    targetIdList = selectedTargets.value;
  } else if (form.chatType === 'group') {
    targetIdList = selectedGroups.value;
  }

  const payload: MassApi.WxMassTaskSaveReq = {
    id: form.id,
    corpId: form.corpId,
    taskName: form.taskName.trim(),
    chatType: form.chatType,
    targetIdList,
    // 三种类型的发送成员统一来自单选（客户群必选）；标签客户可空
    senderList: selectedSender.value ? [selectedSender.value] : [],
    allowSelect: form.allowSelect,
    tagFilter: form.chatType === 'tag' ? buildTagFilter() : '',
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
    await saveMassTask(payload);
    message.success($t('mass.saveSuccess'));
    emits('saved');
  } finally {
    saving.value = false;
  }
}

/** 加载编辑详情（msgId 变化或进入新建态时） */
async function loadDetail() {
  activeTab.value = 'basic';
  if (props.isNew) {
    if (corps.value.length === 0) {
      corps.value = (await getCorpList()) ?? [];
    }
    Object.assign(form, defaultForm());
    form.corpId = props.defaultCorpId;
    contentList.value = [{ msgType: 'text', textContent: '' }];
    tagRules.value = [emptyTagRule()];
    selectedSender.value = undefined;
    selectedTargets.value = [];
    selectedGroups.value = [];
    await loadMembers();
    await loadCustomers();
    await loadGroups();
    await loadTagGroups();
    return;
  }
  if (!props.msgId) return;
  loading.value = true;
  try {
    if (corps.value.length === 0) {
      corps.value = (await getCorpList()) ?? [];
    }
    const detail = await getMassTaskById(props.msgId);
    Object.assign(form, {
      id: detail.id,
      corpId: detail.corpId,
      taskName: detail.taskName ?? '',
      chatType: detail.chatType ?? 'single',
      allowSelect: detail.allowSelect === true,
      status: detail.status ?? 1,
      executeType: detail.executeType ?? 'IMMEDIATE',
      cronExpression: detail.cronExpression ?? '',
      scheduledTime: detail.scheduledTime ?? '',
    });
    contentList.value =
      detail.contentList && detail.contentList.length > 0
        ? detail.contentList.map((content) => ({ ...content }))
        : [{ msgType: 'text', textContent: '' }];
    // 成员/客户/群/标签选项依赖企业，先加载成员并回显，再联动加载其余
    await loadMembers();
    selectedSender.value = detail.senderList?.[0];
    await loadCustomers();
    await loadGroups();
    await loadTagGroups();
    selectedTargets.value =
      detail.chatType === 'single' ? (detail.targetIdList ?? []) : [];
    selectedGroups.value =
      detail.chatType === 'group' ? (detail.targetIdList ?? []) : [];
    restoreTagRules(detail.chatType === 'tag' ? detail.tagFilter : undefined);
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
</script>
<template>
  <!-- 空态：未选择任务且非新建 -->
  <div v-if="!isNew && !msgId" class="flex h-full items-center justify-center">
    <Empty
      :description="$t('welcome.selectTip')"
      :image="Empty.PRESENTED_IMAGE_SIMPLE"
    />
  </div>
  <div v-else class="flex h-full min-h-0 flex-col">
    <!-- 头部：企业（仅新建，必填）/ 任务名称（必填）/ 调用记录 / 保存 -->
    <div class="flex items-center gap-3 border-b border-border px-4 py-3">
      <span v-if="isNew" class="shrink-0 text-sm text-muted-foreground">
        <span class="text-red-500">*</span>
        {{ $t('mass.corp') }}
      </span>
      <Select
        v-if="isNew"
        v-model:value="form.corpId"
        class="w-55"
        :options="corpOptions"
        :placeholder="$t('mass.corpPlaceholder')"
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
        {{ $t('mass.taskName') }}
      </span>
      <Input
        v-model:value="form.taskName"
        class="max-w-65 flex-1"
        :maxlength="50"
        :placeholder="$t('mass.taskNamePlaceholder')"
      />
      <Button
        v-if="!isNew && !hideInvokeLog"
        class="ml-auto"
        @click="emits('invokeLog')"
      >
        {{ $t('mass.invokeLog') }}
      </Button>
      <Button
        v-access:code="['mass:add', 'mass:update']"
        :class="!isNew ? '' : 'ml-auto'"
        :loading="saving"
        type="primary"
        @click="onSave"
      >
        {{ $t('mass.save') }}
      </Button>
    </div>

    <!-- 页签：基本信息 / 群发内容 / 发送范围 -->
    <div class="min-h-0 flex-1 overflow-auto px-4 py-3">
      <Tabs v-model:active-key="activeTab">
        <!-- 基本信息 -->
        <TabPane key="basic" :tab="$t('mass.basicTitle')">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <span class="w-20 shrink-0 text-sm text-muted-foreground">
                {{ $t('mass.chatType') }}
              </span>
              <RadioGroup
                v-model:value="form.chatType"
                :options="chatTypeOptions"
                @change="onChatTypeChange"
              />
            </div>
            <div class="flex items-center gap-3">
              <span class="w-20 shrink-0 text-sm text-muted-foreground">
                {{ $t('mass.status') }}
              </span>
              <RadioGroup
                v-model:value="form.status"
                :options="statusOptions"
              />
            </div>
            <div class="flex items-center gap-3">
              <span class="w-20 shrink-0 text-sm text-muted-foreground">
                {{ $t('mass.executeType') }}
              </span>
              <Select
                v-model:value="form.executeType"
                class="min-w-50 flex-1"
                :options="executeTypeOptions"
              />
            </div>
            <div
              v-if="form.executeType === 'ONCE'"
              class="flex items-center gap-3"
            >
              <span class="w-20 shrink-0 text-sm text-muted-foreground">
                {{ $t('mass.scheduledTime') }}
              </span>
              <DatePicker
                v-model:value="form.scheduledTime"
                class="flex-1"
                show-time
                value-format="YYYY-MM-DD HH:mm:ss"
                :placeholder="$t('mass.scheduledTime')"
              />
            </div>
            <div
              v-if="form.executeType === 'CRON'"
              class="flex items-center gap-3"
            >
              <span class="w-20 shrink-0 text-sm text-muted-foreground">
                <span class="text-red-500">*</span>
                {{ $t('mass.cronExpression') }}
              </span>
              <Input
                v-model:value="form.cronExpression"
                class="flex-1"
                :placeholder="$t('mass.cronTip')"
              />
            </div>
            <div class="flex items-center gap-3">
              <span class="w-20 shrink-0 text-sm text-muted-foreground">
                {{ $t('mass.allowSelect') }}
              </span>
              <Switch v-model:checked="form.allowSelect" />
            </div>
          </div>
        </TabPane>

        <!-- 群发内容 -->
        <TabPane key="content" :tab="$t('mass.contentTitle')">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-foreground">
                <span class="text-red-500">*</span>
                {{ $t('mass.contentTitle') }}
              </span>
              <span class="text-xs text-muted-foreground">
                {{ $t('mass.contentUnique') }}
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
                v-if="['image', 'video', 'file'].includes(content.msgType)"
                class="text-xs text-muted-foreground"
              >
                {{ mediaHint(content.msgType as MediaType) }}
              </div>
              <TextArea
                v-if="content.msgType === 'text'"
                v-model:value="content.textContent"
                :auto-size="{ minRows: 3, maxRows: 6 }"
                :placeholder="$t('mass.textContent')"
              />
              <div
                v-if="content.msgType === 'text'"
                class="text-right text-xs"
                :class="
                  textByteLength(content.textContent) > 4000
                    ? 'text-red-500'
                    : 'text-muted-foreground'
                "
              >
                {{ textByteLength(content.textContent) }}/4000
              </div>
              <template
                v-if="['image', 'video', 'file'].includes(content.msgType)"
              >
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
                      v-else-if="content.msgType === 'video'"
                      class="flex size-full items-center justify-center bg-gray-100 dark:bg-gray-800"
                    >
                      <IconifyIcon
                        icon="lucide:video"
                        class="size-8 opacity-40"
                      />
                    </div>
                    <div
                      v-else
                      class="flex size-full items-center justify-center bg-gray-100 dark:bg-gray-800"
                    >
                      <IconifyIcon
                        icon="lucide:file-text"
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
                        @click="
                          removeMediaAttachment(
                            content.msgType as MediaType,
                            item.url ?? '',
                          )
                        "
                      >
                        <IconifyIcon
                          class="size-4 text-white"
                          icon="lucide:trash-2"
                        />
                      </Button>
                    </div>
                  </div>
                  <div
                    class="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    @click="onOpenMediaPicker(content.msgType as MediaType)"
                  >
                    <IconifyIcon icon="lucide:plus" class="size-5" />
                    <span class="text-xs">{{ $t('mass.addMedia') }}</span>
                  </div>
                </div>
              </template>
              <!-- 链接 -->
              <div
                v-else-if="content.msgType === 'link'"
                class="flex flex-col gap-2"
              >
                <div class="flex items-center gap-3">
                  <span class="w-20 shrink-0 text-sm text-muted-foreground">
                    <span class="text-red-500">*</span>
                    {{ $t('mass.linkTitle') }}
                  </span>
                  <Input
                    v-model:value="content.linkTitle"
                    class="flex-1"
                    :placeholder="$t('mass.linkTitlePlaceholder')"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-20 shrink-0 text-sm text-muted-foreground">
                    {{ $t('mass.linkDesc') }}
                  </span>
                  <Input
                    v-model:value="content.linkDesc"
                    class="flex-1"
                    :placeholder="$t('mass.linkDescPlaceholder')"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-20 shrink-0 text-sm text-muted-foreground">
                    <span class="text-red-500">*</span>
                    {{ $t('mass.linkUrl') }}
                  </span>
                  <Input
                    v-model:value="content.linkUrl"
                    class="flex-1"
                    :placeholder="$t('mass.linkUrlPlaceholder')"
                  />
                </div>
              </div>
              <!-- 小程序 -->
              <div
                v-else-if="content.msgType === 'miniprogram'"
                class="flex flex-col gap-2"
              >
                <div class="flex items-center gap-3">
                  <span class="w-20 shrink-0 text-sm text-muted-foreground">
                    <span class="text-red-500">*</span>
                    {{ $t('mass.miniTitle') }}
                  </span>
                  <Input
                    v-model:value="content.miniTitle"
                    class="flex-1"
                    :placeholder="$t('mass.miniTitlePlaceholder')"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-20 shrink-0 text-sm text-muted-foreground">
                    <span class="text-red-500">*</span>
                    {{ $t('mass.miniAppid') }}
                  </span>
                  <Input
                    v-model:value="content.miniAppid"
                    class="flex-1"
                    :placeholder="$t('mass.miniAppidPlaceholder')"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-20 shrink-0 text-sm text-muted-foreground">
                    <span class="text-red-500">*</span>
                    {{ $t('mass.miniPage') }}
                  </span>
                  <Input
                    v-model:value="content.miniPage"
                    class="flex-1"
                    :placeholder="$t('mass.miniPagePlaceholder')"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabPane>

        <!-- 发送范围 -->
        <TabPane key="scope" :tab="$t('mass.rangeTitle')">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <span class="w-20 shrink-0 text-sm text-muted-foreground">
                <span v-if="form.chatType === 'group'" class="text-red-500">*</span>
                {{ $t('mass.senderList') }}
              </span>
              <Select
                v-model:value="selectedSender"
                class="flex-1"
                allow-clear
                :loading="memberLoading"
                :options="members"
                :placeholder="$t('mass.senderPlaceholder')"
                show-search
                option-filter-prop="label"
                @change="onSenderChange"
              />
            </div>
            <div
              v-if="form.chatType === 'single'"
              class="flex items-start gap-3"
            >
              <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
                <span class="text-red-500">*</span>
                {{ targetLabel }}
              </span>
              <Select
                v-model:value="selectedTargets"
                class="flex-1"
                allow-clear
                :loading="customerLoading"
                mode="multiple"
                :options="customers"
                :placeholder="targetPlaceholder"
                show-search
                option-filter-prop="label"
              />
            </div>
            <div
              v-if="form.chatType === 'group'"
              class="flex items-start gap-3"
            >
              <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
                <span class="text-red-500">*</span>
                {{ targetLabel }}
              </span>
              <Select
                v-model:value="selectedGroups"
                class="flex-1"
                allow-clear
                :loading="groupLoading"
                mode="multiple"
                :options="groups"
                :placeholder="targetPlaceholder"
                show-search
                option-filter-prop="label"
              />
            </div>
            <div v-if="form.chatType === 'tag'" class="flex flex-col gap-2">
              <span class="text-sm text-muted-foreground">
                <span class="text-red-500">*</span>
                {{ $t('mass.tagFilter') }}
                <span class="ml-2">{{ $t('mass.tagRuleShort') }}</span>
              </span>
              <template v-for="(rule, index) in tagRules" :key="index">
                <div
                  v-if="index > 0"
                  class="text-center text-xs text-muted-foreground"
                >
                  {{ $t('mass.tagRuleAnd') }}
                </div>
                <div class="flex items-center gap-2">
                  <span class="shrink-0 text-xs text-muted-foreground">
                    {{ $t('mass.tagRule') }}{{ index + 1 }}
                  </span>
                  <Select
                    v-model:value="rule.groupId"
                    class="w-32 shrink-0"
                    :options="groupOptionsFor(index)"
                    :placeholder="$t('mass.tagGroupPlaceholder')"
                    show-search
                    option-filter-prop="label"
                    @change="() => onRuleGroupChange(rule)"
                  />
                  <Select
                    v-model:value="rule.tagIds"
                    class="min-w-0 flex-1"
                    allow-clear
                    :max-tag-count="3"
                    mode="multiple"
                    :options="tagOptionsFor(rule)"
                    :placeholder="$t('mass.tagSelectPlaceholder')"
                    show-search
                    option-filter-prop="label"
                  />
                  <Button
                    v-if="tagRules.length > 1"
                    danger
                    size="small"
                    type="text"
                    @click="removeTagRule(index)"
                  >
                    ✕
                  </Button>
                </div>
              </template>
              <div>
                <Button size="small" @click="addTagRule">
                  {{ $t('mass.addTagRule') }}
                </Button>
              </div>
              <div class="text-xs text-muted-foreground">
                {{ $t('mass.tagRuleHint') }}
              </div>
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
  </div>
</template>
