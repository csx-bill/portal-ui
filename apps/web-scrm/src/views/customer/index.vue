<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { CustomerApi } from '#/api';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, message, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getContactList,
  getCorpList,
  getCustomerPage,
  getCustomerStatisticSummary,
  getTagGroupList,
  triggerCustomerSync,
} from '#/api';
import { $t } from '#/locales';

import EmployeePanel from '../contact/modules/employee-panel.vue';
import {
  customerFollowInfo,
  customerTagNames,
  useColumns,
  useGridFormSchema,
} from './data';
import RemarkDrawerComp from './modules/remark-drawer.vue';
import TagDrawerComp from './modules/tag-drawer.vue';

/**
 * 客户列表页（后端 WxCustomerController /scrm/customer/page）。
 *
 * 菜单入口由后端决定：sys_menu.component 配成 customer/index 时，
 * 宿主按 pageMap 解析到本文件（accessMode=backend）。
 *
 * 主从布局（左侧为通讯录）：左侧企业筛选（默认第一个授权企业）+
 * 部门树 + 成员列表，点击成员按跟进成员（userId）过滤右侧客户；
 * 顶部"同步客户"按钮对当前筛选企业触发全量同步。
 */

/** 企业筛选（默认第一个授权企业；同步对当前企业执行） */
const corpFilter = ref<string>();
const corpOptions = ref<{ label: string; value: string }[]>([]);
const syncing = ref(false);

/** 左侧选中的成员（企微 userId，客户按跟进成员过滤） */
const selectedUserId = ref<string>();
/** 左侧选中的部门（通讯录树过滤用，命中部门及子部门下的跟进成员） */
const selectedDeptId = ref<number>();

/** 成员 userid → 姓名（"添加成员"列显示用，按当前企业加载） */
const userNameMap = ref<Map<string, string>>(new Map());

function loadMembers() {
  if (!corpFilter.value) {
    userNameMap.value = new Map();
    return;
  }
  getContactList({ corpId: corpFilter.value })
    .then((users) => {
      userNameMap.value = new Map(
        (users ?? []).map((u) => [u.userId ?? '', u.name || u.userId || '']),
      );
    })
    .catch(() => (userNameMap.value = new Map()));
}

/** 顶部统计（客户总数/今日新增/今日流失/累计流失，按当前企业实时计算） */
const summary = ref<CustomerApi.Statistic>();

const statCards = computed(() => [
  {
    label: $t('customer.statTodayNew'),
    value: summary.value?.todayNew ?? 0,
  },
  {
    label: $t('customer.statTodayLost'),
    value: summary.value?.todayLost ?? 0,
  },
  { label: $t('customer.statTotal'), value: summary.value?.total ?? 0 },
  {
    label: $t('customer.statLostTotal'),
    value: summary.value?.lostTotal ?? 0,
  },
]);

function loadSummary() {
  if (!corpFilter.value) {
    summary.value = undefined;
    return;
  }
  getCustomerStatisticSummary(corpFilter.value)
    .then((data) => (summary.value = data))
    .catch(() => (summary.value = undefined));
}

/** 客户标签下拉选项（按当前企业加载，搜索条件用） */
const tagOptions = ref<Array<{ label: string; value: string }>>([]);

async function loadTagOptions() {
  if (!corpFilter.value) {
    tagOptions.value = [];
    return;
  }
  const groups = (await getTagGroupList({ corpId: corpFilter.value })) ?? [];
  tagOptions.value = groups.flatMap((group) =>
    (group.tagList ?? []).map((tag) => ({
      label: tag.tagName ?? '',
      value: tag.tagId ?? '',
    })),
  );
}

async function loadCorpOptions() {
  const corps = await getCorpList();
  // 仅已授权企业可同步/有客户数据
  corpOptions.value = corps
    .filter((corp) => corp.authStatus === 1)
    .map((corp) => ({
      label: corp.corpName || corp.corpId,
      value: corp.corpId,
    }));
}

/** 切换企业：成员/部门选择随面板重置，右侧按新企业刷新 */
function onCorpChange() {
  selectedUserId.value = undefined;
  selectedDeptId.value = undefined;
  gridApi.query();
  loadSummary();
  loadMembers();
  loadTagOptions();
}

