<script lang="ts" setup>
import type {
  VxeGridListeners,
  VxeTableGridOptions,
} from '@vben/plugins/vxe-table';

import type { TenantRecord } from '#/api/system/tenant';

import { computed, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { $t } from '@vben/locales';
import { useVbenVxeGrid } from '@vben/plugins/vxe-table';

import { Button, message, Modal, Popconfirm, Switch } from 'antdv-next';

import {
  deleteTenant,
  deleteTenants,
  getTenantPage,
  updateTenant,
} from '#/api/system/tenant';
import { hasPermission } from '#/shared/request-context';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

/**
 * 租户管理页面（模块联邦 expose 入口：./TenantManagePage）。
 *
 * 菜单入口由后端决定：sys_menu.component 配成 /system_common/TenantManagePage 时，
 * 宿主运行时解析到本文件。
 *
 * 宿主的 vxe-table 适配器未注册 CellSwitch / CellOperation 渲染器，
 * 状态列与操作列使用插槽渲染（与 role、menu 页面做法一致）。
 * 后端分页协议：请求 current/size，响应 records/total（IPage）。
 */
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

/** 当前页勾选的行（驱动批量删除按钮的可用状态与计数） */
const selectedRows = ref<TenantRecord[]>([]);
/** 正在切换状态的行 id（行内开关的 loading） */
const statusLoadingId = ref<TenantRecord['id']>();

/** 批量删除按钮文案：有勾选时带上条数 */
const batchDeleteLabel = computed(() =>
  selectedRows.value.length > 0
    ? `${$t('systemCommon.system.tenant.batchDelete')} (${selectedRows.value.length})`
    : $t('systemCommon.system.tenant.batchDelete'),
);

const gridEvents: VxeGridListeners<TenantRecord> = {
  checkboxAll({ records }) {
    selectedRows.value = records;
  },
  checkboxChange({ records }) {
    selectedRows.value = records;
  },
};

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridEvents,
  gridOptions: {
    checkboxConfig: {
      highlight: true,
    },
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await getTenantPage({
            current: page.currentPage,
            size: page.pageSize,
            ...formValues,
          });
          // 翻页/刷新后表格会清空勾选，同步清掉本地缓存
          selectedRows.value = [];
          return result;
        },
      },
      // 覆盖宿主全局的 response 映射（result/list: 'items'）：
      // 后端租户接口返回 IPage 结构，行数据在 records 字段
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
  } as VxeTableGridOptions<TenantRecord>,
});

function onRefresh() {
  gridApi.query();
}
function onCreate() {
  formDrawerApi.setData(null).open();
}
function onEdit(row: TenantRecord) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: TenantRecord) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteTenant(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

async function onBatchDelete() {
  const rows = selectedRows.value;
  if (rows.length === 0) {
    message.warning($t('systemCommon.system.tenant.selectRequired'));
    return;
  }
  if (!(await confirmBatchDelete(rows.length))) return;

  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [
      $t('systemCommon.system.tenant.name'),
    ]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteTenants(rows.map((row) => row.id))
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [
          $t('systemCommon.system.tenant.name'),
        ]),
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function confirmBatchDelete(count: number) {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      content: $t('systemCommon.system.tenant.deleteSelectedConfirm', [count]),
      onCancel() {
        resolve(false);
      },
      onOk() {
        resolve(true);
      },
      title: $t('ui.actionTitle.delete', [
        $t('systemCommon.system.tenant.name'),
      ]),
    });
  });
}

/**
 * 状态开关变更前弹确认，确认后调用更新接口（后端 PUT body 带 id）
 */
async function onStatusChange(newStatus: boolean | number, row: TenantRecord) {
  const confirmed = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      content: $t('systemCommon.system.tenant.switchStatusContent', [
        row.name,
        newStatus === 1 || newStatus === true
          ? $t('systemCommon.system.tenant.enabled')
          : $t('systemCommon.system.tenant.disabled'),
      ]),
      onCancel() {
        resolve(false);
      },
      onOk() {
        resolve(true);
      },
      title: $t('systemCommon.system.tenant.switchStatus'),
    });
  });
  if (!confirmed) {
    // 取消后回退开关显示：keepSource 下从源数据还原该行
    gridApi.grid?.reloadRow?.(row);
    return;
  }

  statusLoadingId.value = row.id;
  try {
    await updateTenant({
      code: row.code,
      id: row.id,
      name: row.name,
      remark: row.remark,
      status: Number(newStatus),
    });
    onRefresh();
  } finally {
    statusLoadingId.value = undefined;
  }
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid>
      <template #toolbar-tools>
        <Button
          v-if="hasPermission('tenant:add')"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{
            $t('ui.actionTitle.create', [$t('systemCommon.system.tenant.name')])
          }}
        </Button>
        <Button
          v-if="hasPermission('tenant:delete')"
          class="ml-2"
          danger
          :disabled="selectedRows.length === 0"
          @click="onBatchDelete"
        >
          {{ batchDeleteLabel }}
        </Button>
      </template>
      <template #status="{ row }">
        <!-- 数值直绑 + 忽略事件载荷：antdv Switch 的 update:checked 经 attrs
             透传给外部时仍是内部布尔（严格类型比较也导致布尔+数字
             checked-value 恒为"关"），因此渲染直接绑行数据数值，
             目标状态由行当前值取反推导，不信任事件载荷 -->
        <Switch
          :checked="row.status"
          :checked-value="1"
          :disabled="!hasPermission('tenant:update')"
          :loading="statusLoadingId === row.id"
          :un-checked-value="0"
          @update:checked="() => onStatusChange(row.status === 1 ? 0 : 1, row)"
        />
      </template>
      <template #operation="{ row }">
        <div class="flex table-operations justify-center">
          <Button
            v-if="hasPermission('tenant:update')"
            size="small"
            type="link"
            @click="onEdit(row)"
          >
            {{ $t('common.edit') }}
          </Button>
          <Popconfirm
            v-if="hasPermission('tenant:delete')"
            placement="topLeft"
            :title="$t('ui.actionTitle.delete')"
            @confirm="onDelete(row)"
          >
            <template #description>
              <div class="truncate">
                {{ $t('ui.actionMessage.deleteConfirm', [row.name]) }}
              </div>
            </template>
            <Button danger size="small" type="link">
              {{ $t('common.delete') }}
            </Button>
          </Popconfirm>
        </div>
      </template>
    </Grid>
  </Page>
</template>
