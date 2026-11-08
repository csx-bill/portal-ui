<script lang="ts" setup>
import type { MomentApi } from '#/api';

import { computed, reactive, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, Modal, Tag } from 'antdv-next';

import {
  getMomentInvokeLogById,
  getMomentInvokeLogPage,
  getMomentTaskBatchStats,
} from '#/api';
import { $t } from '#/locales';

/**
 * 朋友圈发表记录抽屉（按任务维度展示）。
 * 上半部分为批次列表（每次执行一条 invoke_log，含创建状态与发表率摘要，
 * 底部附"全部批次合计"）；点击批次，下半部分展示该批次的发表统计：
 * 三项结果指标 + 发表状态分布 + 成员发表明细。
 * 统计来自 /scrm/moment/statistic/task/{taskId}（数据源 wx_moment_send_log，
 * 结果同步 Job 在任务创建完成后拉取逐成员发表结果落库）。
 * 行内"查看内容"拉取 /scrm/moment/invokeLog/{id} 展示内容快照。
 */
const taskInfo = reactive({
  corpId: '',
  taskId: undefined as number | string | undefined,
});

const loading = ref(false);
const invokes = ref<MomentApi.WxMomentInvokeLog[]>([]);
const statResp = ref<MomentApi.WxMomentTaskBatchStatResp>();
/** 选中的批次（invokeId 字符串，'all' 为全部批次合计） */
const selectedKey = ref('');

const contents = ref<MomentApi.WxMomentContent[]>([]);
const contentsOpen = ref(false);

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
      getMomentInvokeLogPage({
        corpId: taskInfo.corpId,
        current: 1,
        size: 50,
        taskId: taskInfo.taskId,
      }),
      taskInfo.taskId
        ? getMomentTaskBatchStats(taskInfo.taskId).catch(() => undefined)
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

/** invokeId → 批次统计 */
const statMap = computed(() => {
  const map = new Map<string, MomentApi.WxMomentBatchStat>();
  for (const batch of statResp.value?.batches ?? []) {
    map.set(String(batch.invokeId), batch);
  }
  return map;
});

function momentStatusText(status?: number) {
  switch (status) {
    case 1: {
      return $t('moment.momentStatus1');
    }
    case 2: {
      return $t('moment.momentStatus2');
    }
    case 3: {
      return $t('moment.momentStatus3');
    }
    default: {
      return status;
    }
  }
}

function momentStatusColor(status?: number) {
  switch (status) {
    case 3: {
      return 'success';
    }
    case 2: {
      return 'processing';
    }
    default: {
      return 'default';
    }
  }
}

/** 批次列表：各发表记录（附发表率摘要）+ 底部"全部批次合计" */
interface BatchRow {
  invoke?: MomentApi.WxMomentInvokeLog;
  key: string;
  label: string;
  meta: string;
  rate?: number;
  stat?: MomentApi.WxMomentBatchStat | MomentApi.WxMomentTaskStat;
}

