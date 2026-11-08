<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ContactApi, UserBindingApi } from '#/api';

import { computed, ref, watch } from 'vue';

import { Page, Tree, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Input, message, Modal, Select, Spin, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getCorpList,
  getDeptTree,
  getWxUserBindings,
  getWxUserPage,
  triggerContactSync,
  unbindWxUser,
} from '#/api';
import { $t } from '#/locales';

import { getStatusOptions, useColumns, useGridFormSchema } from './data';
import BindingForm from './modules/binding-form.vue';

/**
 * 通讯录页面（后端 WxContactController /scrm/contact/*）。
 *
 * 字典式主从布局：顶部企业筛选（默认第一个授权企业），
 * 左侧部门树（/deptTree 按 corpId 过滤，点击按部门过滤），
 * 右侧成员分页表（/page，支持企业/姓名/状态/deptId 过滤）。
 * "同步通讯录"按钮直接对当前筛选企业触发全量同步（/sync/trigger）。
 *
 * 绑定账号（/scrm/user-binding/*）：业务数据权限的前置条件——
 * 业务数据归属企微成员，经绑定映射到系统账号后才能按系统部门
 * 做角色数据范围过滤；列展示绑定状态，行操作支持 绑定/换绑/解绑。
 */
// ==================== 企业筛选 ====================
const corpOptions = ref<{ label: string; value: string }[]>([]);
const corpFilter = ref<string>();

async function loadCorpOptions() {
  const corps = await getCorpList();
  // 仅已授权企业有通讯录数据
  corpOptions.value = corps
    .filter((corp) => corp.authStatus === 1)
    .map((corp) => ({
      label: corp.corpName || corp.corpId,
      value: corp.corpId,
    }));
}

function onCorpChange() {
  // 切换企业：部门归属随之变化，清空已选部门
  selectedDeptId.value = undefined;
  gridApi.query();
}

// ==================== 左侧：部门树 ====================
const deptTree = ref<ContactApi.DeptTreeNode[]>([]);
const deptLoading = ref(false);
const deptKeyword = ref('');
const selectedDeptId = ref<number>();

/** 部门名称映射（主部门ID → 名称），供右侧表格列渲染 */
const deptNameMap = ref<Map<number, string>>(new Map());

/** 企业过滤 + 关键字过滤：命中节点的父链需整体保留 */
const filteredTree = computed(() => {
  let nodes = corpFilter.value
    ? deptTree.value.filter((node) => node.corpId === corpFilter.value)
    : deptTree.value;
  const kw = deptKeyword.value.trim().toLowerCase();
  if (!kw) return nodes;
  const filterNodes = (
    nodes: ContactApi.DeptTreeNode[],
  ): ContactApi.DeptTreeNode[] => {
    const result: ContactApi.DeptTreeNode[] = [];
    for (const node of nodes) {
      const children = filterNodes(node.children ?? []);
      if (node.name?.toLowerCase().includes(kw) || children.length > 0) {
        result.push({ ...node, children });
      }
    }
    return result;
  };
  return filterNodes(nodes);
});

function collectDeptNames(
  nodes: ContactApi.DeptTreeNode[],
  map: Map<number, string>,
) {
  for (const node of nodes) {
    map.set(node.deptId, node.name ?? '');
    collectDeptNames(node.children ?? [], map);
  }
}

/** 树数据/企业过滤/关键字变化后：重算部门名映射，清掉失效的已选部门 */
watch(filteredTree, (tree) => {
  const map = new Map<number, string>();
  collectDeptNames(tree, map);
  deptNameMap.value = map;
  if (
    selectedDeptId.value !== undefined &&
    !collectDeptIds(tree).includes(selectedDeptId.value)
  ) {
    selectedDeptId.value = undefined;
    gridApi.query();
  }
});

function collectDeptIds(nodes: ContactApi.DeptTreeNode[]): number[] {
  return nodes.flatMap((node) => [
    node.deptId,
    ...collectDeptIds(node.children ?? []),
  ]);
}

async function loadDeptTree() {
  deptLoading.value = true;
  try {
    deptTree.value = (await getDeptTree()) ?? [];
  } finally {
    deptLoading.value = false;
  }
}

