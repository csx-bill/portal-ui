<script lang="ts" setup>
import type { MassApi } from '#/api';

import { computed, reactive, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, Modal } from 'antdv-next';

import {
  getInvokeLogById,
  getInvokeLogPage,
  getMassTaskBatchStats,
} from '#/api';
import { $t } from '#/locales';

/**
 * 群发发送记录抽屉（按任务维度展示）。
 * 上半部分为批次列表（每次执行一条 invoke_log，含送达率摘要，
 * 底部附"全部批次合计"）；点击批次，下半部分展示该批次的送达统计：
 * 四项结果指标 + 状态分布 + 成员发送明细。
 * 统计来自 /scrm/mass/statistic/task/{taskId}；行内"查看内容"
 * 拉取 /scrm/mass/invokeLog/{id} 展示该次调用的内容快照。
 */
const taskInfo = reactive({
  corpId: '',
  taskId: undefined as number | string | undefined,
});

const loading = ref(false);
const invokes = ref<MassApi.WxMassInvokeLog[]>([]);
const statResp = ref<MassApi.WxMassTaskBatchStatResp>();
/** 选中的批次（invokeId 字符串，'all' 为全部批次合计），默认最新批次 */
const selectedKey = ref('');

const contents = ref<MassApi.WxMassContent[]>([]);
const contentsOpen = ref(false);

const failTotal = (stat?: { failFriendCnt?: number; failOtherCnt?: number }) =>
  stat ? (stat.failFriendCnt ?? 0) + (stat.failOtherCnt ?? 0) : 0;

const [LogDrawer, logDrawerApi] = useVbenDrawer({
  footer: false,
  onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = logDrawerApi.getData() as
      | undefined
      | { corpId?: string; taskId?: number | string };
    taskInfo.taskId = data?.taskId;
    taskInfo.corpId = data?.corpId ?? '';
    load();
  },
});

async function load() {
  loading.value = true;
  selectedKey.value = '';
  try {
    const [pageResult, statResult] = await Promise.all([
      getInvokeLogPage({
        corpId: taskInfo.corpId,
        current: 1,
        size: 50,
        taskId: taskInfo.taskId,
      }),
      taskInfo.taskId
        ? getMassTaskBatchStats(taskInfo.taskId).catch(() => undefined)
        : undefined,
    ]);
    invokes.value = pageResult.records ?? [];
    statResp.value = statResult;
    // 默认选中最新一个有统计数据的批次；都没有则选"全部批次合计"
    const rows = batchRows.value;
    const firstWithStat = rows.find((row) => row.stat && row.key !== 'all');
    const fallbackKey = statResult?.summary ? 'all' : '';
    selectedKey.value = firstWithStat ? firstWithStat.key : fallbackKey;
  } finally {
    loading.value = false;
  }
}

/** 批次列表：各发送记录（附送达率摘要）+ 底部"全部批次合计" */
interface BatchRow {
  invoke?: MassApi.WxMassInvokeLog;
  key: string;
  label: string;
  meta: string;
  rate?: number;
  stat?: MassApi.WxMassBatchStat | MassApi.WxMassTaskStat;
}

/** invokeId → 批次统计（/statistic/task/{taskId} 按批次聚合返回） */
const statMap = computed(() => {
  const map = new Map<string, MassApi.WxMassBatchStat>();
  for (const batch of statResp.value?.batches ?? []) {
    map.set(String(batch.invokeId), batch);
  }
  return map;
});

