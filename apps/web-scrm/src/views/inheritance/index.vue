<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { GroupChatApi, InheritanceApi } from '#/api';

import { computed, ref, watch } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Checkbox,
  Input,
  message,
  Radio,
  RadioGroup,
  Select,
  TabPane,
  Tabs,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getContactList,
  getCorpList,
  getCustomerList,
  getGroupChatList,
  getOnjobTransferResult,
  getResignedTransferResult,
  getUnassignedList,
  transferOnjobCustomer,
  transferOnjobGroupChat,
  transferResignedCustomer,
  transferResignedGroupChat,
} from '#/api';
import { $t } from '#/locales';

import { useUnassignedColumns } from './data';

/**
 * 客户继承页面（后端 WxInheritanceController /scrm/inheritance/*）。
 *
 * 交互采用"左选右达"：左侧卡片选人/选对象（可搜索勾选列表或表格），
 * 右侧卡片确认接替成员并发起分配，下方卡片查询接替状态。
 * 待分配列表使用 vxe 表格（勾选列 + 列筛选 + 排序），进入页签自动加载。
 * 分配接口 errcode=0 仅代表已发起接替流程（24小时后自动接替），
 * 最终结果以接替状态查询为准，发起分配后会自动预填并查询一次状态。
 */
const activeTab = ref<'groupchat' | 'onjob' | 'resigned'>('onjob');

const corpFilter = ref<string>();
const corpOptions = ref<{ label: string; value: string }[]>([]);
const members = ref<{ label: string; value: string }[]>([]);
const memberLoading = ref(false);

/** 接替状态码 → Tag 颜色（文案用 status1~status5 国际化键） */
const STATUS_COLORS: Record<number, string> = {
  1: 'success',
  2: 'processing',
  3: 'error',
  4: 'warning',
  5: 'default',
};

function statusColor(status?: number) {
  return (status && STATUS_COLORS[status]) || 'default';
}

function statusLabel(status?: number) {
  return status === undefined ? '-' : $t(`inheritance.status${status}`);
}

/** 秒级时间戳 → 本地时间文案 */
function formatTime(seconds?: number) {
  if (!seconds) return '-';
  return new Date(seconds * 1000).toLocaleString();
}

function memberName(userid?: string) {
  if (!userid) return '-';
  return members.value.find((m) => m.value === userid)?.label ?? userid;
}

async function loadCorpOptions() {
  const corps = await getCorpList();
  // 仅已授权企业有客户继承数据
  corpOptions.value = corps
    .filter((corp) => corp.authStatus === 1)
    .map((corp) => ({
      label: corp.corpName || corp.corpId,
      value: corp.corpId,
    }));
}

async function loadMembers() {
  if (!corpFilter.value) {
    members.value = [];
    return;
  }
  memberLoading.value = true;
  try {
    const users = await getContactList({ corpId: corpFilter.value });
    members.value = (users ?? []).map((user) => ({
      label: user.name || user.userId || '',
      value: user.userId || '',
    }));
  } finally {
    memberLoading.value = false;
  }
}

/** 切换企业：重载成员、清空各页签状态；当前在离职页签时自动重载列表 */
watch(corpFilter, () => {
  loadMembers();
  resetOnjobTab();
  resetResignedTab();
  resetGroupChatTab();
  if (activeTab.value === 'resigned') {
    void loadResignedRows();
  }
});

/** 初始化：先加载企业并默认选中第一个已授权企业 */
async function init() {
  await loadCorpOptions();
  const firstCorp = corpOptions.value[0];
  if (!corpFilter.value && firstCorp) {
    corpFilter.value = firstCorp.value;
  }
}
init();

function containsFilter(text: string, filter: string) {
  return text.toLowerCase().includes(filter.trim().toLowerCase());
}

/** 单个客户分配结果文案：errcode=0 已发起，否则展示错误码 */
function transferResultText(errcode?: number) {
  return errcode === 0
    ? $t('inheritance.errcodeOk')
    : `${$t('inheritance.errcode')}: ${errcode ?? '-'}`;
}

// ==================== 在职客户转接 ====================
const onjobHandover = ref<string>();
const onjobTakeover = ref<string>();
const onjobTransferMsg = ref<string>();
const onjobCustomerList = ref<{ label: string; value: string }[]>([]);
const onjobCustomerLoading = ref(false);
const onjobCustomerFilter = ref('');
const onjobSelectedCustomers = ref<string[]>([]);
const onjobTransferResults = ref<InheritanceApi.CustomerTransferResult[]>([]);
const onjobTransferring = ref(false);

const filteredOnjobCustomers = computed(() =>
  onjobCustomerFilter.value
    ? onjobCustomerList.value.filter((c) =>
        containsFilter(c.label, onjobCustomerFilter.value),
      )
    : onjobCustomerList.value,
);

