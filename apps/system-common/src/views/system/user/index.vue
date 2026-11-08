<script lang="ts" setup>
import type { VxeTableGridOptions } from '@vben/plugins/vxe-table';

import type { SystemDept } from '#/api/system/dept';
import type { SystemUser } from '#/api/system/user';

import { computed, ref } from 'vue';

import { Page, Tree, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';
import { $t } from '@vben/locales';
import { useVbenVxeGrid } from '@vben/plugins/vxe-table';

import {
  Button,
  Input,
  message,
  Modal,
  Popconfirm,
  Spin,
  Switch,
} from 'antdv-next';

import { deleteDept, getDeptTree } from '#/api/system/dept';
import { deleteUser, getUserPage, updateUser } from '#/api/system/user';
import { hasPermission } from '#/shared/request-context';

import { useColumns, useGridFormSchema } from './data';
import DeptForm from './modules/dept-form.vue';
import Form from './modules/form.vue';

/**
 * 用户管理页面（模块联邦 expose 入口：./UserManagePage）。
 *
 * 左侧部门树（支持增删改，选中后过滤右侧用户，含子部门），
 * 右侧用户列表（搜索 + 分页 + 新增/编辑/删除）。
 * 后端分页协议：请求 current/size，响应 records/total（IPage）。
 */
const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [DeptFormDrawer, deptFormDrawerApi] = useVbenDrawer({
  connectedComponent: DeptForm,
  destroyOnClose: true,
});

// ===== 部门树 =====
const deptTree = ref<SystemDept[]>([]);
const loadingDeptTree = ref(false);
/** 左侧选中的部门 ID（空 = 全部用户） */
const selectedDeptId = ref<SystemDept['id']>();
/** 部门名称搜索关键字（前端过滤树） */
const deptKeyword = ref<string>();

/**
 * 按名称过滤部门树：命中节点保留其全部子树，
 * 仅后代命中时保留祖先路径
 */
function filterDeptNodes(nodes: SystemDept[], keyword: string): SystemDept[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return nodes;
  const result: SystemDept[] = [];
  for (const node of nodes) {
    const matchedChildren = filterDeptNodes(node.children ?? [], keyword);
    const selfMatched = (node.name ?? '').toLowerCase().includes(kw);
    if (selfMatched || matchedChildren.length > 0) {
      result.push({
        ...node,
        children: selfMatched ? (node.children ?? []) : matchedChildren,
      });
    }
  }
  return result;
}

const visibleDeptTree = computed(() =>
  deptKeyword.value
    ? filterDeptNodes(deptTree.value, deptKeyword.value)
    : deptTree.value,
);

async function loadDeptTree() {
  loadingDeptTree.value = true;
  try {
    deptTree.value = await getDeptTree();
    // 选中节点被删除后清理选中态
    if (
      selectedDeptId.value !== undefined &&
      !hasDept(deptTree.value, selectedDeptId.value)
    ) {
      selectedDeptId.value = undefined;
    }
  } finally {
    loadingDeptTree.value = false;
  }
}

function hasDept(nodes: SystemDept[], id: SystemDept['id']): boolean {
  return nodes.some(
    (node) => node.id === id || hasDept(node.children ?? [], id),
  );
}

function onTreeSelect(value?: SystemDept['id']) {
  // 单选树 replace 语义下二次点击同节点不会发取消事件，这里统一做 toggle
  if (value !== undefined && value === selectedDeptId.value) {
    value = undefined;
  }
  selectedDeptId.value = value;
  gridApi.query();
}

/**
 * 节点内容点击（@stop 拦截，不进 Reka 选择流程）：
 * 点击已选中节点 → 取消选中；点击未选中节点 → 选中
 */
function onNodeClick(value: SystemDept) {
  onTreeSelect(selectedDeptId.value === value.id ? undefined : value.id);
}

function onDeptCreate() {
  // 未选中部门时新建根部门，选中时新建其子部门
  deptFormDrawerApi
    .setData({ dept: null, parentId: selectedDeptId.value })
    .open();
}

function onDeptEdit() {
  if (selectedDeptId.value === undefined) {
    message.warning($t('systemCommon.system.dept.selectFirst'));
    return;
  }
  const dept = findDept(deptTree.value, selectedDeptId.value);
  if (dept) {
    deptFormDrawerApi.setData({ dept, parentId: undefined }).open();
  }
}

function findDept(
  nodes: SystemDept[],
  id: SystemDept['id'],
): SystemDept | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findDept(node.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

const selectedDept = computed(() =>
  selectedDeptId.value === undefined
    ? undefined
    : findDept(deptTree.value, selectedDeptId.value),
);

function onDeptDelete() {
  if (selectedDeptId.value === undefined) {
    message.warning($t('systemCommon.system.dept.selectFirst'));
    return;
  }
  const dept = findDept(deptTree.value, selectedDeptId.value);
  if (!dept) return;
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [dept.name ?? '']),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteDept(dept.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [dept.name ?? '']),
        key: 'action_process_msg',
      });
      loadDeptTree();
      onTreeSelect(undefined);
    })
    .catch(() => {
      hideLoading();
    });
}

// ===== 用户列表 =====
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
          return await getUserPage({
            current: page.currentPage,
            size: page.pageSize,
            ...formValues,
            deptId: selectedDeptId.value,
          });
        },
      },
      // 覆盖宿主全局的 response 映射（result/list: 'items'）：
      // 后端用户接口返回 IPage 结构，行数据在 records 字段
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
  } as VxeTableGridOptions<SystemUser>,
});

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData(null).open();
}