const batchRows = computed<BatchRow[]>(() => {
  const rows: BatchRow[] = invokes.value.map((inv, index) => {
    const stat = statMap.value.get(String(inv.id));
    const total = stat?.totalCnt ?? 0;
    return {
      invoke: inv,
      key: String(inv.id),
      // 最新一次执行序号最大（列表按执行时间倒序）
      label: $t('moment.batchNth', [invokes.value.length - index]),
      meta: [inv.createTime, inv.triggerType].filter(Boolean).join(' · '),
      rate: total ? ((stat?.publishedCnt ?? 0) / total) * 100 : undefined,
      stat,
    };
  });
  const summary = statResp.value?.summary;
  if (summary && (summary.batchCnt ?? 0) > 0) {
    rows.push({
      key: 'all',
      label: $t('moment.allBatches'),
      meta: $t('moment.batchExecCount', [summary.batchCnt ?? 0]),
      rate: summary.totalCnt
        ? ((summary.publishedCnt ?? 0) / summary.totalCnt) * 100
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

/** 成员发表明细：单批次取该批次成员，全部合计按成员跨批次累加 */
const memberRows = computed(() => {
  const map = new Map<string, MomentApi.WxMomentUserStat>();
  if (selectedKey.value === 'all') {
    for (const batch of statResp.value?.batches ?? []) {
      for (const member of batch.members ?? []) {
        const acc: MomentApi.WxMomentUserStat = map.get(member.userId) ?? {
          publishedCnt: 0,
          totalCnt: 0,
          unpublishedCnt: 0,
          userId: member.userId,
        };
        acc.totalCnt = (acc.totalCnt ?? 0) + (member.totalCnt ?? 0);
        acc.publishedCnt = (acc.publishedCnt ?? 0) + (member.publishedCnt ?? 0);
        acc.unpublishedCnt =
          (acc.unpublishedCnt ?? 0) + (member.unpublishedCnt ?? 0);
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

/** 发表状态分布（进度条行）：已发表 / 未发表 */
const distRows = computed(() => {
  const stat = currentStat.value;
  if (!stat) return [];
  const total = Math.max(1, stat.totalCnt ?? 0);
  return [
    {
      cls: 'bg-green-500',
      label: $t('moment.publishedDist'),
      pct: ((stat.publishedCnt ?? 0) / total) * 100,
      value: stat.publishedCnt ?? 0,
    },
    {
      cls: 'bg-amber-500',
      label: $t('moment.unpublishedDist'),
      pct: ((stat.unpublishedCnt ?? 0) / total) * 100,
      value: stat.unpublishedCnt ?? 0,
    },
  ];
});

function rateText(rate?: number) {
  return rate === undefined ? '-' : `${rate.toFixed(1)}%`;
}

function onViewContent(row: MomentApi.WxMomentInvokeLog) {
  getMomentInvokeLogById(row.id).then((detail) => {
    contents.value = detail.contentList ?? [];
    contentsOpen.value = true;
  });
}
</script>
<template>
  <LogDrawer class="w-full max-w-220" :title="$t('moment.invokeLog')">
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
            <template v-if="row.key !== 'all' && row.invoke">
              <Tag
                class="mr-0 shrink-0"
                :color="momentStatusColor(row.invoke.momentStatus)"
              >
                {{ momentStatusText(row.invoke.momentStatus) }}
              </Tag>
              <span
                class="min-w-0 flex-1 truncate text-xs text-muted-foreground"
              >
                {{ row.meta }}
              </span>
              <Button
                class="shrink-0"
                size="small"
                type="link"
                @click.stop="onViewContent(row.invoke)"
              >
                {{ $t('moment.viewContent') }}
              </Button>
            </template>
            <template v-else>
              <span
                class="min-w-0 flex-1 truncate text-xs text-muted-foreground"
              >
                {{ row.meta }}
              </span>
            </template>
            <span class="shrink-0 font-medium">
              {{ rateText(row.rate) }}
            </span>
          </button>
        </div>

        <!-- 选中批次的发表统计 -->
        <div v-if="!currentStat" class="text-xs text-muted-foreground">
          {{ $t('moment.statBatchEmpty') }}
        </div>
        <template v-else>
          <div class="grid grid-cols-3 gap-2">
            <div class="rounded-md border border-border p-2.5">
              <div class="text-xs text-muted-foreground">
                {{ $t('moment.statTotal') }}
              </div>
              <div class="mt-0.5 text-lg font-medium">
                {{ (currentStat.totalCnt ?? 0).toLocaleString() }}
              </div>
            </div>
            <div class="rounded-md border border-border p-2.5">
              <div class="text-xs text-muted-foreground">
                {{ $t('moment.statPublished') }}
              </div>
              <div class="mt-0.5 text-lg font-medium text-green-600">
                {{ (currentStat.publishedCnt ?? 0).toLocaleString() }}
              </div>
            </div>
            <div class="rounded-md border border-border p-2.5">
              <div class="text-xs text-muted-foreground">
                {{ $t('moment.statUnpublished') }}
              </div>
              <div class="mt-0.5 text-lg font-medium text-amber-500">
                {{ (currentStat.unpublishedCnt ?? 0).toLocaleString() }}
              </div>
            </div>
          </div>

          <div class="rounded-md border border-border p-3">
            <div class="mb-2 text-sm font-medium">
              {{ $t('moment.statDist') }}
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
              {{ $t('moment.memberStat') }}
            </div>
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-border text-muted-foreground">
                  <th class="py-1.5 text-left font-normal">
                    {{ $t('moment.userPlaceholder') }}
                  </th>
                  <th class="py-1.5 text-right font-normal">
                    {{ $t('moment.statPublished') }}
                  </th>
                  <th class="py-1.5 text-right font-normal">
                    {{ $t('moment.statUnpublished') }}
                  </th>
                  <th class="py-1.5 text-right font-normal">
                    {{ $t('moment.publishRate') }}
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
                  <td class="py-1.5 text-right text-green-600">
                    {{ (member.publishedCnt ?? 0).toLocaleString() }}
                  </td>
                  <td class="py-1.5 text-right text-amber-500">
                    {{ (member.unpublishedCnt ?? 0).toLocaleString() }}
                  </td>
                  <td class="py-1.5 text-right">
                    {{
                      member.totalCnt
                        ? `${(
                            ((member.publishedCnt ?? 0) / member.totalCnt) *
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
            {{ $t('moment.statSyncTip') }}
          </div>
        </template>
      </template>
      <div v-else class="py-8 text-center text-sm text-muted-foreground">
        {{ $t('moment.invokeEmpty') }}
      </div>
    </div>
    <Modal
      v-model:open="contentsOpen"
      :footer="null"
      :title="$t('moment.contentList')"
    >
      <div class="flex max-h-100 flex-col gap-3 overflow-auto">
        <div
          v-for="(content, index) in contents"
          :key="index"
          class="rounded-md border border-border p-3"
        >
          <div class="mb-1 text-xs text-muted-foreground">
            {{ $t('moment.msgType') }}: {{ content.msgType }}
          </div>
          <div v-if="content.textContent" class="whitespace-pre-wrap">
            {{ content.textContent }}
          </div>
          <div v-if="content.url" class="break-all text-xs">
            {{ $t('moment.url') }}: {{ content.url }}
          </div>
          <div v-if="content.filename" class="text-xs">
            {{ $t('moment.filename') }}: {{ content.filename }}
          </div>
          <div v-if="content.linkTitle" class="text-sm font-medium">
            {{ content.linkTitle }}
          </div>
          <div v-if="content.linkUrl" class="break-all text-xs">
            {{ content.linkUrl }}
          </div>
        </div>
        <div
          v-if="contents.length === 0"
          class="text-center text-sm text-muted-foreground"
        >
          {{ $t('moment.contentEmpty') }}
        </div>
      </div>
    </Modal>
  </LogDrawer>
</template>
