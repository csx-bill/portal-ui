<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MomentApi } from '#/api';

import { onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

import { Button, message, Modal, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  delMomentTasks,
  getCorpList,
  getMomentTaskPage,
  getMomentTaskStats,
  syncMomentTaskResult,
} from '#/api';
import { $t } from '#/locales';

import EmployeePanel from '../contact/modules/employee-panel.vue';
import {
  executeTypeText,
  publishRateOf,
  useColumns,
  useGridFormSchema,
  visibleTypeText,
} from './data';
import EditDrawerComp from './modules/edit-drawer.vue';
import InvokeLogDrawerComp from './modules/invoke-log-drawer.vue';

/**
 * 企微朋友圈任务页面（后端 WxMomentController /scrm/moment/*）。
 *
 * 主从布局（与客户列表页同构）：左侧通讯录（企业/部门树/成员），
 * 点击成员按可见成员（sender，仅匹配"指定成员"范围的任务）过滤右侧任务；
 * 右侧任务表格内嵌报表列（应发表/已发表/发表率/未发表，为该任务全部
 * 批次合计，来自 /scrm/moment/statistic/taskList）。
 * 行操作：调用记录（批次列表 + 单批次发表统计抽屉）/
 * 编辑（复用详情表单的抽屉）/ 删除。
 */

/** 企业筛选（默认第一个授权企业） */
const corpFilter = ref<string>();
const corpOptions = ref<{ label: string; value: string }[]>([]);

/** 左侧选中的成员（企微 userId，任务按可见成员过滤） */
const selectedUserId = ref<string>();
/** 左侧选中的部门（deptSelectable，任务按可见部门过滤，与成员互斥） */
const selectedDeptId = ref<number>();
const syncing = ref(false);

/** 手动同步企微朋友圈任务结果（当前企业，近30天窗口） */
function onSync() {
  if (!corpFilter.value) return;
  syncing.value = true;
  const hideLoading = message.loading({
    content: $t('moment.syncing'),
    duration: 0,
    key: 'moment_sync_msg',
  });
  syncMomentTaskResult(corpFilter.value)
    .then((count) => {
      message.success({
        content:
          count && count > 0
            ? $t('moment.syncDone', [count])
            : $t('moment.syncNone'),
        key: 'moment_sync_msg',
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
  // 仅已授权企业可同步/有朋友圈数据
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
          const result = await getMomentTaskPage({
            corpId: corpFilter.value || undefined,
            current: page.currentPage,
            deptId: selectedDeptId.value || undefined,
            sender: selectedUserId.value || undefined,
            size: page.pageSize,
            ...formValues,
          });
          // 报表列：按当前页任务批量拉取发表统计，挂载到行数据上
          const records = result.records ?? [];
          if (records.length > 0) {
            const stats = await getMomentTaskStats(records.map((r) => r.id));
            const statMap = new Map(stats.map((s) => [String(s.taskId), s]));
            for (const record of records) {
              (record as { _stat?: MomentApi.WxMomentTaskStat })._stat =
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
  } as VxeTableGridOptions<MomentApi.WxMomentTask>,
});

const [InvokeLogDrawer, invokeLogDrawerApi] = useVbenDrawer({
  connectedComponent: InvokeLogDrawerComp,
  destroyOnClose: true,
});

const [EditDrawer, editDrawerApi] = useVbenDrawer({
  connectedComponent: EditDrawerComp,
  destroyOnClose: true,
});

function onInvokeLog(row: MomentApi.WxMomentTask) {
  invokeLogDrawerApi.setData({ corpId: row.corpId, taskId: row.id }).open();
}

function onEdit(row: MomentApi.WxMomentTask) {
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

function onDelete(row: MomentApi.WxMomentTask) {
  Modal.confirm({
    content: $t('moment.deleteRowConfirm', [row.taskName]),
    onOk: async () => {
      await delMomentTasks(String(row.id));
      message.success($t('moment.deleteSuccess'));
      gridApi.query();
    },
    title: $t('moment.deleteConfirm'),
  });
}

function statusText(status?: number) {
  switch (status) {
    case 0: {
      return $t('moment.statusDisabled');
    }
    case 1: {
      return $t('moment.statusEnabled');
    }
    case 2: {
      return $t('moment.statusRunning');
    }
    case 3: {
      return $t('moment.statusDone');
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
          :corp-placeholder="$t('moment.corpPlaceholder')"
          class="min-h-0 flex-1"
          @change="onMemberChange"
          @corp-change="onCorpChange"
          @dept-change="onDeptChange"
        >
          <template #actions>
            <Button
              v-access:code="'moment:sync'"
              block
              :disabled="!corpFilter"
              :loading="syncing"
              type="primary"
              @click="onSync"
            >
              <IconifyIcon class="size-4" icon="lucide:refresh-cw" />
              {{ $t('moment.sync') }}
            </Button>
          </template>
        </EmployeePanel>
      </div>

      <!-- 右侧：任务表格（含报表列） -->
      <div class="h-full min-w-0 flex-1">
        <Grid>
          <template #toolbar-tools>
            <Button
              v-access:code="'moment:add'"
              class="mr-2"
              type="primary"
              @click="onCreate"
            >
              <Plus class="size-4" />
              {{ $t('moment.create') }}
            </Button>
          </template>
          <template #taskName="{ row }">
            <div class="font-medium">{{ row.taskName }}</div>
            <div class="text-xs text-muted-foreground">
              {{
                row._stat
                  ? $t('moment.batchCount', [row._stat.batchCnt ?? 0])
                  : $t('moment.neverExecuted')
              }}
            </div>
          </template>
          <template #visibleType="{ row }">
            {{ visibleTypeText(row.visibleType) }}
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
          <template #statPublished="{ row }">
            <span class="text-green-600">
              {{ row._stat ? fmtCount(row._stat.publishedCnt) : '-' }}
            </span>
          </template>
          <template #publishRate="{ row }">
            <div
              v-if="publishRateOf(row._stat) !== undefined"
              class="flex items-center gap-1.5"
            >
              <div class="h-1.5 w-14 overflow-hidden rounded bg-muted">
                <div
                  class="h-full rounded bg-primary"
                  :style="{ width: `${publishRateOf(row._stat)}%` }"
                ></div>
              </div>
              <span class="text-xs">
                {{ publishRateOf(row._stat)!.toFixed(1) }}%
              </span>
            </div>
            <span v-else>-</span>
          </template>
          <template #statUnpublished="{ row }">
            <span
              :class="
                (row._stat?.unpublishedCnt ?? 0) > 0 ? 'text-amber-500' : ''
              "
            >
              {{ row._stat ? fmtCount(row._stat.unpublishedCnt) : '-' }}
            </span>
          </template>
          <template #operation="{ row }">
            <Button size="small" type="link" @click="onInvokeLog(row)">
              {{ $t('moment.invokeLog') }}
            </Button>
            <Button
              v-access:code="'moment:update'"
              size="small"
              type="link"
              @click="onEdit(row)"
            >
              {{ $t('moment.edit') }}
            </Button>
            <Button
              v-access:code="'moment:delete'"
              danger
              size="small"
              type="link"
              @click="onDelete(row)"
            >
              {{ $t('moment.delete') }}
            </Button>
          </template>
        </Grid>
      </div>
    </div>
  </Page>
</template>