function onSelectDept(value?: number) {
  // 再次点击已选中部门 → 取消选中（语义为"查看全部成员"）
  selectedDeptId.value =
    value !== undefined && value === selectedDeptId.value ? undefined : value;
  gridApi.query();
}

// ==================== 同步通讯录（对当前筛选企业） ====================
const syncing = ref(false);

function onSync() {
  const corpId = corpFilter.value;
  if (!corpId) return;
  syncing.value = true;
  const hideLoading = message.loading({
    content: $t('contact.syncing'),
    duration: 0,
    key: 'contact_sync_msg',
  });
  triggerContactSync(corpId)
    .then(async () => {
      message.success({
        content: $t('contact.syncSuccess'),
        key: 'contact_sync_msg',
      });
      await loadDeptTree();
      gridApi.query();
    })
    .catch(() => {
      hideLoading();
    })
    .finally(() => {
      syncing.value = false;
    });
}

// ==================== 绑定账号（企微成员 ↔ 系统账号） ====================
/** 绑定记录：corpId+wxUserid → 绑定（列渲染 + 行操作；成员跨企业按企业维度区分） */
const bindingMap = ref<Map<string, UserBindingApi.WxUserBinding>>(new Map());

function bindingKey(corpId?: string, wxUserid?: string) {
  return `${corpId ?? ''}_${wxUserid ?? ''}`;
}

async function loadBindings() {
  const list = (await getWxUserBindings()) ?? [];
  bindingMap.value = new Map(
    list.map((binding) => [
      bindingKey(binding.corpId, binding.wxUserid),
      binding,
    ]),
  );
}

function bindingOf(row: ContactApi.WxUser) {
  return row.userId
    ? bindingMap.value.get(bindingKey(row.corpId, row.userId))
    : undefined;
}

const [BindingDrawer, bindingDrawerApi] = useVbenDrawer({
  connectedComponent: BindingForm,
  destroyOnClose: true,
});

function onBind(row: ContactApi.WxUser) {
  bindingDrawerApi
    .setData({
      binding: bindingOf(row),
      member: {
        corpId: row.corpId,
        name: row.name || row.userId,
        userId: row.userId,
      },
    })
    .open();
}

function onUnbind(row: ContactApi.WxUser) {
  const binding = bindingOf(row);
  if (!binding) return;
  Modal.confirm({
    content: $t('contact.wxBinding.unbindConfirm', [
      row.name || row.userId,
      binding.sysUserName || binding.sysUserUsername || '',
    ]),
    onOk: async () => {
      await unbindWxUser(binding.id);
      message.success($t('contact.wxBinding.unbindSuccess'));
      loadBindings();
    },
    title: $t('contact.wxBinding.unbind'),
  });
}

function onBindingSaved() {
  message.success($t('contact.wxBinding.saveSuccess'));
  loadBindings();
}

// ==================== 右侧：成员表格 ====================
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
          const result = await getWxUserPage({
            corpId: corpFilter.value || undefined,
            current: page.currentPage,
            deptId: selectedDeptId.value,
            size: page.pageSize,
            ...formValues,
          });
          return result;
        },
      },
      // 覆盖宿主全局的 response 映射（result/list: 'items'）：
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
  } as VxeTableGridOptions<ContactApi.WxUser>,
});

function genderText(gender?: number) {
  if (gender === 1) return $t('contact.genderMale');
  if (gender === 2) return $t('contact.genderFemale');
  return $t('contact.genderUnknown');
}

/** 主部门ID → 部门名称（树里找不到时退回原始ID，无值显示 -） */
function mainDeptText(mainDepartment?: number) {
  if (mainDepartment === undefined || mainDepartment === null) return '-';
  return deptNameMap.value.get(mainDepartment) ?? mainDepartment;
}

function statusText(status?: number) {
  const found = getStatusOptions().find((item) => item.value === status);
  return found?.label ?? status;
}

function statusColor(status?: number) {
  switch (status) {
    case 1: {
      return 'success';
    }
    case 2: {
      return 'error';
    }
    default: {
      return 'default';
    }
  }
}

