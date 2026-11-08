<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { GroupChatApi } from '#/api';

import { computed, onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';

import { Button, message, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getContactList,
  getCorpList,
  getGroupChatMemberStatisticList,
  getGroupChatPage,
  getGroupChatStatisticSummary,
  triggerGroupChatSync,
} from '#/api';
import { $t } from '#/locales';

import EmployeePanel from '../contact/modules/employee-panel.vue';
import { getStatusOptions, useColumns, useGridFormSchema } from './data';
import MemberDrawerComp from './modules/member-drawer.vue';

/**
 * 客群列表页（后端 WxGroupChatController /scrm/groupchat/page）。
 *
 * 菜单入口由后端决定：sys_menu.component 配成 groupchat/index 时，
 * 宿主按 pageMap 解析到本文件（accessMode=backend）。
 *
 * 主从布局（左侧为通讯录）：左侧企业筛选（默认第一个授权企业）+
 * 部门树 + 成员列表，点击成员按群主（owner）过滤右侧客群；
 * 顶部"同步客群"按钮对当前筛选企业触发全量同步。
 * 行操作"成员"打开群成员查看抽屉。
 */

/** 企业筛选（默认第一个授权企业；同步对当前企业执行） */
const corpFilter = ref<string>();
const corpOptions = ref<{ label: string; value: string }[]>([]);
const syncing = ref(false);

/** 左侧选中的成员（企微 userId，客群按群主过滤） */
const selectedUserId = ref<string>();
/** 左侧选中的部门（通讯录树过滤用，客群按群主命中部门及子部门下的成员） */
const selectedDeptId = ref<number>();

/** 成员 userid → 姓名（"群主"列显示用，按当前企业加载） */
const ownerNameMap = ref<Map<string, string>>(new Map());

function loadMembers() {
  if (!corpFilter.value) {
    ownerNameMap.value = new Map();
    return;
  }
  getContactList({ corpId: corpFilter.value })
    .then((users) => {
      ownerNameMap.value = new Map(
        (users ?? []).map((u) => [u.userId ?? '', u.name || u.userId || '']),
      );
    })
    .catch(() => (ownerNameMap.value = new Map()));
}

const [MemberDrawer, memberDrawerApi] = useVbenDrawer({
  connectedComponent: MemberDrawerComp,
  destroyOnClose: true,
});

function onMembers(row: GroupChatApi.WxGroupChat) {
  memberDrawerApi.setData({ group: row }).open();
}

/** 统计卡片（实时口径：本地表即时计算） */
const summary = ref<GroupChatApi.GroupChatStatistic>();

const statCards = computed(() => [
  {
    label: $t('groupchat.statNewChats'),
    value: summary.value?.newChatCnt ?? 0,
  },
  {
    label: $t('groupchat.statNewMembers'),
    value: summary.value?.newMemberCnt ?? 0,
  },
  {
    label: $t('groupchat.statDelMembers'),
    value: summary.value?.delMemberCnt ?? 0,
  },
  {
    label: $t('groupchat.statChatTotal'),
    value: summary.value?.chatTotal ?? 0,
  },
  {
    label: $t('groupchat.statMemberTotal'),
    value: summary.value?.memberTotal ?? 0,
  },
]);

function loadSummary() {
  if (!corpFilter.value) return;
  // 实时口径：本地表即时计算（当天）
  getGroupChatStatisticSummary(corpFilter.value)
    .then((data) => (summary.value = data))
    .catch(() => (summary.value = undefined));
}

async function loadCorpOptions() {
  const corps = await getCorpList();
  // 仅已授权企业可同步/有客群数据
  corpOptions.value = corps
    .filter((corp) => corp.authStatus === 1)
    .map((corp) => ({
      label: corp.corpName || corp.corpId,
      value: corp.corpId,
    }));
}

/** 切换企业：成员选择随面板重置，右侧按新企业刷新 */
function onCorpChange() {
  selectedUserId.value = undefined;
  loadTodayStats();
  loadSummary();
  loadMembers();
  gridApi.query();
}

function onMemberChange(userId?: string) {
  selectedUserId.value = userId;
  gridApi.query();
}

function onDeptChange(deptId?: number) {
  selectedDeptId.value = deptId;
  gridApi.query();
}

/** 当日各群入群/退群统计（chatId → 数量），供统计列展示 */
const todayStatMap = ref<Map<string, { add: number; del: number }>>(new Map());

async function loadTodayStats() {
  if (!corpFilter.value) return;
  try {
    const list =
      (await getGroupChatMemberStatisticList(corpFilter.value)) ?? [];
    todayStatMap.value = new Map(
      list.map((item) => [
        item.chatId,
        { add: item.addCount ?? 0, del: item.delCount ?? 0 },
      ]),
    );
  } catch {
    todayStatMap.value = new Map();
  }
}

function statOf(chatId?: string) {
  if (!chatId) return { add: 0, del: 0 };
  return todayStatMap.value.get(chatId) ?? { add: 0, del: 0 };
}

function onSync() {
  if (!corpFilter.value) return;
  syncing.value = true;
  const hideLoading = message.loading({
    content: $t('groupchat.syncing'),
    duration: 0,
    key: 'groupchat_sync_msg',
  });
  triggerGroupChatSync(corpFilter.value)
    .then(() => {
      message.success({
        content: $t('groupchat.syncSuccess'),
        key: 'groupchat_sync_msg',
      });
      gridApi.query();
      loadMembers();
    })
    .catch(() => {
      hideLoading();
    })
    .finally(() => {
      syncing.value = false;
    });
}

// 初次进入加载当日统计
loadTodayStats();

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await getGroupChatPage({
            corpId: corpFilter.value || undefined,
            current: page.currentPage,
            owner: selectedUserId.value,
            deptId: selectedDeptId.value,
            size: page.pageSize,
            ...formValues,
          });
          void loadTodayStats();
          return result;
        },
      },
      // 覆盖宿主全局的 response 映射（result/list: 'items'）：
      // 后端接口返回 IPage 结构，行数据在 records 字段
      response: {
        result: 'records',
        total: 'total',
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<GroupChatApi.WxGroupChat>,
});

