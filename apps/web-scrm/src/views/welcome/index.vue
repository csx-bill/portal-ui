<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { WelcomeApi } from '#/api';

import { onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { delWelcomeMsgs, getCorpList, getWelcomeMsgPage } from '#/api';
import { $t } from '#/locales';

import EmployeePanel from '../contact/modules/employee-panel.vue';
import EditDrawerComp from './modules/edit-drawer.vue';

/**
 * 企微欢迎语页面（后端 WxWelcomeMsgController /scrm/welcome/*）。
 *
 * 主从布局（与客户列表/客户群发同构）：左侧通讯录（企业/部门树/成员），
 * 点击成员或部门按绑定范围过滤右侧欢迎语；右侧为欢迎语表格
 * （绑定数量/生效范围/规则数等配置属性——欢迎语是配置型数据，
 * 企微无发送记录接口，故无送达类报表列）。
 * 新建/编辑走抽屉，复用详情编辑表单。
 */

/** 企业筛选（默认第一个授权企业） */
const corpFilter = ref<string>();
const corpOptions = ref<{ label: string; value: string }[]>([]);

/** 左侧选中的成员/部门（欢迎语按绑定范围过滤，二者互斥） */
const selectedUserId = ref<string>();
const selectedDeptId = ref<number>();

/** 生效范围：最多展示两个绑定对象，其余折叠为数量 */
function scopeText(row: WelcomeApi.WxWelcomeMsg) {
  const names = row.bindNames ?? [];
  if (names.length === 0) return '-';
  const head = names.slice(0, 2).join('、');
  return names.length > 2 ? `${head} 等${names.length}个` : head;
}

async function loadCorpOptions() {
  const corps = await getCorpList();
  // 仅已授权企业可同步/有欢迎语数据
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
    schema: [
      {
        component: 'Input',
        componentProps: {
          allowClear: true,
          placeholder: $t('welcome.namePlaceholder'),
        },
        fieldName: 'name',
        label: $t('welcome.name'),
      },
    ],
    submitOnChange: true,
  },
  gridOptions: {
    columns: [
      { align: 'center', title: $t('welcome.seq'), type: 'seq', width: 55 },
      {
        field: 'name',
        minWidth: 160,
        title: $t('welcome.name'),
      },
      {
        align: 'right',
        field: 'bindCount',
        title: $t('welcome.bindCount'),
        width: 95,
      },
      {
        field: 'bindNames',
        showOverflow: false,
        slots: { default: 'scope' },
        title: $t('welcome.scope'),
        minWidth: 200,
      },
      {
        align: 'right',
        field: 'ruleCount',
        title: $t('welcome.ruleCount'),
        width: 90,
      },
      {
        field: 'createTime',
        title: $t('welcome.createTime'),
        width: 170,
      },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        showOverflow: false,
        slots: { default: 'operation' },
        title: $t('welcome.action'),
        width: 150,
      },
    ],
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getWelcomeMsgPage({
            corpId: corpFilter.value || undefined,
            current: page.currentPage,
            deptId: selectedDeptId.value || undefined,
            sender: selectedUserId.value || undefined,
            size: page.pageSize,
            ...formValues,
          });
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
  } as VxeTableGridOptions<WelcomeApi.WxWelcomeMsg>,
});

const [EditDrawer, editDrawerApi] = useVbenDrawer({
  connectedComponent: EditDrawerComp,
  destroyOnClose: true,
});

function onCreate() {
  editDrawerApi
    .setData({ defaultCorpId: corpFilter.value, isNew: true })
    .open();
}

function onEdit(row: WelcomeApi.WxWelcomeMsg) {
  editDrawerApi
    .setData({ defaultCorpId: corpFilter.value, msgId: row.id })
    .open();
}

function onSaved() {
  gridApi.query();
}

function onDelete(row: WelcomeApi.WxWelcomeMsg) {
  Modal.confirm({
    content: $t('welcome.deleteRowConfirm', [row.name]),
    onOk: async () => {
      await delWelcomeMsgs(String(row.id));
      message.success($t('welcome.deleteSuccess'));
      gridApi.query();
    },
    title: $t('welcome.deleteConfirm'),
  });
}

/** 初始化：先加载企业并默认选中第一个授权企业，再刷新欢迎语列表 */
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
    <EditDrawer @saved="onSaved" />
    <!-- 主从布局：左侧通讯录（企业/部门树/成员），右侧欢迎语表格 -->
    <div class="flex h-full min-h-0 gap-2">
      <!-- 左侧：企业 + 通讯录 -->
      <div
        class="flex w-60 shrink-0 flex-col overflow-hidden rounded-md border bg-card"
      >
        <EmployeePanel
          v-model:corp-id="corpFilter"
          :corp-options="corpOptions"
          :corp-placeholder="$t('welcome.corpPlaceholder')"
          class="min-h-0 flex-1"
          @change="onMemberChange"
          @corp-change="onCorpChange"
          @dept-change="onDeptChange"
        />
      </div>

      <!-- 右侧：欢迎语表格 -->
      <div class="h-full min-w-0 flex-1">
        <Grid>
          <template #toolbar-tools>
            <Button
              v-access:code="'welcome:add'"
              class="mr-2"
              type="primary"
              @click="onCreate"
            >
              <Plus class="size-4" />
              {{ $t('welcome.create') }}
            </Button>
          </template>
          <template #scope="{ row }">
            <span :title="(row.bindNames ?? []).join('、')">
              {{ scopeText(row) }}
            </span>
          </template>
          <template #operation="{ row }">
            <Button
              v-access:code="'welcome:update'"
              size="small"
              type="link"
              @click="onEdit(row)"
            >
              {{ $t('welcome.edit') }}
            </Button>
            <Button
              v-access:code="'welcome:delete'"
              danger
              size="small"
              type="link"
              @click="onDelete(row)"
            >
              {{ $t('welcome.delete') }}
            </Button>
          </template>
        </Grid>
      </div>
    </div>
  </Page>
</template>