const batchRows = computed<BatchRow[]>(() => {
  const rows: BatchRow[] = invokes.value.map((inv, index) => {
    const stat = statMap.value.get(String(inv.id));
    const total = stat?.totalCnt ?? 0;
    return {
      invoke: inv,
      key: String(inv.id),
      // 最新一次执行序号最大（列表按执行时间倒序）
      label: $t('mass.batchNth', [invokes.value.length - index]),
      meta: [inv.createTime, inv.triggerType, inv.sender]
        .filter(Boolean)
        .join(' · '),
      rate: total ? ((stat?.deliveredCnt ?? 0) / total) * 100 : undefined,
      stat,
    };
  });
  const summary = statResp.value?.summary;
  if (summary && (summary.batchCnt ?? 0) > 0) {
    rows.push({
      key: 'all',
      label: $t('mass.allBatches'),
      meta: $t('mass.batchExecCount', [summary.batchCnt ?? 0]),
      rate: summary.totalCnt
        ? ((summary.deliveredCnt ?? 0) / summary.totalCnt) * 100
        : undefined,
      stat: summary,
    });
  }
  return rows;
});

const currentStat = computed(() => {
  const row = batchRows.value.find((item) => item.key === selectedKey.value);
  return row?.stat;
});

/** 成员发送明细：单批次取该批次成员，全部合计按成员跨批次累加 */
const memberRows = computed(() => {
  const map = new Map<string, MassApi.WxMassUserStat>();
  if (selectedKey.value === 'all') {
    for (const batch of statResp.value?.batches ?? []) {
      for (const member of batch.members ?? []) {
        const acc: MassApi.WxMassUserStat = map.get(member.userId) ?? {
          deliveredCnt: 0,
          failFriendCnt: 0,
          failOtherCnt: 0,
          totalCnt: 0,
          unsentCnt: 0,
          userId: member.userId,
        };
        acc.totalCnt = (acc.totalCnt ?? 0) + (member.totalCnt ?? 0);
        acc.deliveredCnt = (acc.deliveredCnt ?? 0) + (member.deliveredCnt ?? 0);
        acc.unsentCnt = (acc.unsentCnt ?? 0) + (member.unsentCnt ?? 0);
        acc.failFriendCnt =
          (acc.failFriendCnt ?? 0) + (member.failFriendCnt ?? 0);
        acc.failOtherCnt = (acc.failOtherCnt ?? 0) + (member.failOtherCnt ?? 0);
        map.set(member.userId, acc);
      }
    }
  } else {
    const stat = statResp.value?.batches?.find(
      (b) => String(b.invokeId) === selectedKey.value,
    );
    for (const member of stat?.members ?? []) {
      map.set(member.userId, { ...member });
    }
  }
  return [...map.values()].toSorted(
    (a, b) => (b.totalCnt ?? 0) - (a.totalCnt ?? 0),
  );
});

/** 状态分布（进度条行）：已发送 / 未发送 / 两类失败 */
const distRows = computed(() => {
  const stat = currentStat.value;
  if (!stat) return [];
  const total = Math.max(1, stat.totalCnt ?? 0);
  return [
    {
      cls: 'bg-green-500',
      label: $t('mass.sentDist'),
      pct: ((stat.deliveredCnt ?? 0) / total) * 100,
      value: stat.deliveredCnt ?? 0,
    },
    {
      cls: 'bg-amber-500',
      label: $t('mass.unsentDist'),
      pct: ((stat.unsentCnt ?? 0) / total) * 100,
      value: stat.unsentCnt ?? 0,
    },
    {
      cls: 'bg-red-500',
      label: $t('mass.failFriendDist'),
      pct: ((stat.failFriendCnt ?? 0) / total) * 100,
      value: stat.failFriendCnt ?? 0,
    },
    {
      cls: 'bg-purple-500',
      label: $t('mass.failOtherDist'),
      pct: ((stat.failOtherCnt ?? 0) / total) * 100,
      value: stat.failOtherCnt ?? 0,
    },
  ];
});

function rateText(rate?: number) {
  return rate === undefined ? '-' : `${rate.toFixed(1)}%`;
}