const onjobAllSelected = computed(
  () =>
    filteredOnjobCustomers.value.length > 0 &&
    filteredOnjobCustomers.value.every((c) =>
      onjobSelectedCustomers.value.includes(c.value),
    ),
);

const onjobIndeterminate = computed(() => {
  const selected = filteredOnjobCustomers.value.filter((c) =>
    onjobSelectedCustomers.value.includes(c.value),
  ).length;
  return selected > 0 && selected < filteredOnjobCustomers.value.length;
});

function toggleOnjobAll() {
  const filtered = filteredOnjobCustomers.value.map((c) => c.value);
  onjobSelectedCustomers.value = onjobAllSelected.value
    ? onjobSelectedCustomers.value.filter((v) => !filtered.includes(v))
    : [...new Set([...onjobSelectedCustomers.value, ...filtered])];
}

function toggleOnjobCustomer(value: string) {
  onjobSelectedCustomers.value = onjobSelectedCustomers.value.includes(value)
    ? onjobSelectedCustomers.value.filter((v) => v !== value)
    : [...onjobSelectedCustomers.value, value];
}

/** 原跟进成员变化：加载其名下客户 */
watch(onjobHandover, async (userId) => {
  onjobSelectedCustomers.value = [];
  onjobCustomerFilter.value = '';
  onjobCustomerList.value = [];
  if (!userId) return;
  onjobCustomerLoading.value = true;
  try {
    const list = await getCustomerList({ corpId: corpFilter.value, userId });
    onjobCustomerList.value = (list ?? []).map((customer) => ({
      label: customer.name || customer.externalUserId || '',
      value: customer.externalUserId || '',
    }));
  } finally {
    onjobCustomerLoading.value = false;
  }
});

function resetOnjobTab() {
  onjobHandover.value = undefined;
  onjobTakeover.value = undefined;
  onjobTransferMsg.value = undefined;
  onjobCustomerList.value = [];
  onjobCustomerFilter.value = '';
  onjobSelectedCustomers.value = [];
  onjobTransferResults.value = [];
  resetOnjobResult();
}

async function onTransferOnjobCustomers() {
  if (!corpFilter.value) return;
  if (!onjobHandover.value || !onjobTakeover.value) {
    message.warning($t('inheritance.onjobSelectMembersFirst'));
    return;
  }
  if (onjobHandover.value === onjobTakeover.value) {
    message.warning($t('inheritance.sameMember'));
    return;
  }
  if (onjobSelectedCustomers.value.length === 0) {
    message.warning($t('inheritance.onjobSelectCustomersFirst'));
    return;
  }
  onjobTransferring.value = true;
  try {
    onjobTransferResults.value = await transferOnjobCustomer({
      corpId: corpFilter.value,
      handoverUserid: onjobHandover.value,
      takeoverUserid: onjobTakeover.value,
      externalUseridList: onjobSelectedCustomers.value,
      transferMsg: onjobTransferMsg.value || undefined,
    });
    message.success($t('inheritance.onjobTransferSuccess'));
    // 转接发起后自动预填并查询接替状态
    onjobQueryHandover.value = onjobHandover.value;
    onjobQueryTakeover.value = onjobTakeover.value;
    await loadOnjobResult();
  } finally {
    onjobTransferring.value = false;
  }
}

// ==================== 在职接替状态查询 ====================
const onjobQueryHandover = ref<string>();
const onjobQueryTakeover = ref<string>();
const onjobResultItems = ref<InheritanceApi.TransferResultItem[]>([]);
const onjobResultCursor = ref<string>();
const onjobResultLoading = ref(false);
const onjobResultHasMore = ref(false);

function resetOnjobResult() {
  onjobQueryHandover.value = undefined;
  onjobQueryTakeover.value = undefined;
  onjobResultItems.value = [];
  onjobResultCursor.value = undefined;
  onjobResultHasMore.value = false;
}

async function loadOnjobResult(reset = true) {
  if (
    !corpFilter.value ||
    !onjobQueryHandover.value ||
    !onjobQueryTakeover.value
  ) {
    message.warning($t('inheritance.onjobSelectMembersFirst'));
    return;
  }
  onjobResultLoading.value = true;
  try {
    const resp = await getOnjobTransferResult({
      corpId: corpFilter.value,
      cursor: reset ? undefined : onjobResultCursor.value,
      handoverUserid: onjobQueryHandover.value,
      takeoverUserid: onjobQueryTakeover.value,
    });
    onjobResultItems.value = reset
      ? (resp.customer ?? [])
      : [...onjobResultItems.value, ...(resp.customer ?? [])];
    onjobResultCursor.value = resp.nextCursor || undefined;
    onjobResultHasMore.value = Boolean(resp.nextCursor);
  } finally {
    onjobResultLoading.value = false;
  }
}

