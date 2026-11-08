<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import type { DashboardApi } from '#/api';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { Button, message, Select } from 'antdv-next';

import {
  getCorpList,
  getDashboardMemberRank,
  getDashboardSummary,
  getDashboardTrend,
  getMassTaskPage,
  getMassTaskStats,
  getMomentTaskPage,
  getMomentTaskStats,
} from '#/api';
import { $t } from '#/locales';

/**
 * 工作台看板（后端 WxDashboardController /scrm/dashboard/*）。
 *
 * 客户资产与运营效果总览：指标卡（含环比）+ 客户增长趋势 +
 * 成员客户数 TOP + 客群活跃趋势 + 最近任务效果。
 * 全部为本地表实时口径；群发送达率/朋友圈发表率复用对应模块的
 * 统计数据源（wx_mass_target_log / wx_moment_send_log）。
 */

const corpFilter = ref<string>();
const corpOptions = ref<{ label: string; value: string }[]>([]);
const range = ref<7 | 30>(7);
const loading = ref(false);

const summary = ref<DashboardApi.DashboardSummary>();
const trend = ref<DashboardApi.DashboardTrend[]>([]);
const memberRank = ref<DashboardApi.MemberRank[]>([]);

interface RecentTask {
  cls: string;
  name: string;
  rate: null | number;
  type: string;
}
const recentTasks = ref<RecentTask[]>([]);

const trendRef = ref<EchartsUIType>();
const { renderEcharts: renderTrendChart } = useEcharts(trendRef);
const groupRef = ref<EchartsUIType>();
const { renderEcharts: renderGroupChart } = useEcharts(groupRef);

function fmtCount(count?: null | number) {
  return (count ?? 0).toLocaleString('zh-Hans-CN');
}

/** 环比文案：数量类 */
function deltaAbs(cur?: null | number, prev?: null | number) {
  const diff = (cur ?? 0) - (prev ?? 0);
  if (diff > 0)
    return { cls: 'text-green-600', text: `较上期 +${fmtCount(diff)}` };
  if (diff < 0)
    return { cls: 'text-red-500', text: `较上期 −${fmtCount(-diff)}` };
  return { cls: 'text-muted-foreground', text: '较上期 持平' };
}

/** 环比文案：比率类（pp 差值，正负好坏由 goodUp 决定） */
function deltaRate(cur?: null | number, prev?: null | number, goodUp = true) {
  if (
    cur === null ||
    cur === undefined ||
    prev === null ||
    prev === undefined
  ) {
    return { cls: 'text-muted-foreground', text: '较上期 —' };
  }
  const diff = cur - prev;
  if (Math.abs(diff) < 0.05)
    return { cls: 'text-muted-foreground', text: '较上期 持平' };
  const good = diff > 0 ? goodUp : !goodUp;
  return {
    cls: good ? 'text-green-600' : 'text-red-500',
    text: `较上期 ${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}pp`,
  };
}

/** 比率字段可能为 null（无数据），统一转展示文案 */
function rateText(rate?: null | number) {
  return rate === null || rate === undefined ? '-' : `${rate.toFixed(1)}%`;
}

const cards = computed(() => [
  {
    delta: deltaAbs(
      summary.value?.customerTotal,
      summary.value?.customerTotalPrev,
    ),
    label: $t('dashboard.custTotal'),
    value: fmtCount(summary.value?.customerTotal),
  },
  {
    delta: deltaAbs(summary.value?.newCustomer, summary.value?.newCustomerPrev),
    label: $t('dashboard.newCustomer'),
    value: fmtCount(summary.value?.newCustomer),
  },
  {
    delta: deltaAbs(summary.value?.groupTotal, summary.value?.groupTotalPrev),
    label: $t('dashboard.groupTotal'),
    value: fmtCount(summary.value?.groupTotal),
  },
  {
    delta: deltaAbs(summary.value?.memberTotal, summary.value?.memberTotalPrev),
    label: $t('dashboard.memberTotal'),
    value: fmtCount(summary.value?.memberTotal),
  },
  {
    delta: deltaRate(
      summary.value?.massDeliveredRate,
      summary.value?.massDeliveredRatePrev,
    ),
    label: $t('dashboard.massRate'),
    value: rateText(summary.value?.massDeliveredRate),
  },
  {
    delta: deltaRate(
      summary.value?.momentPublishRate,
      summary.value?.momentPublishRatePrev,
    ),
    label: $t('dashboard.momentRate'),
    value: rateText(summary.value?.momentPublishRate),
  },
]);