onMounted(async () => {
  // 企业默认选中第一个授权企业（同步按钮与面板联动）
  await loadCorpOptions();
  const first = corpOptions.value[0]?.value;
  if (first) {
    corpFilter.value = first;
    await gridApi.formApi.setValues({ corpId: first });
  }
  loadSummary();
  loadMembers();
});

function statusText(status?: number) {
  const found = getStatusOptions().find((item) => item.value === status);
  return found?.label ?? status;
}

function statusColor(status?: number) {
  switch (status) {
    case 0: {
      return 'success';
    }
    case 1: {
      return 'error';
    }
    case 2: {
      return 'warning';
    }
    default: {
      return 'default';
    }
  }
}
</script>
<template>
  <Page auto-content-height>
    <!-- 群成员查看抽屉 -->
    <MemberDrawer />
    <!-- 客群统计抽屉 -->
    <!-- 主从布局：左侧通讯录（企业/部门树/成员），右侧客群列表 -->
    <div class="flex h-full min-h-0 flex-col gap-2">
      <!-- 统计卡片行（数据来自企微按日回拉，T+1，取昨日） -->
      <div
        class="grid shrink-0 grid-cols-2 gap-2 rounded-md border bg-card p-2 lg:grid-cols-5"
      >
        <div
          v-for="card in statCards"
          :key="card.label"
          class="rounded-md border border-border p-3 text-center"
        >
          <div class="text-xs text-muted-foreground">{{ card.label }}</div>
          <div class="mt-1 text-xl font-semibold">
            {{ card.value }}
          </div>
        </div>
      </div>
      <div class="flex min-h-0 flex-1 gap-2">
        <!-- 左侧：企业 + 通讯录（部门树/成员） -->
        <div
          class="flex w-60 shrink-0 flex-col overflow-hidden rounded-md border bg-card"
        >
          <EmployeePanel
            v-model:corp-id="corpFilter"
            :corp-options="corpOptions"
            :corp-placeholder="$t('groupchat.corpPlaceholder')"
            class="min-h-0 flex-1"
            @change="onMemberChange"
            @corp-change="onCorpChange"
            @dept-change="onDeptChange"
          >
            <template #actions>
              <Button
                v-access:code="'groupchat:sync'"
                block
                :disabled="!corpFilter"
                :loading="syncing"
                type="primary"
                @click="onSync"
              >
                {{ $t('groupchat.sync') }}
              </Button>
            </template>
          </EmployeePanel>
        </div>

        <!-- 右侧：客群表格 -->
        <div class="h-full min-w-0 flex-1">
          <Grid>
            <template #owner="{ row }">
              {{ ownerNameMap.get(row.owner ?? '') ?? row.owner ?? '-' }}
            </template>
            <template #status="{ row }">
              <Tag v-if="row.dismissFlag === 1" color="default">
                {{ $t('groupchat.dismissed') }}
              </Tag>
              <Tag v-else :color="statusColor(row.status)">
                {{ statusText(row.status) }}
              </Tag>
            </template>
            <template #dismissFlag="{ row }">
              <Tag v-if="row.dismissFlag === 1" color="default">
                {{ $t('groupchat.dismissed') }}
              </Tag>
              <span v-else>-</span>
            </template>
            <template #adminList="{ row }">
              {{
                row.adminList?.length
                  ? row.adminList
                      .map(
                        (userid: string) => ownerNameMap.get(userid) ?? userid,
                      )
                      .join('、')
                  : '-'
              }}
            </template>
            <template #statToday="{ row }">
              <span class="text-xs">
                {{ statOf(row.chatId).add }} / {{ statOf(row.chatId).del }}
              </span>
            </template>
            <template #operation="{ row }">
              <Button size="small" type="link" @click="onMembers(row)">
                {{ $t('groupchat.member') }}
              </Button>
            </template>
          </Grid>
        </div>
      </div>
    </div>
  </Page>
</template>
