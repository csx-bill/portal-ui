<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AcquisitionApi, SystemDictApi } from '#/api';

import { onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';

import { Button, message, Modal, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteAcquisitionLink,
  getAcquisitionLinkPage,
  getCorpList,
  getDictOptionsByType,
  triggerAcquisitionLinkSync,
} from '#/api';
import { $t } from '#/locales';

import EmployeePanel from '../contact/modules/employee-panel.vue';
import { useColumns, useGridFormSchema } from './data';
import EditForm from './modules/edit-form.vue';

/** 客户渠道字典类型标识（sys_dict.dict_type，在系统管理-字典里维护） */
const DICT_TYPE_CUSTOMER_CHANNEL = 'customer_channel';

/**
 * 获客链接页面（后端 WxAcquisitionLinkController
 * /scrm/acquisition/link/*，代理企微 /customer_acquisition/*）。
 *
 * 布局与客户列表一致的主从式：左侧通讯录面板（企业筛选默认第一个
 * 授权企业 + 部门树 + 成员列表，底部"同步获客链接"按钮），点击成员
 * 按使用范围（range_user_list）过滤右侧链接表格；表格支持名称搜索、
 * 新建/编辑走抽屉（链接名称 + 使用范围成员/部门 + 无需验证
 * + 优先分配 + 标记来源），保存成功后刷新表格。
 */

const corpFilter = ref<string>();
const corpOptions = ref<{ label: string; value: string }[]>([]);

const syncing = ref(false);

/** 左侧选中的成员/部门（按使用范围 range_user_list / range_department_list 过滤） */
const selectedUserId = ref<string>();
const selectedDeptId = ref<number>();

async function loadCorpOptions() {
  const corps = await getCorpList();
  // 仅已授权企业有获客链接数据
  corpOptions.value = corps
    .filter((corp) => corp.authStatus === 1)
    .map((corp) => ({
      label: corp.corpName || corp.corpId,
      value: corp.corpId,
    }));
}

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

function onSync() {
  if (!corpFilter.value) return;
  syncing.value = true;
  const hideLoading = message.loading({
    content: $t('acquisition.syncing'),
    duration: 0,
    key: 'acquisition_sync_msg',
  });
  triggerAcquisitionLinkSync(corpFilter.value)
    .then(() => {
      message.success({
        content: $t('acquisition.syncSuccess'),
        key: 'acquisition_sync_msg',
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
          const result = await getAcquisitionLinkPage({
            corpId: corpFilter.value || undefined,
            current: page.currentPage,
            linkName: formValues?.linkName,
            rangeDeptId: selectedDeptId.value,
            rangeUserid: selectedUserId.value,
            size: page.pageSize,
          });
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
  } as VxeTableGridOptions<AcquisitionApi.WxAcquisitionLink>,
});

// ==================== 新建 / 编辑抽屉 ====================
const [EditFormDrawer, editFormDrawerApi] = useVbenDrawer({
  connectedComponent: EditForm,
  destroyOnClose: true,
});

function corpLabelOf(corpId?: string) {
  return corpOptions.value.find((corp) => corp.value === corpId)?.label;
}

function onCreate() {
  editFormDrawerApi
    .setData({
      corpId: corpFilter.value,
      corpName: corpLabelOf(corpFilter.value),
    })
    .open();
}

function onEdit(row: AcquisitionApi.WxAcquisitionLink) {
  const corpId = row.corpId || corpFilter.value;
  editFormDrawerApi
    .setData({ corpId, corpName: corpLabelOf(corpId), row })
    .open();
}

function onSaved() {
  gridApi.query();
}

// ==================== 删除 ====================
function onDelete(row: AcquisitionApi.WxAcquisitionLink) {
  Modal.confirm({
    content: $t('acquisition.deleteConfirm', [row.linkName ?? row.linkId]),
    onOk: async () => {
      await deleteAcquisitionLink(row.id);
      message.success($t('acquisition.deleteSuccess'));
      gridApi.query();
    },
    title: $t('acquisition.delete'),
  });
}

// ==================== 客户渠道展示 / Scheme ====================
/** 渠道字典选项（表格列把 itemValue 映射为标签） */
const channelOptions = ref<SystemDictApi.DictOption[]>([]);

function channelLabel(value?: string) {
  if (!value) return '-';
  return channelOptions.value.find((o) => o.value === value)?.label ?? value;
}

/**
 * 按企微文档生成微信 scheme：
 * weixin://biz/ww/profile/{urlencode(链接?customer_channel=渠道)}
 * 链接未设置客户渠道时仅编码链接本身
 */
function buildScheme(row: AcquisitionApi.WxAcquisitionLink) {
  if (!row.url) return '';
  const target = row.customerChannel
    ? `${row.url}?customer_channel=${row.customerChannel}`
    : row.url;
  return `weixin://biz/ww/profile/${encodeURIComponent(target)}`;
}

async function onCopyUrl(url?: string) {
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    message.success($t('acquisition.urlCopySuccess'));
  } catch {
    // 非 https 环境降级：临时文本域 + execCommand
    const textarea = document.createElement('textarea');
    textarea.value = url;
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    message.success($t('acquisition.urlCopySuccess'));
  }
}

/** 加载客户渠道字典项（用于表格列展示） */
async function loadChannelOptions() {
  try {
    channelOptions.value = await getDictOptionsByType(
      DICT_TYPE_CUSTOMER_CHANNEL,
    );
  } catch {
    channelOptions.value = [];
  }
}

onMounted(async () => {
  await loadCorpOptions();
  const firstCorp = corpOptions.value[0];
  if (!corpFilter.value && firstCorp) {
    corpFilter.value = firstCorp.value;
  }
  loadChannelOptions();
});
</script>

<template>
  <Page auto-content-height>
    <!-- 布局对齐统一规范:左侧面板卡片 + 右侧列表 -->
    <div class="flex h-full min-h-0 gap-2">
      <!-- 左侧:企业 + 通讯录(部门树/成员),底部同步按钮 -->
      <div
        class="flex w-60 shrink-0 flex-col overflow-hidden rounded-md border bg-card"
      >
        <EmployeePanel
          v-model:corp-id="corpFilter"
          :corp-options="corpOptions"
          :corp-placeholder="$t('acquisition.corpPlaceholder')"
          class="min-h-0 flex-1"
          @change="onMemberChange"
          @corp-change="onCorpChange"
          @dept-change="onDeptChange"
        >
          <template #actions>
            <Button
              v-access:code="'acquisition:sync'"
              block
              :disabled="!corpFilter"
              :loading="syncing"
              type="primary"
              @click="onSync"
            >
              {{ $t('acquisition.sync') }}
            </Button>
          </template>
        </EmployeePanel>
      </div>

      <!-- 右侧:获客链接表格 -->
      <div class="h-full min-w-0 flex-1">
        <Grid>
          <template #toolbar-tools>
            <div class="mr-1 flex items-center gap-2">
              <Button
                v-access:code="'acquisition:add'"
                :disabled="!corpFilter"
                type="primary"
                @click="onCreate"
              >
                {{ $t('acquisition.create') }}
              </Button>
            </div>
          </template>
          <template #url="{ row }">
            <div v-if="row.url" class="flex items-center gap-1">
              <span class="truncate text-xs" :title="buildScheme(row)">
                {{ buildScheme(row) }}
              </span>
              <Button
                size="small"
                type="link"
                @click="onCopyUrl(buildScheme(row))"
              >
                {{ $t('acquisition.urlCopy') }}
              </Button>
            </div>
            <span v-else class="text-xs">
              {{ $t('acquisition.urlEmpty') }}
            </span>
          </template>
          <template #range="{ row }">
            <span class="text-xs">
              {{
                $t('acquisition.memberCount', [row.rangeUserList?.length ?? 0])
              }}
              /
              {{ row.rangeDepartmentList?.length ?? 0 }}
              {{ $t('acquisition.deptUnit') }}
            </span>
          </template>
          <template #skipVerify="{ row }">
            <Tag :color="row.skipVerify === false ? 'warning' : 'success'">
              {{
                row.skipVerify === false
                  ? $t('acquisition.skipVerifyFalse')
                  : $t('acquisition.skipVerifyTrue')
              }}
            </Tag>
          </template>
          <template #channel="{ row }">
            {{ channelLabel(row.customerChannel) }}
          </template>
          <template #operation="{ row }">
            <Button
              v-access:code="'acquisition:update'"
              size="small"
              type="link"
              @click="onEdit(row)"
            >
              {{ $t('acquisition.edit') }}
            </Button>
            <Button
              v-access:code="'acquisition:delete'"
              danger
              size="small"
              type="link"
              @click="onDelete(row)"
            >
              {{ $t('acquisition.delete') }}
            </Button>
          </template>
        </Grid>
      </div>
    </div>

    <!-- 新建 / 编辑获客链接抽屉 -->
    <EditFormDrawer @success="onSaved" />
  </Page>
</template>