const memberTopMax = computed(() => memberRank.value[0]?.customerCnt ?? 0);

async function loadCorpOptions() {
  const corps = await getCorpList();
  corpOptions.value = corps
    .filter((corp) => corp.authStatus === 1)
    .map((corp) => ({
      label: corp.corpName || corp.corpId,
      value: corp.corpId,
    }));
}

function renderTrend() {
  const data = trend.value;
  renderTrendChart({
    grid: { bottom: 0, containLabel: true, left: '1%', right: '1%', top: '8%' },
    series: [
      {
        barMaxWidth: 18,
        data: data.map((row) => row.newCustomer),
        itemStyle: { color: '#1677ff', borderRadius: [2, 2, 0, 0] },
        name: $t('dashboard.newCustomer'),
        type: 'bar',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisLabel: { interval: Math.ceil(data.length / 8) - 1 },
      data: data.map((row) => row.date.slice(5)),
      type: 'category',
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { opacity: 0.4 } } },
  });
}

function renderGroup() {
  const data = trend.value;
  renderGroupChart({
    color: ['#1677ff', '#16a34a', '#dc2626'],
    grid: {
      bottom: 0,
      containLabel: true,
      left: '1%',
      right: '1%',
      top: '12%',
    },
    legend: { top: 0 },
    series: [
      {
        barMaxWidth: 14,
        data: data.map((row) => row.newGroup),
        name: $t('dashboard.legendNewGroup'),
        type: 'bar',
        yAxisIndex: 0,
      },
      {
        data: data.map((row) => row.newMember),
        name: $t('dashboard.legendNewMember'),
        smooth: true,
        type: 'line',
        yAxisIndex: 1,
      },
      {
        data: data.map((row) => row.quitMember),
        name: $t('dashboard.legendQuit'),
        smooth: true,
        type: 'line',
        yAxisIndex: 1,
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisLabel: { interval: Math.ceil(data.length / 8) - 1 },
      data: data.map((row) => row.date.slice(5)),
      type: 'category',
    },
    yAxis: [
      { type: 'value', splitLine: { lineStyle: { opacity: 0.4 } } },
      { type: 'value', splitLine: { show: false } },
    ],
  });
}

/** 最近任务效果：群发/朋友圈最新任务，全部批次合计口径 */
async function loadRecentTasks() {
  const corpId = corpFilter.value;
  if (!corpId) return;
  const [massPage, momentPage] = await Promise.all([
    getMassTaskPage({ corpId, current: 1, size: 3 }),
    getMomentTaskPage({ corpId, current: 1, size: 2 }),
  ]);
  const massIds = (massPage.records ?? []).map((row) => row.id);
  const momentIds = (momentPage.records ?? []).map((row) => row.id);
  const [massStats, momentStats] = await Promise.all([
    massIds.length > 0 ? getMassTaskStats(massIds) : Promise.resolve([]),
    momentIds.length > 0 ? getMomentTaskStats(momentIds) : Promise.resolve([]),
  ]);
  const massMap = new Map(massStats.map((s) => [String(s.taskId), s]));
  const momentMap = new Map(momentStats.map((s) => [String(s.taskId), s]));
  const rows: RecentTask[] = [];
  for (const task of massPage.records ?? []) {
    const stat = massMap.get(String(task.id));
    const totalCnt = stat?.totalCnt ?? 0;
    if (stat && totalCnt > 0) {
      rows.push({
        cls: 'b-blue',
        name: task.taskName ?? '-',
        rate: ((stat.deliveredCnt ?? 0) / totalCnt) * 100,
        type: $t('dashboard.typeMass'),
      });
    }
  }
  for (const task of momentPage.records ?? []) {
    const stat = momentMap.get(String(task.id));
    const totalCnt = stat?.totalCnt ?? 0;
    if (stat && totalCnt > 0) {
      rows.push({
        cls: 'b-purple',
        name: task.taskName ?? '-',
        rate: ((stat.publishedCnt ?? 0) / totalCnt) * 100,
        type: $t('dashboard.typeMoment'),
      });
    }
  }
  recentTasks.value = rows.slice(0, 5);
}

async function loadAll() {
  const corpId = corpFilter.value;
  if (!corpId) return;
  loading.value = true;
  try {
    const params = { corpId, days: range.value };
    const [summaryResult, trendResult, rankResult] = await Promise.all([
      getDashboardSummary(params),
      getDashboardTrend(params),
      getDashboardMemberRank({ ...params, limit: 10 }),
    ]);
    summary.value = summaryResult;
    trend.value = trendResult;
    memberRank.value = rankResult;
    renderTrend();
    renderGroup();
    // 最近任务：不阻塞主区块
    loadRecentTasks().catch(() => {
      recentTasks.value = [];
    });
  } finally {
    loading.value = false;
  }
}

function onRangeChange(days: 7 | 30) {
  range.value = days;
  loadAll();
}

function onCorpChange() {
  loadAll();
}

onMounted(async () => {
  await loadCorpOptions();
  const firstCorp = corpOptions.value[0];
  if (!corpFilter.value && firstCorp) {
    corpFilter.value = firstCorp.value;
  }
  loadAll().catch(() => {
    message.error($t('dashboard.noData'));
  });
});
</script>
<template>
  <Page auto-content-height>
    <!-- pr-3：给右侧悬浮滚动条留出避让空间，避免滚动条压住卡片/按钮边缘 -->
    <div class="flex h-full flex-col gap-3 overflow-auto pr-3">
      <!-- 顶部筛选：企业 + 时间范围 -->
      <div class="flex shrink-0 items-center gap-2.5">
        <Select
          v-model:value="corpFilter"
          class="w-55"
          :options="corpOptions"
          :placeholder="$t('dashboard.corpPlaceholder')"
          show-search
          option-filter-prop="label"
          @change="onCorpChange"
        />
        <div
          class="ml-auto flex items-center gap-0.5 rounded-md bg-muted p-0.5"
        >
          <Button
            v-for="days in [7, 30]"
            :key="days"
            size="small"
            :type="range === days ? 'primary' : 'default'"
            @click="onRangeChange(days as 7 | 30)"
          >
            {{ days === 7 ? $t('dashboard.range7') : $t('dashboard.range30') }}
          </Button>
        </div>
      </div>

      <!-- 指标卡 ×6 -->
      <div
        class="grid shrink-0 grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6"
      >
        <div
          v-for="card in cards"
          :key="card.label"
          class="min-w-0 rounded-md border bg-card p-3"
        >
          <div class="whitespace-nowrap text-xs text-muted-foreground">
            {{ card.label }}
          </div>
          <div class="mt-0.5 text-xl font-medium tabular-nums">
            {{ card.value }}
          </div>
          <div class="mt-0.5 text-xs" :class="card.delta.cls">
            {{ card.delta.text }}
          </div>
        </div>
      </div>

      <!-- 第一行：客户增长趋势 + 成员 TOP -->
      <div class="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-3">
        <div class="rounded-md border bg-card p-3 lg:col-span-2">
          <div class="mb-1 flex items-center gap-2">
            <span class="text-sm font-medium">
              {{ $t('dashboard.trendTitle') }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ $t('dashboard.trendSub') }}
            </span>
          </div>
          <EchartsUI ref="trendRef" class="h-52 w-full" />
        </div>
        <div class="rounded-md border bg-card p-3">
          <div class="mb-2 text-sm font-medium">
            {{ $t('dashboard.topTitle') }}
          </div>
          <div class="flex flex-col gap-1.5">
            <div
              v-for="(member, index) in memberRank"
              :key="member.userId"
              class="grid cursor-default grid-cols-[20px_56px_1fr_56px] items-center gap-2 text-xs"
              :title="`${member.name} · ${fmtCount(member.customerCnt)}`"
            >
              <span
                class="tabular-nums"
                :class="
                  index === 0
                    ? 'font-semibold text-amber-500'
                    : 'text-muted-foreground'
                "
              >
                {{ index + 1 }}
              </span>
              <span class="truncate">{{ member.name }}</span>
              <div class="h-2 overflow-hidden rounded bg-muted">
                <div
                  class="h-full rounded bg-primary opacity-85"
                  :style="{
                    width: `${((member.customerCnt ?? 0) / (memberTopMax || 1)) * 100}%`,
                  }"
                ></div>
              </div>
              <span class="text-right tabular-nums">
                {{ fmtCount(member.customerCnt) }}
              </span>
            </div>
            <div
              v-if="memberRank.length === 0"
              class="py-4 text-center text-xs text-muted-foreground"
            >
              {{ $t('dashboard.noData') }}
            </div>
          </div>
        </div>
      </div>

      <!-- 第二行：客群活跃趋势 + 最近任务效果 -->
      <div class="grid shrink-0 grid-cols-1 gap-3 lg:grid-cols-3">
        <div class="rounded-md border bg-card p-3 lg:col-span-2">
          <div class="mb-1 text-sm font-medium">
            {{ $t('dashboard.groupTitle') }}
          </div>
          <EchartsUI ref="groupRef" class="h-48 w-full" />
        </div>
        <div class="flex flex-col rounded-md border bg-card p-3">
          <div class="mb-2 flex items-center gap-2">
            <span class="text-sm font-medium">
              {{ $t('dashboard.recentTitle') }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ $t('dashboard.recentSub') }}
            </span>
          </div>
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-border text-muted-foreground">
                <th class="py-1.5 text-left font-normal">
                  {{ $t('dashboard.taskName') }}
                </th>
                <th class="py-1.5 text-left font-normal">
                  {{ $t('dashboard.taskType') }}
                </th>
                <th class="py-1.5 text-right font-normal">
                  {{ $t('dashboard.completion') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="task in recentTasks"
                :key="task.name"
                class="border-b border-border last:border-b-0"
              >
                <td class="max-w-0 truncate py-1.5">{{ task.name }}</td>
                <td class="py-1.5">
                  <span class="rounded px-1.5 py-0.5 text-xs" :class="task.cls">
                    {{ task.type }}
                  </span>
                </td>
                <td class="py-1.5 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <div class="h-1 w-10 overflow-hidden rounded bg-muted">
                      <div
                        class="h-full rounded bg-primary"
                        :style="{ width: `${task.rate ?? 0}%` }"
                      ></div>
                    </div>
                    <span class="tabular-nums">
                      {{
                        task.rate === null ? '-' : `${task.rate.toFixed(1)}%`
                      }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="recentTasks.length === 0"
            class="py-4 text-center text-xs text-muted-foreground"
          >
            {{ $t('dashboard.noData') }}
          </div>
          <div
            class="mt-auto flex items-center gap-1 pt-2 text-xs text-muted-foreground"
          >
            <IconifyIcon class="size-3.5" icon="lucide:info" />
            {{ $t('dashboard.recentHint') }}
          </div>
        </div>
      </div>
    </div>
  </Page>
</template>