// ==================== 离职客户转接 ====================
const resignedTakeover = ref<string>();
const resignedLoading = ref(false);
const resignedCursor = ref<string>();
const resignedLoadedCount = ref(0);
const resignedHasMore = ref(false);
const resignedSelectedCount = ref(0);
const resignedResults = ref<InheritanceApi.CustomerTransferResult[]>([]);
const resignedTransferring = ref(false);

/** 待分配行主键：同一客户可能被多个离职成员拥有 */
function resignedRowKey(item: InheritanceApi.UnassignedItem) {
  return `${item.handoverUserid}|${item.externalUserid}`;
}

const [UnassignedGrid, unassignedGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useUnassignedColumns(memberName),
    data: [],
    events: {
      checkboxAll: () => updateResignedSelectedCount(),
      checkboxChange: () => updateResignedSelectedCount(),
    },
    height: 420,
    keepSource: true,
    proxyConfig: {
      // 本地数据模式：rows 由 loadResignedRows 手动灌入
      autoLoad: false,
    },
    rowConfig: {
      keyField: '_key',
    },
    toolbarConfig: {
      custom: false,
      export: false,
      refresh: false,
      zoom: false,
    },
  } as VxeTableGridOptions<InheritanceApi.UnassignedItem>,
});

function updateResignedSelectedCount() {
  resignedSelectedCount.value =
    unassignedGridApi.grid?.getCheckboxRecords()?.length ?? 0;
}

async function loadResignedRows(reset = true) {
  if (!corpFilter.value || resignedLoading.value) return;
  resignedLoading.value = true;
  try {
    const resp = await getUnassignedList({
      corpId: corpFilter.value,
      cursor: reset ? undefined : resignedCursor.value,
      pageSize: 50,
    });
    const rows = (resp.list ?? []).map((item) => ({
      ...item,
      _key: resignedRowKey(item),
    }));
    const existing = reset
      ? []
      : (unassignedGridApi.grid?.getTableData()?.fullData ?? []);
    unassignedGridApi.setGridOptions({ data: [...existing, ...rows] });
    resignedCursor.value = resp.nextCursor || undefined;
    resignedHasMore.value = !resp.isLast && Boolean(resp.nextCursor);
    resignedLoadedCount.value =
      unassignedGridApi.grid?.getTableData()?.fullData?.length ?? 0;
    if (reset) {
      resignedResults.value = [];
      resignedSelectedCount.value = 0;
    }
  } finally {
    resignedLoading.value = false;
  }
}

function resetResignedTab() {
  unassignedGridApi.setGridOptions({ data: [] });
  resignedCursor.value = undefined;
  resignedHasMore.value = false;
  resignedLoadedCount.value = 0;
  resignedSelectedCount.value = 0;
  resignedResults.value = [];
  resignedTakeover.value = undefined;
  resetResignedResult();
}

/** 进入离职页签时自动加载待分配列表 */
watch(activeTab, (tab) => {
  if (tab === 'resigned' && resignedLoadedCount.value === 0) {
    void loadResignedRows();
  }
});

/** 勾选的待分配行（vxe 表格勾选记录） */
function getResignedSelectedRows(): InheritanceApi.UnassignedItem[] {
  return (unassignedGridApi.grid?.getCheckboxRecords() ??
    []) as InheritanceApi.UnassignedItem[];
}

/**
 * 离职分配：待分配列表可能包含多个离职成员的客户，
 * 按原跟进成员分组后逐组调用分配接口
 */
async function onTransferResignedCustomers() {
  if (!corpFilter.value) return;
  if (!resignedTakeover.value) {
    message.warning($t('inheritance.resignedTakeoverRequired'));
    return;
  }
  const selectedRows = getResignedSelectedRows();
  if (selectedRows.length === 0) {
    message.warning($t('inheritance.resignedSelectRowsFirst'));
    return;
  }
  resignedTransferring.value = true;
  try {
    const groups = new Map<string, string[]>();
    for (const row of selectedRows) {
      const list = groups.get(row.handoverUserid) ?? [];
      list.push(row.externalUserid);
      groups.set(row.handoverUserid, list);
    }
    const results: InheritanceApi.CustomerTransferResult[] = [];
    for (const [handoverUserid, externalUseridList] of groups) {
      const part = await transferResignedCustomer({
        corpId: corpFilter.value,
        externalUseridList,
        handoverUserid,
        takeoverUserid: resignedTakeover.value,
      });
      results.push(...part);
    }
    resignedResults.value = results;
    message.success($t('inheritance.resignedTransferSuccess'));
    // 仅单个离职成员时自动预填并查询接替状态
    if (groups.size === 1) {
      resignedQueryHandover.value = [...groups.keys()][0];
      resignedQueryTakeover.value = resignedTakeover.value;
      await loadResignedResult();
    }
    await loadResignedRows(true);
  } finally {
    resignedTransferring.value = false;
  }
}