function onViewContent(row: MassApi.WxMassInvokeLog) {
  getInvokeLogById(row.id).then((detail) => {
    contents.value = detail.contentList ?? [];
    contentsOpen.value = true;
  });
}
</script>
<template>
  <LogDrawer class="w-full max-w-220" :title="$t('mass.invokeLog')">
    <div class="mx-2 flex flex-col gap-3">
      <div v-if="loading" class="py-6 text-center text-sm opacity-60">
        loading...
      </div>
      <template v-else-if="batchRows.length > 0">
        <!-- 批次列表 -->
        <div class="flex flex-col gap-1.5">
          <button
            v-for="row in batchRows"
            :key="row.key"
            class="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:border-primary"
            :class="
              selectedKey === row.key
                ? 'border-primary bg-primary/5'
                : 'border-border'
            "
            type="button"
            @click="selectedKey = row.key"
          >
            <span class="shrink-0 font-medium">{{ row.label }}</span>
            <span
              v-if="row.key === 'all'"
              class="min-w-0 flex-1 truncate text-xs text-muted-foreground"
            >
              {{ row.meta }}
            </span>
            <template v-else>
              <span
                class="min-w-0 flex-1 truncate text-xs text-muted-foreground"
              >
                {{ row.meta }}
              </span>
              <Button
                class="shrink-0"
                size="small"
                type="link"
                @click.stop="onViewContent(row.invoke!)"
              >
                {{ $t('mass.viewContent') }}
              </Button>
            </template>
            <span class="shrink-0 font-medium">
              {{ rateText(row.rate) }}
            </span>
          </button>
        </div>

        <!-- 选中批次的送达统计 -->
        <div v-if="!currentStat" class="text-xs text-muted-foreground">
          {{ $t('mass.statBatchEmpty') }}
        </div>
        <template v-else>
          <div class="grid grid-cols-4 gap-2">
            <div class="rounded-md border border-border p-2.5">
              <div class="text-xs text-muted-foreground">
                {{ $t('mass.statTotal') }}
              </div>
              <div class="mt-0.5 text-lg font-medium">
                {{ (currentStat.totalCnt ?? 0).toLocaleString() }}
              </div>
            </div>
            <div class="rounded-md border border-border p-2.5">
              <div class="text-xs text-muted-foreground">
                {{ $t('mass.statDelivered') }}
              </div>
              <div class="mt-0.5 text-lg font-medium text-green-600">
                {{ (currentStat.deliveredCnt ?? 0).toLocaleString() }}
              </div>
            </div>
            <div class="rounded-md border border-border p-2.5">
              <div class="text-xs text-muted-foreground">
                {{ $t('mass.statUnsent') }}
              </div>
              <div class="mt-0.5 text-lg font-medium text-amber-500">
                {{ (currentStat.unsentCnt ?? 0).toLocaleString() }}
              </div>
            </div>
            <div class="rounded-md border border-border p-2.5">
              <div class="text-xs text-muted-foreground">
                {{ $t('mass.statFail') }}
              </div>
              <div class="mt-0.5 text-lg font-medium text-red-500">
                {{ failTotal(currentStat).toLocaleString() }}
              </div>
            </div>
          </div>

          <div class="rounded-md border border-border p-3">
            <div class="mb-2 text-sm font-medium">
              {{ $t('mass.statDist') }}
            </div>
            <div
              v-for="row in distRows"
              :key="row.label"
              class="flex items-center gap-2 border-b border-border py-1.5 text-xs last:border-b-0"
            >
              <span class="size-2 shrink-0 rounded-sm" :class="row.cls"></span>
              <span class="w-44 shrink-0 truncate text-muted-foreground">
                {{ row.label }}
              </span>
              <span class="w-12 shrink-0 text-right">
                {{ row.value.toLocaleString() }}
              </span>
              <div
                class="h-1.5 min-w-0 flex-1 overflow-hidden rounded bg-muted"
              >
                <div
                  class="h-full rounded"
                  :class="row.cls"
                  :style="{ width: `${row.pct}%` }"
                ></div>
              </div>
              <span class="w-12 shrink-0 text-right">
                {{ row.pct.toFixed(1) }}%
              </span>
            </div>
          </div>

          <div class="rounded-md border border-border p-3">
            <div class="mb-2 text-sm font-medium">
              {{ $t('mass.memberStat') }}
            </div>
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-border text-muted-foreground">
                  <th class="py-1.5 text-left font-normal">
                    {{ $t('mass.senderList') }}
                  </th>
                  <th class="py-1.5 text-right font-normal">
                    {{ $t('mass.statTotal') }}
                  </th>
                  <th class="py-1.5 text-right font-normal">
                    {{ $t('mass.statDelivered') }}
                  </th>
                  <th class="py-1.5 text-right font-normal">
                    {{ $t('mass.statUnsent') }}
                  </th>
                  <th class="py-1.5 text-right font-normal">
                    {{ $t('mass.statFail') }}
                  </th>
                  <th class="py-1.5 text-right font-normal">
                    {{ $t('mass.deliveryRate') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="member in memberRows"
                  :key="member.userId"
                  class="border-b border-border last:border-b-0"
                >
                  <td class="py-1.5">{{ member.userId }}</td>
                  <td class="py-1.5 text-right">
                    {{ (member.totalCnt ?? 0).toLocaleString() }}
                  </td>
                  <td class="py-1.5 text-right">
                    {{ (member.deliveredCnt ?? 0).toLocaleString() }}
                  </td>
                  <td class="py-1.5 text-right text-amber-500">
                    {{ (member.unsentCnt ?? 0).toLocaleString() }}
                  </td>
                  <td class="py-1.5 text-right">
                    <span
                      :class="
                        (member.failFriendCnt ?? 0) +
                          (member.failOtherCnt ?? 0) >
                        0
                          ? 'text-red-500'
                          : ''
                      "
                    >
                      {{
                        failTotal({
                          failFriendCnt: member.failFriendCnt,
                          failOtherCnt: member.failOtherCnt,
                        }).toLocaleString()
                      }}
                    </span>
                  </td>
                  <td class="py-1.5 text-right">
                    {{
                      member.totalCnt
                        ? `${(
                            ((member.deliveredCnt ?? 0) / member.totalCnt) *
                            100
                          ).toFixed(1)}%`
                        : '-'
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="text-xs text-muted-foreground">
            {{ $t('mass.statSyncTip') }}
          </div>
        </template>
      </template>
      <div v-else class="py-8 text-center text-sm text-muted-foreground">
        {{ $t('mass.invokeEmpty') }}
      </div>
    </div>
    <Modal
      v-model:open="contentsOpen"
      :footer="null"
      :title="$t('mass.contentList')"
    >
      <div class="flex max-h-100 flex-col gap-3 overflow-auto">
        <div
          v-for="(content, index) in contents"
          :key="index"
          class="rounded-md border border-border p-3"
        >
          <div class="mb-1 text-xs text-muted-foreground">
            {{ $t('mass.msgType') }}: {{ content.msgType }}
          </div>
          <div v-if="content.textContent" class="whitespace-pre-wrap">
            {{ content.textContent }}
          </div>
          <div v-if="content.url" class="break-all text-xs">
            {{ $t('mass.url') }}: {{ content.url }}
          </div>
          <div v-if="content.filename" class="text-xs">
            {{ $t('mass.filename') }}: {{ content.filename }}
          </div>
          <div v-if="content.linkTitle" class="text-sm font-medium">
            {{ content.linkTitle }}
          </div>
          <div v-if="content.linkDesc" class="text-xs">
            {{ content.linkDesc }}
          </div>
          <div v-if="content.linkUrl" class="break-all text-xs">
            {{ content.linkUrl }}
          </div>
          <div v-if="content.miniTitle" class="text-sm font-medium">
            {{ content.miniTitle }}
          </div>
          <div v-if="content.miniPage" class="break-all text-xs">
            {{ content.miniPage }}
          </div>
          <div v-if="content.miniAppid" class="text-xs">
            {{ content.miniAppid }}
          </div>
        </div>
        <div
          v-if="contents.length === 0"
          class="text-center text-sm text-muted-foreground"
        >
          {{ $t('mass.contentEmpty') }}
        </div>
      </div>
    </Modal>
  </LogDrawer>
</template>
