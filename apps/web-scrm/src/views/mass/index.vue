<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MassApi } from '#/api';

import { onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import { Button, message, Modal, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  delMassTasks,
  getCorpList,
  getMassTaskPage,
  getMassTaskStats,
  syncMassTaskResult,
} from '#/api';
import { $t } from '#/locales';

import EmployeePanel from '../contact/modules/employee-panel.vue';
import { failOf, rateOf, useColumns, useGridFormSchema } from './data';
import EditDrawerComp from './modules/edit-drawer.vue';
import InvokeLogDrawerComp from './modules/invoke-log-drawer.vue';

/**
 * 客户群发页面（后端 WxMassController /scrm/mass/*）。
 *
 * 主从布局（与客户列表页同构）：左侧通讯录（企业/部门树/成员），
 * 点击成员按发送成员（sender）过滤右侧任务；右侧任务表格内嵌
 * 报表列（应发送/已送达/送达率/失败，为该任务全部批次合计，
 * 来自 /scrm/mass/statistic/taskList）。
 * 行操作：调用记录（批次列表 + 单批次送达统计抽屉）/
 * 编辑（复用详情表单的抽屉）/ 删除。
 */

/** 企业筛选（默认第一个授权企业） */
const corpFilter = ref<string>();
const corpOptions = ref<{ label: string; value: string }[]>([]);

/** 左侧选中的成员（企微 userId，任务按发送成员过滤） */
const selectedUserId = ref<string>();
/** 左侧选中的部门（通讯录树过滤用，任务按发送成员命中部门及子部门下的成员） */
const selectedDeptId = ref<number>();
const syncing = ref(false);

/** 手动同步企微群发任务结果（当前企业，近30天窗口） */
function onSync() {
  if (!corpFilter.value) return;
  syncing.value = true;
  const hideLoading = message.loading({
    content: $t('mass.syncing'),
    duration: 0,
    key: 'mass_sync_msg',
  });
  syncMassTaskResult(corpFilter.value)
    .then((count) => {
      message.success({
        content:
          count && count > 0
            ? $t('mass.syncDone', [count])
            : $t('mass.syncNone'),
        key: 'mass_sync_msg',
      });
      gridApi.query();
    })
    .catch(() => {
      hideLoading();
    })
    .finally(() => {
      syncing.value = false;
    });
}

function fmtCount(count?: number) {
  return (count ?? 0).toLocaleString();
}

async function loadCorpOptions() {
  const corps = await getCorpList();
  // 仅已授权企业可同步/有群发数据
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
          const result = await getMassTaskPage({
            corpId: corpFilter.value || undefined,
            current: page.currentPage,
            sender: selectedUserId.value || undefined,
            deptId: selectedDeptId.value,
            size: page.pageSize,
            ...formValues,
          });
          // 报表列：按当前页任务批量拉取送达统计，挂载到行数据上
          const records = result.records ?? [];
          if (records.length > 0) {
            const stats = await getMassTaskStats(records.map((r) => r.id));
            const statMap = new Map(stats.map((s) => [String(s.taskId), s]));
            for (const record of records) {
              (record as { _stat?: MassApi.WxMassTaskStat })._stat =
                statMap.get(String(record.id));
            }
          }
          return result;
        },
      },
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
  } as VxeTableGridOptions<MassApi.WxMassTask>,
});

const [InvokeLogDrawer, invokeLogDrawerApi] = useVbenDrawer({
  connectedComponent: InvokeLogDrawerComp,
  destroyOnClose: true,
});

const [EditDrawer, editDrawerApi] = useVbenDrawer({
  connectedComponent: EditDrawerComp,
  destroyOnClose: true,
});

function onInvokeLog(row: MassApi.WxMassTask) {
  invokeLogDrawerApi.setData({ corpId: row.corpId, taskId: row.id }).open();
}

function onEdit(row: MassApi.WxMassTask) {
  editDrawerApi
    .setData({ defaultCorpId: corpFilter.value, msgId: row.id })
    .open();
}

function onCreate() {
  editDrawerApi
    .setData({ defaultCorpId: corpFilter.value, isNew: true })
    .open();
}

function onSaved() {
  gridApi.query();
}

function onDelete(row: MassApi.WxMassTask) {
  Modal.confirm({
    content: $t('mass.deleteRowConfirm', [row.taskName]),
    onOk: async () => {
      await delMassTasks(String(row.id));
      message.success($t('mass.deleteSuccess'));
      gridApi.query();
    },
    title: $t('mass.deleteConfirm'),
  });
}

function chatTypeText(chatType?: string) {
  switch (chatType) {
    case 'single': {
      return $t('mass.chatTypeSingle');
    }
    case 'group': {
      return $t('mass.chatTypeGroup');
    }
    case 'tag': {
      return $t('mass.chatTypeTag');
    }
    default: {
      return chatType;
    }
  }
}

function chatTypeColor(chatType?: string) {
  switch (chatType) {
    case 'single': {
      return 'blue';
    }
    case 'group': {
      return 'purple';
    }
    case 'tag': {
      return 'orange';
    }
    default: {
      return 'default';
    }
  }
}

function statusText(status?: number) {
  switch (status) {
    case 0: {
      return $t('mass.statusDisabled');
    }
    case 1: {
      return $t('mass.statusEnabled');
    }
    case 2: {
      return $t('mass.statusRunning');
    }
    case 3: {
      return $t('mass.statusDone');
    }
    default: {
      return status;
    }
  }
}