function onMemberChange(userId?: string) {
  selectedUserId.value = userId;
  gridApi.query();
}

function onDeptChange(deptId?: number) {
  selectedDeptId.value = deptId;
  gridApi.query();
}

function onRefresh() {
  gridApi.query();
}

/** 编辑标签抽屉（企微 mark_tag：差量 add/remove，成功后刷新列表） */
const [TagDrawer, tagDrawerApi] = useVbenDrawer({
  connectedComponent: TagDrawerComp,
  destroyOnClose: true,
});

/** 备注抽屉（企微 externalcontact/remark） */
const [RemarkDrawer, remarkDrawerApi] = useVbenDrawer({
  connectedComponent: RemarkDrawerComp,
  destroyOnClose: true,
});

/** 打标签入口权限（customer:markTag）；无权限时标签只读展示 */
const { hasAccessByCodes } = useAccess();
const canMarkTag = computed(() => hasAccessByCodes(['customer:markTag']));

function onEditTags(row: CustomerApi.WxCustomer) {
  if (!canMarkTag.value) return;
  tagDrawerApi.setData(row).open();
}

function onRemark(row: CustomerApi.WxCustomer) {
  remarkDrawerApi.setData(row).open();
}

function onSync() {
  if (!corpFilter.value) return;
  syncing.value = true;
  const hideLoading = message.loading({
    content: $t('customer.syncing'),
    duration: 0,
    key: 'customer_sync_msg',
  });
  triggerCustomerSync(corpFilter.value)
    .then(() => {
      message.success({
        content: $t('customer.syncSuccess'),
        key: 'customer_sync_msg',
      });
      gridApi.query();
      loadSummary();
      loadMembers();
    })
    .catch(() => {
      hideLoading();
    })
    .finally(() => {
      syncing.value = false;
    });
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(() => tagOptions.value),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await getCustomerPage({
            corpId: corpFilter.value || undefined,
            current: page.currentPage,
            size: page.pageSize,
            userId: selectedUserId.value,
            deptId: selectedDeptId.value,
            ...formValues,
          });
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
  } as VxeTableGridOptions<CustomerApi.WxCustomer>,
});

