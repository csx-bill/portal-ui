<script lang="ts" setup>
import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import type { SystemI18n } from '#/api/system/i18n';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { $t } from '@vben/locales';
import { useVbenVxeGrid } from '@vben/plugins/vxe-table';

import { Button, message, Popconfirm } from 'antdv-next';

import { deleteI18n, getI18nPage } from '#/api/system/i18n';
import { hasPermission } from '#/shared/request-context';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

/**
 * 国际化管理页面（模块联邦 expose 入口：./I18nManagePage）
 *
 * 后端分页协议与 role 页一致：请求 current/size，响应 records/total（IPage），
 * gridOptions 里覆盖宿主全局的 response 映射。
 */
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
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
          return await getI18nPage({
            current: page.currentPage,
            size: page.pageSize,
            ...formValues,
          });
        },
      },
      // 覆盖宿主全局的 response 映射（result/list: 'items'）：
      // 后端国际化接口返回 IPage 结构，行数据在 records 字段
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
  } as VxeTableGridOptions<SystemI18n>,
});

function onRefresh() {
  gridApi.query();
}
function onEdit(row: SystemI18n) {
  formDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData(null).open();
}

function onDelete(row: SystemI18n) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteI18n(row.id)
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
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid>
      <template #toolbar-tools>
        <Button
          v-if="hasPermission('i18n:add')"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{
            $t('ui.actionTitle.create', [$t('systemCommon.system.i18n.name')])
          }}
        </Button>
      </template>
      <template #operation="{ row }">
        <div class="flex table-operations justify-center">
          <Button
            v-if="hasPermission('i18n:update')"
            size="small"
            type="link"
            @click="onEdit(row)"
          >
            {{ $t('common.edit') }}
          </Button>
          <Popconfirm
            v-if="hasPermission('i18n:delete')"
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