function onEdit(row: SystemUser) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: SystemUser) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name ?? row.username]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteUser(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [
          row.name ?? row.username,
        ]),
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
async function onStatusChange(newStatus: boolean | number, row: SystemUser) {
  const statusText: Record<string, string> = {
    0: $t('systemCommon.system.role.disabled'),
    1: $t('systemCommon.system.role.enabled'),
  };
  const confirm = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      content: `${$t('systemCommon.system.user.switchStatusContent', [
        row.name ?? row.username,
        statusText[String(newStatus)] ?? newStatus,
      ])}`,
      onCancel() {
        resolve(false);
      },
      onOk() {
        resolve(true);
      },
      title: $t('systemCommon.system.user.switchStatus'),
    });
  });
  if (!confirm) return;
  await updateUser({ ...row, status: Number(newStatus) });
  onRefresh();
}

loadDeptTree();
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <DeptFormDrawer @success="loadDeptTree" />
    <div class="flex h-full min-h-0 gap-2">
      <!-- 左侧：部门树 -->
      <div
        class="flex w-60 shrink-0 flex-col gap-2 rounded-md border bg-card p-2"
      >
        <Input
          v-model:value="deptKeyword"
          allow-clear
          :placeholder="$t('systemCommon.system.dept.searchPlaceholder')"
        />
        <div class="flex items-center gap-1">
          <Button
            v-if="hasPermission('dept:add')"
            size="small"
            style="flex: 1"
            type="primary"
            @click="onDeptCreate"
          >
            {{ $t('common.create') }}
          </Button>
          <Button
            v-if="hasPermission('dept:update')"
            :disabled="selectedDeptId === undefined"
            size="small"
            style="flex: 1"
            @click="onDeptEdit"
          >
            {{ $t('common.edit') }}
          </Button>
          <Popconfirm
            v-if="hasPermission('dept:delete')"
            placement="topRight"
            :title="$t('ui.actionTitle.delete')"
            @confirm="onDeptDelete"
          >
            <template #description>
              <div class="truncate">
                {{
                  $t('systemCommon.system.dept.deleteConfirm', [
                    selectedDept?.name ?? '',
                  ])
                }}
              </div>
            </template>
            <Button
              danger
              :disabled="selectedDeptId === undefined"
              size="small"
              style="flex: 1"
            >
              {{ $t('common.delete') }}
            </Button>
          </Popconfirm>
        </div>
        <!-- 工具区与树之间的分割线 -->
        <div class="-mx-2 border-b border-border"></div>
        <Spin :spinning="loadingDeptTree" :classes="{ root: 'w-full' }">
          <Tree
            class="dept-tree"
            :collapsible="false"
            :tree-data="visibleDeptTree"
            :default-expanded-level="2"
            label-field="name"
            value-field="id"
            :model-value="selectedDeptId"
            @update:model-value="onTreeSelect"
          >
            <template #node="{ value }">
              <!-- 选中态：蓝色文字 + 紧随文字的对勾（对齐参考设计）；
                   点击走 onNodeClick 自管 toggle，不依赖组件内部选择行为 -->
              <span
                class="flex items-center"
                style="flex: 1"
                @click.stop="onNodeClick(value)"
              >
                <span
                  :class="
                    value.id === selectedDeptId
                      ? 'font-medium text-primary'
                      : undefined
                  "
                >
                  {{ value.name }}
                </span>
                <IconifyIcon
                  v-if="value.id === selectedDeptId"
                  class="ml-0.5 inline-block size-3.5 text-primary"
                  icon="lucide:check"
                />
              </span>
            </template>
          </Tree>
        </Spin>
      </div>

      <!-- 右侧：用户列表 -->
      <div class="h-full min-w-0 flex-1">
        <Grid>
          <template #toolbar-tools>
            <Button
              v-if="hasPermission('user:add')"
              type="primary"
              @click="onCreate"
            >
              <Plus class="size-5" />
              {{
                $t('ui.actionTitle.create', [
                  $t('systemCommon.system.user.user'),
                ])
              }}
            </Button>
          </template>
          <template #deptNames="{ row }">
            {{ (row.deptNames ?? []).join('、') || '-' }}
          </template>
          <template #status="{ row }">
            <Switch
              :checked="row.status"
              :checked-value="1"
              :disabled="!hasPermission('user:update')"
              :loading="row.__status_loading ?? false"
              :un-checked-value="0"
              @update:checked="
                () => onStatusChange(row.status === 1 ? 0 : 1, row)
              "
            />
          </template>
          <template #operation="{ row }">
            <div class="flex table-operations justify-center">
              <Button
                v-if="hasPermission('user:update')"
                size="small"
                type="link"
                @click="onEdit(row)"
              >
                {{ $t('common.edit') }}
              </Button>
              <Popconfirm
                v-if="hasPermission('user:delete')"
                placement="topLeft"
                :title="$t('ui.actionTitle.delete')"
                @confirm="onDelete(row)"
              >
                <template #description>
                  <div class="truncate">
                    {{
                      $t('ui.actionMessage.deleteConfirm', [
                        row.name ?? row.username,
                      ])
                    }}
                  </div>
                </template>
                <Button danger size="small" type="link">
                  {{ $t('common.delete') }}
                </Button>
              </Popconfirm>
            </div>
          </template>
        </Grid>
      </div>
    </div>
  </Page>
</template>
<style scoped>
/* vben Tree 的 data-[selected]:bg-accent 工具类在本构建中未生成,
   这里补选中节点的底色(蓝字/对勾由 #node 插槽实现) */
:deep(.dept-tree [data-selected]) {
  background-color: hsl(var(--accent));
}
</style>