// ==================== 离职接替状态查询 ====================
const resignedQueryHandover = ref<string>();
const resignedQueryTakeover = ref<string>();
const resignedResultItems = ref<InheritanceApi.TransferResultItem[]>([]);
const resignedResultCursor = ref<string>();
const resignedResultLoading = ref(false);
const resignedResultHasMore = ref(false);

function resetResignedResult() {
  resignedQueryHandover.value = undefined;
  resignedQueryTakeover.value = undefined;
  resignedResultItems.value = [];
  resignedResultCursor.value = undefined;
  resignedResultHasMore.value = false;
}

async function loadResignedResult(reset = true) {
  if (
    !corpFilter.value ||
    !resignedQueryHandover.value ||
    !resignedQueryTakeover.value
  ) {
    message.warning($t('inheritance.onjobSelectMembersFirst'));
    return;
  }
  resignedResultLoading.value = true;
  try {
    const resp = await getResignedTransferResult({
      corpId: corpFilter.value,
      cursor: reset ? undefined : resignedResultCursor.value,
      handoverUserid: resignedQueryHandover.value,
      takeoverUserid: resignedQueryTakeover.value,
    });
    resignedResultItems.value = reset
      ? (resp.customer ?? [])
      : [...resignedResultItems.value, ...(resp.customer ?? [])];
    resignedResultCursor.value = resp.nextCursor || undefined;
    resignedResultHasMore.value = Boolean(resp.nextCursor);
  } finally {
    resignedResultLoading.value = false;
  }
}

// ==================== 客户群转接 ====================
const groupType = ref<'onjob' | 'resigned'>('onjob');
const chatOwner = ref<string>();
const chatList = ref<{ label: string; value: string }[]>([]);
const chatLoading = ref(false);
const chatFilter = ref('');
const selectedChatKeys = ref<string[]>([]);
const newChatOwner = ref<string>();
const groupTransferring = ref(false);
const groupFailedList = ref<InheritanceApi.GroupChatTransferFailed[]>([]);

const groupTypeOptions = computed(() => [
  { label: $t('inheritance.tabOnjob'), value: 'onjob' },
  { label: $t('inheritance.tabResigned'), value: 'resigned' },
]);

const filteredChats = computed(() =>
  chatFilter.value
    ? chatList.value.filter((c) => containsFilter(c.label, chatFilter.value))
    : chatList.value,
);

const chatAllSelected = computed(
  () =>
    filteredChats.value.length > 0 &&
    filteredChats.value.every((c) => selectedChatKeys.value.includes(c.value)),
);

const chatIndeterminate = computed(() => {
  const selected = filteredChats.value.filter((c) =>
    selectedChatKeys.value.includes(c.value),
  ).length;
  return selected > 0 && selected < filteredChats.value.length;
});

function toggleChatAll() {
  const filtered = filteredChats.value.map((c) => c.value);
  selectedChatKeys.value = chatAllSelected.value
    ? selectedChatKeys.value.filter((v) => !filtered.includes(v))
    : [...new Set([...selectedChatKeys.value, ...filtered])];
}

function toggleChatRow(chatId: string) {
  selectedChatKeys.value = selectedChatKeys.value.includes(chatId)
    ? selectedChatKeys.value.filter((v) => v !== chatId)
    : [...selectedChatKeys.value, chatId];
}

/** 原群主变化：加载其名下客户群（本地同步库） */
watch(chatOwner, async (owner) => {
  selectedChatKeys.value = [];
  chatFilter.value = '';
  chatList.value = [];
  if (!owner) return;
  chatLoading.value = true;
  try {
    const list = await getGroupChatList({
      corpId: corpFilter.value,
      owner,
    });
    chatList.value = (list ?? []).map((chat: GroupChatApi.WxGroupChat) => ({
      label: chat.chatName || chat.chatId || '',
      value: chat.chatId || '',
    }));
  } finally {
    chatLoading.value = false;
  }
});

function resetGroupChatTab() {
  groupType.value = 'onjob';
  chatOwner.value = undefined;
  chatList.value = [];
  chatFilter.value = '';
  selectedChatKeys.value = [];
  newChatOwner.value = undefined;
  groupFailedList.value = [];
}