/** 初始化：先加载企业并默认选中第一个授权企业，再加载部门树和绑定列表 */
async function init() {
  await loadCorpOptions();
  const firstCorp = corpOptions.value[0];
  if (!corpFilter.value && firstCorp) {
    corpFilter.value = firstCorp.value;
  }
  await loadDeptTree();
  loadBindings();
}
init();
</script>
<template>
  <Page auto-content-height>
    <!-- 布局对齐统一规范:左侧面板卡片 + 右侧列表 -->
    <div class="flex h-full min-h-0 gap-2">
      <!-- 左侧:企业选择 + 部门树(与用户管理同款 vben Tree 面板) -->
      <div
        class="flex w-60 shrink-0 flex-col gap-2 rounded-md border bg-card p-2"
      >
        <Select
          v-model:value="corpFilter"
          :options="corpOptions"
          :placeholder="$t('contact.corpPlaceholder')"
          show-search
          option-filter-prop="label"
          @change="onCorpChange"
        />
        <Input
          v-model:value="deptKeyword"
          allow-clear
          :placeholder="$t('contact.deptSearch')"
        />
        <Button
          v-access:code="'contact:sync'"
          block
          :disabled="!corpFilter"
          :loading="syncing"
          type="primary"
          @click="onSync"
        >
          {{ $t('contact.sync') }}
        </Button>
        <!-- 工具区与树之间的分割线:-mx-2 抵消 p-2,通到面板两缘 -->
        <div class="-mx-2 border-b border-border"></div>
        <Spin :spinning="deptLoading" :classes="{ root: 'w-full' }">
          <Tree
            class="dept-tree"
            :collapsible="false"
            :tree-data="filteredTree"
            :default-expanded-level="3"
            label-field="name"
            value-field="deptId"
            :model-value="selectedDeptId"
            @update:model-value="onSelectDept"
          >
            <template #node="{ value }">
              <!-- 选中态:蓝色文字 + 对勾;底色由下方 scoped CSS 统一渲染 -->
              <span
                :class="
                  value.deptId === selectedDeptId
                    ? 'font-medium text-primary'
                    : undefined
                "
              >
                {{ value.name }}
              </span>
              <IconifyIcon
                v-if="value.deptId === selectedDeptId"
                class="ml-0.5 inline-block size-3.5 text-primary"
                icon="lucide:check"
              />
            </template>
          </Tree>
        </Spin>
      </div>

      <!-- 右侧:成员表格 -->
      <div class="h-full min-w-0 flex-1">
        <Grid>
          <template #avatar="{ row }">
            <img
              v-if="row.avatar"
              class="size-8 rounded-full object-cover"
              :src="row.avatar"
            />
            <span v-else>-</span>
          </template>
          <template #gender="{ row }">
            {{ genderText(row.gender) }}
          </template>
          <template #mainDept="{ row }">
            {{ mainDeptText(row.mainDepartment) }}
          </template>
          <template #status="{ row }">
            <Tag :color="statusColor(row.status)">
              {{ statusText(row.status) }}
            </Tag>
          </template>
          <template #operation="{ row }">
            <template v-if="bindingOf(row)">
              <Button
                v-access:code="'userbinding:bind'"
                size="small"
                type="link"
                @click="onBind(row)"
              >
                {{ $t('contact.wxBinding.rebind') }}
              </Button>
              <Button
                v-access:code="'userbinding:unbind'"
                danger
                size="small"
                type="link"
                @click="onUnbind(row)"
              >
                {{ $t('contact.wxBinding.unbind') }}
              </Button>
            </template>
            <Button
              v-else
              v-access:code="'userbinding:bind'"
              size="small"
              type="link"
              @click="onBind(row)"
            >
              {{ $t('contact.wxBinding.bind') }}
            </Button>
          </template>
        </Grid>
      </div>
    </div>

    <!-- 绑定/换绑系统账号抽屉 -->
    <BindingDrawer @success="onBindingSaved" />
  </Page>
</template>
<style scoped>
/* vben Tree 的 data-[selected]:bg-accent 工具类在本构建中未生成,
   这里补选中节点的底色(蓝字/对勾由 #node 插槽实现) */
:deep(.dept-tree [data-selected]) {
  background-color: hsl(var(--accent));
}
</style>
