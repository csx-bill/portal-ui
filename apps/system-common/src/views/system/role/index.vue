<script lang="ts" setup>
import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import type { SystemRole } from '#/api/system/role';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { $t } from '@vben/locales';
import { useVbenVxeGrid } from '@vben/plugins/vxe-table';

import { Button, message, Modal, Popconfirm, Switch } from 'antdv-next';

import { deleteRole, getRolePage, updateRole } from '#/api/system/role';
import { hasPermission } from '#/shared/request-context';

import { useColumns, useGridFormSchema } from './data';
import Auth from './modules/auth.vue';
import Form from './modules/form.vue';

/**
 * 角色管理页面（模块联邦 expose 入口：./RoleManagePage）
 *
 * 宿主的 vxe-table 适配器未注册 CellSwitch / CellOperation 渲染器，
 * 状态列与操作列使用插槽渲染（与 menu 页面的做法一致）。
 * 后端分页协议：请求 current/size，响应 records/total（IPage）。
 * 基础信息编辑与菜单授权拆为两个入口：编辑抽屉 + 授权抽屉。
 */
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [AuthDrawer, authDrawerApi] = useVbenDrawer({
  connectedComponent: Auth,
  destroyOnClose: true,
});

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
          return await getRolePage({
            current: page.currentPage,
            size: page.pageSize,
            ...formValues,
          });
        },
      },
      // 覆盖宿主全局的 response 映射（result/list: 'items'）：
      // 后端角色接口返回 IPage 结构，行数据在 records 字段
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
  } as VxeTableGridOptions<SystemRole>,
});

function onRefresh() {
  gridApi.query();
}
function onEdit(row: SystemRole) {
  formDrawerApi.setData(row).open();
}
function onAuthorize(row: SystemRole) {
  authDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData(null).open();
}

function onDelete(row: SystemRole) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteRole(row.id)
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

/**
 * 状态开关即将改变前弹确认，确认后调用更新接口（后端 PUT body 带 id）
 */
async function onStatusChange(newStatus: boolean | number, row: SystemRole) {
  const statusText: Record<string, string> = {
    0: $t('systemCommon.system.role.disabled'),
    1: $t('systemCommon.system.role.enabled'),
  };
  const confirm = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      content: `${$t('systemCommon.system.role.switchStatusContent', [
        row.name,
        statusText[String(newStatus)] ?? newStatus,
      ])}`,
      onCancel() {
        resolve(false);
      },
      onOk() {
        resolve(true);
      },
      title: $t('systemCommon.system.role.switchStatus'),
    });
  });
  if (!confirm) return;
  await updateRole({ ...row, status: Number(newStatus) });
  onRefresh();
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <AuthDrawer @success="onRefresh" />
    <Grid>
      <template #toolbar-tools>
        <Button
          v-if="hasPermission('role:add')"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{
            $t('ui.actionTitle.create', [$t('systemCommon.system.role.name')])
          }}
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
          :disabled="!hasPermission('role:update')"
          :loading="row.__status_loading ?? false"
          :un-checked-value="0"
          @update:checked="() => onStatusChange(row.status === 1 ? 0 : 1, row)"
        />
      </template>
      <template #operation="{ row }">
        <div class="flex table-operations justify-center">
          <Button
            v-if="hasPermission('role:update')"
            size="small"
            type="link"
            @click="onEdit(row)"
          >
            {{ $t('common.edit') }}
          </Button>
          <Button
            v-if="hasPermission('role:update')"
            size="small"
            type="link"
            @click="onAuthorize(row)"
          >
            {{ $t('systemCommon.system.role.authorize') }}
          </Button>
          <Popconfirm
            v-if="hasPermission('role:delete')"
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