async function onTransferGroupChat() {
  if (!corpFilter.value) return;
  if (!chatOwner.value) {
    message.warning($t('inheritance.chatSelectOwnerFirst'));
    return;
  }
  if (selectedChatKeys.value.length === 0) {
    message.warning($t('inheritance.chatSelectGroupsFirst'));
    return;
  }
  if (!newChatOwner.value) {
    message.warning($t('inheritance.newOwnerPlaceholder'));
    return;
  }
  groupTransferring.value = true;
  try {
    const req = {
      chatIdList: selectedChatKeys.value,
      corpId: corpFilter.value,
      newOwner: newChatOwner.value,
    };
    const resp =
      groupType.value === 'onjob'
        ? await transferOnjobGroupChat(req)
        : await transferResignedGroupChat(req);
    groupFailedList.value = resp.failedChatList ?? [];
    message.success(
      groupFailedList.value.length === 0
        ? $t('inheritance.chatTransferDone')
        : $t('inheritance.groupTransferSuccess'),
    );
  } finally {
    groupTransferring.value = false;
  }
}
</script>

<template>
  <Page auto-content-height>
    <div class="flex h-full flex-col rounded-md bg-card">
      <div class="flex items-center gap-3 border-b border-border p-3">
        <span class="shrink-0 text-sm text-muted-foreground">
          {{ $t('inheritance.corp') }}
        </span>
        <Select
          v-model:value="corpFilter"
          class="w-72"
          :options="corpOptions"
          :placeholder="$t('inheritance.corpPlaceholder')"
          show-search
          option-filter-prop="label"
        />
      </div>
      <div class="min-h-0 flex-1 overflow-auto p-4">
        <Tabs v-model:active-key="activeTab">
          <!-- ==================== 在职继承 ==================== -->
          <TabPane key="onjob" :tab="$t('inheritance.tabOnjob')">
            <div class="flex flex-col gap-4">
              <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <!-- 左：原跟进成员与其客户 -->
                <div
                  class="flex flex-col gap-3 rounded-md border border-border p-3"
                >
                  <div class="text-sm font-medium text-foreground">
                    {{ $t('inheritance.selectCustomer') }}
                  </div>
                  <Select
                    v-model:value="onjobHandover"
                    allow-clear
                    class="w-full"
                    :loading="memberLoading"
                    :options="members"
                    :placeholder="$t('inheritance.handoverUserPlaceholder')"
                    show-search
                    option-filter-prop="label"
                  />
                  <template v-if="onjobHandover">
                    <Input
                      v-model:value="onjobCustomerFilter"
                      allow-clear
                      :placeholder="$t('inheritance.filterPlaceholder')"
                      size="small"
                    />
                    <div
                      class="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span>
                        {{
                          $t('inheritance.customerCount', [
                            filteredOnjobCustomers.length,
                          ])
                        }}
                      </span>
                      <Checkbox
                        :checked="onjobAllSelected"
                        :indeterminate="onjobIndeterminate"
                        @change="toggleOnjobAll"
                      >
                        {{ $t('inheritance.selectAll') }}
                      </Checkbox>
                    </div>
                    <div class="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                      <Checkbox
                        v-for="customer in filteredOnjobCustomers"
                        :key="customer.value"
                        :checked="
                          onjobSelectedCustomers.includes(customer.value)
                        "
                        class="mx-1 rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                        @change="toggleOnjobCustomer(customer.value)"
                      >
                        <span class="text-sm">{{ customer.label }}</span>
                      </Checkbox>
                      <div
                        v-if="filteredOnjobCustomers.length === 0"
                        class="py-6 text-center text-xs text-muted-foreground"
                      >
                        {{ $t('inheritance.emptyCustomer') }}
                      </div>
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {{
                        $t('inheritance.selectedCount', [
                          onjobSelectedCustomers.length,
                        ])
                      }}
                    </div>
                  </template>
                  <div
                    v-else
                    class="py-6 text-center text-xs text-muted-foreground"
                  >
                    {{ $t('inheritance.selectHandoverHint') }}
                  </div>
                </div>

                <!-- 右：接替成员与发起 -->
                <div
                  class="flex flex-col gap-3 rounded-md border border-border p-3"
                >
                  <div class="text-sm font-medium text-foreground">
                    {{ $t('inheritance.takeoverUser') }}
                  </div>
                  <Select
                    v-model:value="onjobTakeover"
                    allow-clear
                    class="w-full"
                    :loading="memberLoading"
                    :options="members"
                    :placeholder="$t('inheritance.takeoverUserPlaceholder')"
                    show-search
                    option-filter-prop="label"
                  />
                  <Input
                    v-model:value="onjobTransferMsg"
                    allow-clear
                    :maxlength="200"
                    :placeholder="$t('inheritance.transferMsgPlaceholder')"
                  />
                  <div class="min-h-5 text-xs text-muted-foreground">
                    <template
                      v-if="onjobSelectedCustomers.length > 0 && onjobTakeover"
                    >
                      {{
                        $t('inheritance.assignCustomersSummary', [
                          onjobSelectedCustomers.length,
                          memberName(onjobTakeover),
                        ])
                      }}
                    </template>
                    <template v-else-if="onjobSelectedCustomers.length > 0">
                      {{ $t('inheritance.takeoverUserPlaceholder') }}
                    </template>
                  </div>
                  <div class="mt-auto flex flex-col gap-3">
                    <Button
                      v-access:code="'inheritance:transfer'"
                      block
                      :disabled="
                        !onjobHandover ||
                        !onjobTakeover ||
                        onjobSelectedCustomers.length === 0 ||
                        onjobHandover === onjobTakeover
                      "
                      :loading="onjobTransferring"
                      type="primary"
                      @click="onTransferOnjobCustomers"
                    >
                      {{ $t('inheritance.transferBtn') }}
                    </Button>
                    <div
                      v-if="onjobTransferResults.length > 0"
                      class="flex max-h-48 flex-col gap-1 overflow-y-auto border-t border-border pt-2 text-xs text-muted-foreground"
                    >
                      <div
                        v-for="item in onjobTransferResults"
                        :key="item.externalUserid"
                        class="flex items-center gap-2"
                      >
                        <span class="truncate">{{ item.externalUserid }}</span>
                        <Tag
                          class="ml-auto shrink-0"
                          :color="item.errcode === 0 ? 'success' : 'error'"
                        >
                          {{ transferResultText(item.errcode) }}
                        </Tag>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 接替状态查询 -->
              <div
                class="flex flex-col gap-3 rounded-md border border-border p-3"
              >
                <div class="text-sm font-medium text-foreground">
                  {{ $t('inheritance.statusResultTitle') }}
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <Select
                    v-model:value="onjobQueryHandover"
                    allow-clear
                    class="w-56"
                    :options="members"
                    :placeholder="$t('inheritance.handoverUserPlaceholder')"
                    show-search
                    option-filter-prop="label"
                  />
                  <span class="text-muted-foreground">→</span>
                  <Select
                    v-model:value="onjobQueryTakeover"
                    allow-clear
                    class="w-56"
                    :options="members"
                    :placeholder="$t('inheritance.takeoverUserPlaceholder')"
                    show-search
                    option-filter-prop="label"
                  />
                  <Button
                    :disabled="!onjobQueryHandover || !onjobQueryTakeover"
                    :loading="onjobResultLoading"
                    @click="loadOnjobResult()"
                  >
                    {{ $t('inheritance.queryBtn') }}
                  </Button>
                  <Button
                    v-if="onjobResultHasMore"
                    :loading="onjobResultLoading"
                    size="small"
                    @click="loadOnjobResult(false)"
                  >
                    {{ $t('inheritance.loadMore') }}
                  </Button>
                </div>
                <div
                  v-if="onjobResultItems.length > 0"
                  class="flex flex-col gap-1"
                >
                  <div
                    v-for="item in onjobResultItems"
                    :key="item.externalUserid"
                    class="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <span class="truncate">{{ item.externalUserid }}</span>
                    <Tag class="shrink-0" :color="statusColor(item.status)">
                      {{ statusLabel(item.status) }}
                    </Tag>
                    <span class="ml-auto shrink-0 text-muted-foreground">
                      {{ formatTime(item.takeoverTime) }}
                    </span>
                  </div>
                </div>
                <div
                  v-else-if="onjobQueryHandover && onjobQueryTakeover"
                  class="text-xs text-muted-foreground"
                >
                  {{ $t('inheritance.noResult') }}
                </div>
              </div>
            </div>
          </TabPane>

          <!-- ==================== 离职继承 ==================== -->
          <TabPane key="resigned" :tab="$t('inheritance.tabResigned')">
            <div class="flex flex-col gap-4">
              <div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
                <!-- 左：待分配客户表格 -->
                <div
                  class="flex flex-col gap-3 rounded-md border border-border p-3"
                >
                  <div
                    class="flex flex-wrap items-center justify-between gap-2"
                  >
                    <div class="text-sm font-medium text-foreground">
                      {{ $t('inheritance.unassignedTitle') }}
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-muted-foreground">
                        {{
                          $t('inheritance.loadedCount', [resignedLoadedCount])
                        }}
                        ·
                        {{
                          $t('inheritance.selectedCount', [
                            resignedSelectedCount,
                          ])
                        }}
                      </span>
                      <Button
                        :loading="resignedLoading"
                        size="small"
                        @click="loadResignedRows()"
                      >
                        {{
                          resignedLoadedCount > 0
                            ? $t('common.refresh')
                            : $t('inheritance.loadUnassigned')
                        }}
                      </Button>
                    </div>
                  </div>
                  <UnassignedGrid>
                    <template #handover="{ row }">
                      <span class="cursor-default" :title="row.handoverUserid">
                        {{ memberName(row.handoverUserid) }}
                      </span>
                    </template>
                    <template #dimission="{ row }">
                      {{ formatTime(row.dimissionTime) }}
                    </template>
                  </UnassignedGrid>
                  <Button
                    v-if="resignedHasMore"
                    :loading="resignedLoading"
                    size="small"
                    @click="loadResignedRows(false)"
                  >
                    {{ $t('inheritance.loadMore') }}
                  </Button>
                </div>

                <!-- 右：接替成员与发起 -->
                <div
                  class="flex flex-col gap-3 rounded-md border border-border p-3"
                >
                  <div class="text-sm font-medium text-foreground">
                    {{ $t('inheritance.takeoverUser') }}
                  </div>
                  <Select
                    v-model:value="resignedTakeover"
                    allow-clear
                    class="w-full"
                    :loading="memberLoading"
                    :options="members"
                    :placeholder="$t('inheritance.takeoverUserPlaceholder')"
                    show-search
                    option-filter-prop="label"
                  />
                  <div class="min-h-5 text-xs text-muted-foreground">
                    <template
                      v-if="resignedSelectedCount > 0 && resignedTakeover"
                    >
                      {{
                        $t('inheritance.assignCustomersSummary', [
                          resignedSelectedCount,
                          memberName(resignedTakeover),
                        ])
                      }}
                    </template>
                    <template v-else-if="resignedSelectedCount > 0">
                      {{ $t('inheritance.takeoverUserPlaceholder') }}
                    </template>
                  </div>
                  <div class="mt-auto flex flex-col gap-3">
                    <Button
                      v-access:code="'inheritance:transfer'"
                      block
                      :disabled="
                        resignedSelectedCount === 0 || !resignedTakeover
                      "
                      :loading="resignedTransferring"
                      type="primary"
                      @click="onTransferResignedCustomers"
                    >
                      {{ $t('inheritance.transferBtn') }}
                    </Button>
                    <div
                      v-if="resignedResults.length > 0"
                      class="flex max-h-48 flex-col gap-1 overflow-y-auto border-t border-border pt-2 text-xs text-muted-foreground"
                    >
                      <div
                        v-for="item in resignedResults"
                        :key="item.externalUserid"
                        class="flex items-center gap-2"
                      >
                        <span class="truncate">{{ item.externalUserid }}</span>
                        <Tag
                          class="ml-auto shrink-0"
                          :color="item.errcode === 0 ? 'success' : 'error'"
                        >
                          {{ transferResultText(item.errcode) }}
                        </Tag>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 接替状态查询 -->
              <div
                class="flex flex-col gap-3 rounded-md border border-border p-3"
              >
                <div class="text-sm font-medium text-foreground">
                  {{ $t('inheritance.statusResultTitle') }}
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <Select
                    v-model:value="resignedQueryHandover"
                    allow-clear
                    class="w-56"
                    :options="members"
                    :placeholder="$t('inheritance.handoverUserPlaceholder')"
                    show-search
                    option-filter-prop="label"
                  />
                  <span class="text-muted-foreground">→</span>
                  <Select
                    v-model:value="resignedQueryTakeover"
                    allow-clear
                    class="w-56"
                    :options="members"
                    :placeholder="$t('inheritance.takeoverUserPlaceholder')"
                    show-search
                    option-filter-prop="label"
                  />
                  <Button
                    :disabled="!resignedQueryHandover || !resignedQueryTakeover"
                    :loading="resignedResultLoading"
                    @click="loadResignedResult()"
                  >
                    {{ $t('inheritance.queryBtn') }}
                  </Button>
                  <Button
                    v-if="resignedResultHasMore"
                    :loading="resignedResultLoading"
                    size="small"
                    @click="loadResignedResult(false)"
                  >
                    {{ $t('inheritance.loadMore') }}
                  </Button>
                </div>
                <div
                  v-if="resignedResultItems.length > 0"
                  class="flex flex-col gap-1"
                >
                  <div
                    v-for="item in resignedResultItems"
                    :key="item.externalUserid"
                    class="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <span class="truncate">{{ item.externalUserid }}</span>
                    <Tag class="shrink-0" :color="statusColor(item.status)">
                      {{ statusLabel(item.status) }}
                    </Tag>
                    <span class="ml-auto shrink-0 text-muted-foreground">
                      {{ formatTime(item.takeoverTime) }}
                    </span>
                  </div>
                </div>
                <div
                  v-else-if="resignedQueryHandover && resignedQueryTakeover"
                  class="text-xs text-muted-foreground"
                >
                  {{ $t('inheritance.noResult') }}
                </div>
              </div>
            </div>
          </TabPane>

          <!-- ==================== 客户群转接 ==================== -->
          <TabPane
            key="groupchat"
            :tab="$t('inheritance.groupChatTransferTitle')"
          >
            <div class="flex flex-col gap-4">
              <div
                class="flex items-center gap-3 rounded-md border border-border p-3"
              >
                <span class="shrink-0 text-sm text-muted-foreground">
                  {{ $t('inheritance.transferType') }}
                </span>
                <RadioGroup v-model:value="groupType">
                  <Radio
                    v-for="option in groupTypeOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </Radio>
                </RadioGroup>
              </div>
              <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <!-- 左：原群主与其客户群 -->
                <div
                  class="flex flex-col gap-3 rounded-md border border-border p-3"
                >
                  <div class="text-sm font-medium text-foreground">
                    {{ $t('inheritance.selectGroup') }}
                  </div>
                  <Select
                    v-model:value="chatOwner"
                    allow-clear
                    class="w-full"
                    :loading="memberLoading"
                    :options="members"
                    :placeholder="$t('inheritance.handoverUserPlaceholder')"
                    show-search
                    option-filter-prop="label"
                  />
                  <template v-if="chatOwner">
                    <Input
                      v-model:value="chatFilter"
                      allow-clear
                      :placeholder="$t('inheritance.filterPlaceholder')"
                      size="small"
                    />
                    <div
                      class="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span>
                        {{
                          $t('inheritance.groupCount', [filteredChats.length])
                        }}
                      </span>
                      <Checkbox
                        :checked="chatAllSelected"
                        :indeterminate="chatIndeterminate"
                        @change="toggleChatAll"
                      >
                        {{ $t('inheritance.selectAll') }}
                      </Checkbox>
                    </div>
                    <div class="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                      <Checkbox
                        v-for="chat in filteredChats"
                        :key="chat.value"
                        :checked="selectedChatKeys.includes(chat.value)"
                        class="mx-1 rounded px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                        @change="toggleChatRow(chat.value)"
                      >
                        <span class="text-sm">{{ chat.label }}</span>
                      </Checkbox>
                      <div
                        v-if="filteredChats.length === 0"
                        class="py-6 text-center text-xs text-muted-foreground"
                      >
                        {{ $t('inheritance.emptyChat') }}
                      </div>
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {{
                        $t('inheritance.selectedCount', [
                          selectedChatKeys.length,
                        ])
                      }}
                    </div>
                  </template>
                  <div
                    v-else
                    class="py-6 text-center text-xs text-muted-foreground"
                  >
                    {{ $t('inheritance.selectHandoverHint') }}
                  </div>
                </div>

                <!-- 右：新群主与发起 -->
                <div
                  class="flex flex-col gap-3 rounded-md border border-border p-3"
                >
                  <div class="text-sm font-medium text-foreground">
                    {{ $t('inheritance.newOwner') }}
                  </div>
                  <Select
                    v-model:value="newChatOwner"
                    allow-clear
                    class="w-full"
                    :options="members"
                    :placeholder="$t('inheritance.newOwnerPlaceholder')"
                    show-search
                    option-filter-prop="label"
                  />
                  <div class="min-h-5 text-xs text-muted-foreground">
                    <template
                      v-if="selectedChatKeys.length > 0 && newChatOwner"
                    >
                      {{
                        $t('inheritance.assignGroupsSummary', [
                          selectedChatKeys.length,
                          memberName(newChatOwner),
                        ])
                      }}
                    </template>
                    <template v-else-if="selectedChatKeys.length > 0">
                      {{ $t('inheritance.newOwnerPlaceholder') }}
                    </template>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ $t('inheritance.transferSuccess') }}
                  </div>
                  <div class="mt-auto flex flex-col gap-3">
                    <Button
                      v-access:code="'inheritance:transfer'"
                      block
                      :disabled="
                        !chatOwner ||
                        selectedChatKeys.length === 0 ||
                        !newChatOwner
                      "
                      :loading="groupTransferring"
                      type="primary"
                      @click="onTransferGroupChat"
                    >
                      {{ $t('inheritance.groupTransferBtn') }}
                    </Button>
                    <div
                      v-if="groupFailedList.length > 0"
                      class="flex max-h-48 flex-col gap-1 overflow-y-auto border-t border-border pt-2 text-xs text-muted-foreground"
                    >
                      <div
                        v-for="item in groupFailedList"
                        :key="item.chatId"
                        class="flex items-center gap-2"
                      >
                        <span class="truncate">{{ item.chatId }}</span>
                        <Tag class="ml-auto shrink-0" color="error">
                          {{ item.errcode }} {{ item.errmsg }}
                        </Tag>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabPane>
        </Tabs>
      </div>
    </div>
  </Page>
</template>
