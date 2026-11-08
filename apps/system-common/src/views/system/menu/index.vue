<script lang="ts" setup>
import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import type { SystemMenu } from '#/api/system/menu';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { $t } from '@vben/locales';
import { useVbenVxeGrid } from '@vben/plugins/vxe-table';

import { Button, message, Popconfirm, Tag } from 'antdv-next';

import { deleteMenu, getMenuTree } from '#/api/system/menu';
import { hasPermission } from '#/shared/request-context';

import { getMenuTypeOptions, useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

/**
 * 菜单管理页面（模块联邦 expose 入口：./MenuManagePage）
 *
 * 宿主的 vxe-table 适配器只注册了全局配置、未注册 CellTag /
 * CellOperation 单元格渲染器，因此类型 / 状态 / 操作列均使用
 * 插槽渲染（与 dict、permission 页面的做法一致）。
 */
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

/**
 * 徽标颜色的 class 映射（移植自 @vben-core/menu-ui 的 MenuBadge；
 * 不直接依赖该包，避免宿主被迫安装 federated shared 依赖）
 */
const badgeVariantClasses: Record<string, string> = {
  default: 'bg-gray-500',
  destructive: 'bg-destructive',
  primary: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
};

function getBadgeClass(badgeVariants?: string) {
  if (!badgeVariants) {
    return badgeVariantClasses.default;
  }
  return badgeVariantClasses[badgeVariants] ?? badgeVariants;
}

/**
 * 名称搜索：搜索表单与用户管理一致（网格上方条件区）。
 * 树数据只在首次查询时请求一次并缓存，关键字在前端过滤
 * （命中节点保留子树，仅后代命中时保留祖先路径），
 * 匹配范围：显示名（meta.title 的译文）/ name / path / component
 */
let menuTreeCache: SystemMenu[] = [];

function filterMenuNodes(nodes: SystemMenu[], keyword: string): SystemMenu[] {
  const kw = keyword.toLowerCase();
  if (!kw) return nodes;
  const result: SystemMenu[] = [];
  for (const node of nodes) {
    const matchedChildren = filterMenuNodes(node.children ?? [], keyword);
    const selfMatched = [
      node.name,
      node.path,
      node.component,
      node.meta?.title ? $t(node.meta.title) : '',
    ].some((text) => !!text && text.toLowerCase().includes(kw));
    if (selfMatched || matchedChildren.length > 0) {
      result.push({
        ...node,
        children: selfMatched ? (node.children ?? []) : matchedChildren,
      });
    }
  }
  return result;
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridEvents: {
    // 搜索时展开全部树节点，避免命中节点收在折叠的父级里看不见
    async proxyQuery() {
      const values = (await gridApi.formApi?.getValues()) as
        | undefined
        | { name?: string };
      if (values?.name?.trim()) {
        gridApi.grid?.setAllTreeExpand?.(true);
      }
    },
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async (_params, formValues) => {
          if (menuTreeCache.length === 0) {
            menuTreeCache = await getMenuTree();
          }
          const keyword = String(formValues?.name ?? '').trim();
          return filterMenuNodes(menuTreeCache, keyword);
        },
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
    treeConfig: {
      parentField: 'parentId',
      rowField: 'id',
      transform: false,
    },
  } as VxeTableGridOptions,
});

const menuTypeOptions = new Map(
  getMenuTypeOptions().map((option) => [option.value, option]),
);

async function onRefresh() {
  // 增删改后使缓存失效，重新拉取菜单树
  menuTreeCache = [];
  await gridApi.query();
}
function onEdit(row: SystemMenu) {
  formDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onAppend(row: SystemMenu) {
  formDrawerApi.setData({ parentId: row.id }).open();
}

function onDelete(row: SystemMenu) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteMenu(row.id)
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
          v-if="hasPermission('menu:add')"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{
            $t('ui.actionTitle.create', [$t('systemCommon.system.menu.name')])
          }}
        </Button>
      </template>
      <template #title="{ row }">
        <div class="flex w-full items-center gap-1">
          <div class="size-5 shrink-0">
            <IconifyIcon
              v-if="row.menuType === 'button'"
              icon="carbon:security"
              class="size-full"
            />
            <IconifyIcon
              v-else-if="row.meta?.icon"
              :icon="row.meta?.icon || 'carbon:circle-dash'"
              class="size-full"
            />
          </div>
          <span class="flex-auto">{{
            row.meta?.title ? $t(row.meta.title) : row.name
          }}</span>
          <div class="items-center justify-end"></div>
        </div>
        <span
          v-if="row.meta?.badgeType === 'dot' || row.meta?.badge"
          class="menu-badge absolute"
        >
          <span
            v-if="row.meta?.badgeType === 'dot'"
            class="relative mr-1 flex size-1.5"
          >
            <span
              :class="getBadgeClass(row.meta?.badgeVariants)"
              class="absolute inline-flex size-full animate-ping rounded-full opacity-75"
            >
            </span>
            <span
              :class="getBadgeClass(row.meta?.badgeVariants)"
              class="relative inline-flex size-1.5 rounded-full"
            ></span>
          </span>
          <div
            v-else
            :class="getBadgeClass(row.meta?.badgeVariants)"
            class="flex-center rounded-xl px-1.5 py-0.5 text-[10px] text-primary-foreground"
          >
            {{ row.meta?.badge }}
          </div>
        </span>
      </template>
      <template #menuType="{ row }">
        <Tag :color="menuTypeOptions.get(row.menuType)?.color">
          {{ menuTypeOptions.get(row.menuType)?.label ?? row.menuType }}
        </Tag>
      </template>
      <template #status="{ row }">
        <Tag :color="row.status === 1 ? 'success' : 'error'">
          {{
            $t(
              row.status === 1
                ? 'systemCommon.system.menu.enabled'
                : 'systemCommon.system.menu.disabled',
            )
          }}
        </Tag>
      </template>
      <template #operation="{ row }">
        <div class="flex table-operations justify-center">
          <Button
            v-if="hasPermission('menu:add')"
            size="small"
            type="link"
            @click="onAppend(row)"
          >
            {{ $t('systemCommon.system.menu.appendChild') }}
          </Button>
          <Button
            v-if="hasPermission('menu:update')"
            size="small"
            type="link"
            @click="onEdit(row)"
          >
            {{ $t('common.edit') }}
          </Button>
          <Popconfirm
            v-if="hasPermission('menu:delete')"
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
<style lang="css" scoped>
/* 纯 CSS（不用 scss）：system-common 未依赖 @vben/styles，
   vben 构建配置会给 scss 块注入 @use "@vben/styles/global" 导致解析失败 */
.menu-badge {
  top: 50%;
  right: 0;
  transform: translateY(-50%);
}

.menu-badge > :deep(div) {
  padding-top: 0;
  padding-bottom: 0;
}
</style>