onMounted(async () => {
  // 企业默认选中第一个授权企业（同步按钮与面板联动）
  await loadCorpOptions();
  const firstCorp = corpOptions.value[0];
  if (!corpFilter.value && firstCorp) {
    corpFilter.value = firstCorp.value;
  }
  loadSummary();
  loadMembers();
  loadTagOptions();
});
</script>
<template>
  <Page auto-content-height>
    <TagDrawer @success="onRefresh" />
    <RemarkDrawer @success="onRefresh" />
    <div class="flex h-full min-h-0 flex-col gap-3">
      <!-- 统计卡片行（实时口径，按当前企业） -->
      <div
        class="grid shrink-0 grid-cols-2 gap-2 rounded-md border bg-card p-2 lg:grid-cols-4"
      >
        <div
          v-for="card in statCards"
          :key="card.label"
          class="rounded border border-border p-3 text-center"
        >
          <div class="text-xs text-muted-foreground">{{ card.label }}</div>
          <div class="mt-1 text-xl font-semibold">
            {{ card.value }}
          </div>
        </div>
      </div>
      <!-- 主从布局：左侧通讯录（企业/部门树/成员），右侧客户列表 -->
      <div class="flex min-h-0 flex-1 gap-2">
        <!-- 左侧：企业 + 通讯录（部门树/成员） -->
        <div
          class="flex w-60 shrink-0 flex-col overflow-hidden rounded-md border bg-card"
        >
          <EmployeePanel
            v-model:corp-id="corpFilter"
            :corp-options="corpOptions"
            :corp-placeholder="$t('customer.corpPlaceholder')"
            class="min-h-0 flex-1"
            @change="onMemberChange"
            @corp-change="onCorpChange"
            @dept-change="onDeptChange"
          >
            <template #actions>
              <Button
                v-access:code="'customer:sync'"
                block
                :disabled="!corpFilter"
                :loading="syncing"
                type="primary"
                @click="onSync"
              >
                {{ $t('customer.sync') }}
              </Button>
            </template>
          </EmployeePanel>
        </div>

        <!-- 右侧：客户表格 -->
        <div class="h-full min-w-0 flex-1">
          <Grid>
            <template #name="{ row }">
              <div class="flex items-center justify-center gap-2">
                <img
                  v-if="row.avatar"
                  class="size-8 shrink-0 rounded-full object-cover"
                  :src="row.avatar"
                />
                <span
                  v-else
                  class="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs dark:bg-gray-700"
                >
                  {{ (row.name || '?').slice(0, 1) }}
                </span>
                <span class="truncate">{{ row.name || '-' }}</span>
              </div>
            </template>
            <template #followUser="{ row }">
              {{ userNameMap.get(row.userId ?? '') ?? row.userId ?? '-' }}
            </template>
            <template #type="{ row }">
              <Tag v-if="row.type === 1" color="green">
                {{ $t('customer.typeWx') }}
              </Tag>
              <Tag v-else-if="row.type === 2" color="blue">
                {{ $t('customer.typeWorkWx') }}
              </Tag>
              <span v-else>{{ row.type }}</span>
            </template>
            <template #gender="{ row }">
              {{
                row.gender === 1
                  ? $t('customer.genderMale')
                  : row.gender === 2
                    ? $t('customer.genderFemale')
                    : $t('customer.genderUnknown')
              }}
            </template>
            <template #tags="{ row }">
              <!-- 点击单元格直接编辑标签（就近操作，需 customer:markTag 权限，无权限时只读展示）；
                 空标签显示可点的"打标签"提示 -->
              <div
                class="flex flex-wrap items-center justify-center gap-1"
                :class="canMarkTag ? 'cursor-pointer' : undefined"
                :title="canMarkTag ? $t('customer.tagEdit') : undefined"
                @click.stop="onEditTags(row)"
              >
                <template v-if="customerTagNames(row).length">
                  <Tag
                    v-for="tagName in customerTagNames(row)"
                    :key="tagName"
                    color="processing"
                  >
                    {{ tagName }}
                  </Tag>
                </template>
                <span v-else class="text-muted-foreground">
                  {{ $t('customer.tagAddHint') }}
                </span>
                <IconifyIcon
                  v-if="canMarkTag"
                  class="size-3.5 shrink-0 text-muted-foreground"
                  icon="lucide:pencil-line"
                />
              </div>
            </template>
            <template #remark="{ row }">
              {{ customerFollowInfo(row).remark || '-' }}
            </template>
            <template #remarkMobiles="{ row }">
              {{
                (customerFollowInfo(row).remarkMobiles ?? []).join('、') || '-'
              }}
            </template>
            <template #operation="{ row }">
              <Button
                v-access:code="'customer:remark'"
                size="small"
                type="link"
                @click="onRemark(row)"
              >
                {{ $t('customer.remarkEdit') }}
              </Button>
            </template>
            <template #lostFlag="{ row }">
              <div
                v-if="row.lostFlag === 1"
                class="flex flex-col items-center gap-0.5"
              >
                <Tag color="error">
                  {{
                    row.lostBy === 3
                      ? $t('customer.lostByTransfer')
                      : $t('customer.lost')
                  }}
                </Tag>
                <span class="text-xs">
                  {{ row.lostReason ?? '-' }}
                </span>
                <span
                  v-if="row.handoverToUserid"
                  class="text-xs"
                  :title="`${$t('customer.handoverTo')} ${row.handoverToUserid}`"
                >
                  {{ $t('customer.handoverTo') }} {{ row.handoverToUserid }}
                </span>
                <span
                  v-if="row.handoverTime"
                  class="text-xs text-muted-foreground"
                >
                  {{ $t('customer.handoverTimeLabel') }}：{{ row.handoverTime }}
                </span>
                <span
                  v-else-if="row.lostTime"
                  class="text-xs text-muted-foreground"
                >
                  {{ $t('customer.lostTimeLabel') }}：{{ row.lostTime }}
                </span>
              </div>
              <span v-else>-</span>
            </template>
          </Grid>
        </div>
      </div>
    </div>
  </Page>
</template>