function statusColor(status?: number) {
  switch (status) {
    case 1: {
      return 'success';
    }
    case 2: {
      return 'processing';
    }
    case 3: {
      return 'cyan';
    }
    default: {
      return 'default';
    }
  }
}

function executeTypeText(executeType?: string) {
  switch (executeType) {
    case 'IMMEDIATE': {
      return $t('mass.executeImmediate');
    }
    case 'ONCE': {
      return $t('mass.executeOnce');
    }
    case 'DAILY': {
      return $t('mass.executeDaily');
    }
    case 'WEEKLY': {
      return $t('mass.executeWeekly');
    }
    case 'MONTHLY': {
      return $t('mass.executeMonthly');
    }
    case 'CRON': {
      return $t('mass.executeCron');
    }
    default: {
      return executeType;
    }
  }
}

/** 初始化：先加载企业并默认选中第一个授权企业，再刷新任务列表 */
onMounted(async () => {
  await loadCorpOptions();
  const firstCorp = corpOptions.value[0];
  if (!corpFilter.value && firstCorp) {
    corpFilter.value = firstCorp.value;
    gridApi.query();
  }
});
</script>
<template>
  <Page auto-content-height>
    <InvokeLogDrawer />
    <EditDrawer @saved="onSaved" />
    <!-- 主从布局：左侧通讯录（企业/部门树/成员），右侧任务表格（含报表列） -->
    <div class="flex h-full min-h-0 gap-2">
      <!-- 左侧：企业 + 通讯录 + 新建任务 -->
      <div
        class="flex w-60 shrink-0 flex-col overflow-hidden rounded-md border bg-card"
      >
        <EmployeePanel
          v-model:corp-id="corpFilter"
          :corp-options="corpOptions"
          :corp-placeholder="$t('mass.corpPlaceholder')"
          class="min-h-0 flex-1"
          @change="onMemberChange"
          @corp-change="onCorpChange"
          @dept-change="onDeptChange"
        >
          <template #actions>
            <Button
              v-access:code="'mass:sync'"
              block
              :disabled="!corpFilter"
              :loading="syncing"
              type="primary"
              @click="onSync"
            >
              <IconifyIcon class="size-4" icon="lucide:refresh-cw" />
              {{ $t('mass.sync') }}
            </Button>
          </template>
        </EmployeePanel>
      </div>

      <!-- 右侧：任务表格（含报表列） -->
      <div class="h-full min-w-0 flex-1">
        <Grid>
          <template #toolbar-tools>
            <Button
              v-access:code="'mass:add'"
              class="mr-2"
              type="primary"
              @click="onCreate"
            >
              <Plus class="size-4" />
              {{ $t('mass.create') }}
            </Button>
          </template>
          <template #taskName="{ row }">
            <div class="font-medium">{{ row.taskName }}</div>
            <div class="text-xs text-muted-foreground">
              {{
                row._stat
                  ? $t('mass.batchCount', [row._stat.batchCnt ?? 0])
                  : $t('mass.neverExecuted')
              }}
            </div>
          </template>
          <template #chatType="{ row }">
            <Tag :color="chatTypeColor(row.chatType)">
              {{ chatTypeText(row.chatType) }}
            </Tag>
          </template>
          <template #executeType="{ row }">
            {{ executeTypeText(row.executeType) }}
          </template>
          <template #status="{ row }">
            <Tag :color="statusColor(row.status)">
              {{ statusText(row.status) }}
            </Tag>
          </template>
          <template #statTotal="{ row }">
            {{ row._stat ? fmtCount(row._stat.totalCnt) : '-' }}
          </template>
          <template #statDelivered="{ row }">
            <span class="text-green-600">
              {{ row._stat ? fmtCount(row._stat.deliveredCnt) : '-' }}
            </span>
          </template>
          <template #deliveryRate="{ row }">
            <div
              v-if="rateOf(row._stat) !== undefined"
              class="flex items-center gap-1.5"
            >
              <div class="h-1.5 w-14 overflow-hidden rounded bg-muted">
                <div
                  class="h-full rounded bg-primary"
                  :style="{ width: `${rateOf(row._stat)}%` }"
                ></div>
              </div>
              <span class="text-xs">{{ rateOf(row._stat)!.toFixed(1) }}%</span>
            </div>
            <span v-else>-</span>
          </template>
          <template #statFail="{ row }">
            <span :class="(failOf(row._stat) ?? 0) > 0 ? 'text-red-500' : ''">
              {{ row._stat ? fmtCount(failOf(row._stat)) : '-' }}
            </span>
          </template>
          <template #operation="{ row }">
            <Button size="small" type="link" @click="onInvokeLog(row)">
              {{ $t('mass.invokeLog') }}
            </Button>
            <Button
              v-access:code="'mass:update'"
              size="small"
              type="link"
              @click="onEdit(row)"
            >
              {{ $t('mass.edit') }}
            </Button>
            <Button
              v-access:code="'mass:delete'"
              danger
              size="small"
              type="link"
              @click="onDelete(row)"
            >
              {{ $t('mass.delete') }}
            </Button>
          </template>
        </Grid>
      </div>
    </div>
  </Page>
</template>
