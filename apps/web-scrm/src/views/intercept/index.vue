<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { InterceptRuleApi } from '#/api';

import { computed, onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';

import { Button, message, Modal, Select, Tooltip } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteInterceptRule, getCorpList, getInterceptRuleList } from '#/api';
import { $t } from '#/locales';

import { useInterceptColumns } from './data';
import RuleForm from './modules/rule-form.vue';

/**
 * 聊天敏感词页面（后端 WxInterceptRuleController
 * /scrm/intercept/rule/*，代理企微 externalcontact/*_intercept_rule）。
 *
 * 规则以企微侧为唯一来源（本地不落库、无同步动作）：
 * 顶部企业筛选（默认第一个授权企业），表格展示全量规则摘要，
 * 新建/编辑走抽屉（编辑时按详情加载完整配置），删除二次确认。
 */
const corpFilter = ref<string>();
const corpOptions = ref<{ label: string; value: string }[]>([]);

// 企微限制：企业敏感词规则条数上限为100个（页面无分页，列表即全量）
const RULE_LIMIT = 100;
const ruleTotal = ref(0);
const rulesFull = computed(() => ruleTotal.value >= RULE_LIMIT);

async function loadCorpOptions() {
  const corps = await getCorpList();
  // 仅已授权企业可管理敏感词规则
  corpOptions.value = corps
    .filter((corp) => corp.authStatus === 1)
    .map((corp) => ({
      label: corp.corpName || corp.corpId,
      value: corp.corpId,
    }));
}

function onCorpChange() {
  gridApi.query();
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useInterceptColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async () => {
          if (!corpFilter.value) {
            ruleTotal.value = 0;
            return [];
          }
          // 企微接口返回全量规则，不分页
          const list = (await getInterceptRuleList(corpFilter.value)) ?? [];
          ruleTotal.value = list.length;
          return list;
        },
      },
    },
    rowConfig: {
      keyField: 'ruleId',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
  } as VxeTableGridOptions<InterceptRuleApi.WxInterceptRule>,
});

// ==================== 新建 / 编辑抽屉 ====================
const [RuleFormDrawer, ruleFormDrawerApi] = useVbenDrawer({
  connectedComponent: RuleForm,
  destroyOnClose: true,
});

function corpLabelOf(corpId?: string) {
  return corpOptions.value.find((corp) => corp.value === corpId)?.label;
}

function onCreate() {
  ruleFormDrawerApi
    .setData({
      corpId: corpFilter.value,
      corpName: corpLabelOf(corpFilter.value),
    })
    .open();
}

function onEdit(row: InterceptRuleApi.WxInterceptRule) {
  ruleFormDrawerApi
    .setData({
      corpId: corpFilter.value,
      corpName: corpLabelOf(corpFilter.value),
      row,
    })
    .open();
}

function onSaved() {
  gridApi.query();
}

// ==================== 删除 ====================
function onDelete(row: InterceptRuleApi.WxInterceptRule) {
  Modal.confirm({
    content: $t('intercept.deleteConfirm', [row.ruleName ?? row.ruleId]),
    onOk: async () => {
      await deleteInterceptRule(corpFilter.value ?? '', row.ruleId);
      message.success($t('intercept.deleteSuccess'));
      gridApi.query();
    },
    title: $t('intercept.delete'),
  });
}

/** 初始化：加载企业并默认选中第一个授权企业后查询规则 */
onMounted(async () => {
  await loadCorpOptions();
  const firstCorp = corpOptions.value[0];
  if (!corpFilter.value && firstCorp) {
    corpFilter.value = firstCorp.value;
  }
  gridApi.query();
});
</script>
<template>
  <Page auto-content-height>
    <div class="flex h-full min-h-0 flex-col gap-2">
      <!-- 顶部:企业筛选 -->
      <div class="rounded-md border bg-card p-2">
        <Select
          v-model:value="corpFilter"
          class="w-60"
          :options="corpOptions"
          :placeholder="$t('intercept.corpPlaceholder')"
          show-search
          option-filter-prop="label"
          @change="onCorpChange"
        />
      </div>

      <!-- 规则表格 -->
      <div class="min-h-0 flex-1">
        <Grid>
          <template #toolbar-tools>
            <div class="mr-1 flex items-center gap-2">
              <span
                class="text-xs"
                :class="
                  rulesFull ? 'text-destructive' : 'text-muted-foreground'
                "
              >
                {{ $t('intercept.ruleCountTip', [ruleTotal, RULE_LIMIT]) }}
              </span>
              <Tooltip
                :title="
                  rulesFull ? $t('intercept.ruleLimitReached') : undefined
                "
              >
                <Button
                  v-access:code="'intercept:add'"
                  :disabled="!corpFilter || rulesFull"
                  type="primary"
                  @click="onCreate"
                >
                  {{ $t('intercept.create') }}
                </Button>
              </Tooltip>
            </div>
          </template>
          <template #operation="{ row }">
            <Button
              v-access:code="'intercept:update'"
              size="small"
              type="link"
              @click="onEdit(row)"
            >
              {{ $t('intercept.edit') }}
            </Button>
            <Button
              v-access:code="'intercept:delete'"
              danger
              size="small"
              type="link"
              @click="onDelete(row)"
            >
              {{ $t('intercept.delete') }}
            </Button>
          </template>
        </Grid>
      </div>
    </div>

    <!-- 新建 / 编辑规则抽屉 -->
    <RuleFormDrawer @success="onSaved" />
  </Page>
</template>
