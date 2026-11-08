<script lang="ts" setup>
import type { ContactApi } from '#/api';

import { computed, ref, watch } from 'vue';

import { Tree } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Input, Select, Spin } from 'antdv-next';

import { getContactList, getDeptTree } from '#/api';

/**
 * 通讯录选择面板：企业由宿主通过 corpId 控制；
 * 组织树 = 部门节点 + 挂在主部门下的成员节点（头像/姓名），
 * 使用与用户管理一致的 vben Tree（选中 = 整行底色 + 蓝字 + 对勾）。
 *
 * 点击成员切换选中（再次点击取消），change 事件回传成员的
 * 企微 userId（未选中为 undefined），供右侧列表按跟进成员/群主过滤。
 * 点击部门节点同样可点选（与成员互斥），切换时
 * 通过 deptChange 事件回传部门ID，供宿主按部门过滤。
 */

interface MemberTreeNode {
  children?: MemberTreeNode[];
  /** 部门节点携带（用于点选） */
  deptId?: number;
  isMember?: boolean;
  key: string;
  title: string;
  user?: ContactApi.WxUser;
}

const props = defineProps<{
  /** 企业由宿主控制（v-model:corp-id），面板随其加载部门/成员 */
  corpId?: string;
  /** 企业下拉选项（授权企业列表，宿主加载后传入） */
  corpOptions?: Array<{ label: string; value: string }>;
  /** 企业选择占位文案 */
  corpPlaceholder?: string;
}>();

const emits = defineEmits<{
  change: [userId: string | undefined];
  corpChange: [corpId?: string];
  'update:corpId': [corpId?: string];
  deptChange: [deptId: number | undefined];
}>();

const deptTree = ref<ContactApi.DeptTreeNode[]>([]);
const deptLoading = ref(false);
const deptKeyword = ref('');

const members = ref<ContactApi.WxUser[]>([]);
const memberLoading = ref(false);
const selectedUserId = ref<string>();
/** 选中的部门（与成员互斥） */
const selectedDeptId = ref<number>();

/** 组织树：部门节点下按主部门挂成员叶子（无主部门的成员不展示） */
function buildTree(
  nodes: ContactApi.DeptTreeNode[],
  byDept: Map<number, ContactApi.WxUser[]>,
): MemberTreeNode[] {
  return nodes.map((node) => {
    const children = buildTree(node.children ?? [], byDept);
    const deptMembers = (byDept.get(node.deptId) ?? []).map((user) => ({
      isMember: true,
      // 用企微 userId(字符串)作 key:雪花 id 序列化为 JSON 数字会丢精度
      key: `u_${user.userId}`,
      title: user.name || user.userId || '',
      user,
    }));
    return {
      children: [...children, ...deptMembers],
      deptId: node.deptId,
      isMember: false,
      key: `d_${node.deptId}`,
      title: node.name ?? '',
    };
  });
}

/** 成员按主部门分组（无主部门时取所属部门第一个） */
const membersByDept = computed(() => {
  const byDept = new Map<number, ContactApi.WxUser[]>();
  for (const user of members.value) {
    const deptKey = user.mainDepartment ?? user.departIds?.[0];
    if (deptKey === undefined) continue;
    const list = byDept.get(deptKey) ?? [];
    list.push(user);
    byDept.set(deptKey, list);
  }
  return byDept;
});

/** 企业过滤 + 关键字过滤（部门名/成员名均可命中，父链整体保留） */
const filteredTree = computed(() => {
  const nodes = props.corpId
    ? deptTree.value.filter((node) => node.corpId === props.corpId)
    : deptTree.value;
  const kw = deptKeyword.value.trim().toLowerCase();
  const full = buildTree(nodes, membersByDept.value);
  if (!kw) return full;
  const filterNodes = (list: MemberTreeNode[]): MemberTreeNode[] => {
    const result: MemberTreeNode[] = [];
    for (const node of list) {
      const children = filterNodes(node.children ?? []);
      if (node.title.toLowerCase().includes(kw) || children.length > 0) {
        result.push({ ...node, children });
      }
    }
    return result;
  };
  return filterNodes(full);
});

/** 当前选中节点的 key（d_xxx 部门 / u_xxx 成员），驱动 vben Tree 选中底色 */
const selectedKey = computed(() => {
  if (selectedDeptId.value !== undefined) {
    return `d_${selectedDeptId.value}`;
  }
  if (selectedUserId.value !== undefined) {
    const member = members.value.find((u) => u.userId === selectedUserId.value);
    if (member) return `u_${member.userId}`;
  }
  return undefined;
});

function isSelected(value: MemberTreeNode) {
  if (value.isMember && value.user) {
    return selectedUserId.value === value.user.userId;
  }
  if (value.deptId !== undefined) {
    return String(selectedDeptId.value) === String(value.deptId);
  }
  return false;
}

function isSelectable(value: MemberTreeNode) {
  return (value.isMember && !!value.user) || value.deptId !== undefined;
}

async function loadDeptTree() {
  deptLoading.value = true;
  try {
    deptTree.value = (await getDeptTree()) ?? [];
  } finally {
    deptLoading.value = false;
  }
}

async function loadMembers() {
  if (!props.corpId) {
    members.value = [];
    return;
  }
  memberLoading.value = true;
  try {
    members.value = (await getContactList({ corpId: props.corpId })) ?? [];
  } finally {
    memberLoading.value = false;
  }
}

// 切换企业：重置部门树/成员/选中（右侧过滤由宿主的企业切换处理）
watch(
  () => props.corpId,
  () => {
    selectedUserId.value = undefined;
    selectedDeptId.value = undefined;
    loadDeptTree();
    loadMembers();
  },
  { immediate: true },
);

function onSelectMember(user: ContactApi.WxUser) {
  if (!user.userId) return;
  const next = selectedUserId.value === user.userId ? undefined : user.userId;
  selectedUserId.value = next;
  // 部门与成员互斥：选中成员时清除部门选中
  if (next !== undefined && selectedDeptId.value !== undefined) {
    selectedDeptId.value = undefined;
    emits('deptChange', undefined);
  }
  emits('change', next);
}

function onSelectDept(deptId: number) {
  const next = selectedDeptId.value === deptId ? undefined : deptId;
  selectedDeptId.value = next;
  // 部门与成员互斥：选中部门时清除成员选中
  if (next !== undefined && selectedUserId.value !== undefined) {
    selectedUserId.value = undefined;
    emits('change', undefined);
  }
  emits('deptChange', next);
}

/**
 * vben Tree 选中回调：按 key 前缀路由到部门/成员的选中处理
 * （两个 handler 内部自带 toggle 与互斥逻辑）
 */
function onNodeSelect(key?: number | string) {
  const k = key === undefined || key === null ? undefined : String(key);
  if (k === undefined) return;
  if (k.startsWith('d_')) {
    onSelectDept(Number(k.slice(2)));
  } else if (k.startsWith('u_')) {
    // 成员 key 用企微 userId(字符串),避免雪花 id 数字精度丢失
    const user = members.value.find((u) => u.userId === k.slice(2));
    if (user?.userId) onSelectMember(user);
  }
}

/**
 * 节点内容点击（@stop 拦截,不进 vben Tree 的 replace 选择流程）：
 * 点击已选中项 → 取消选中;点击未选中项 → 选中
 */
function onNodeClick(value: MemberTreeNode) {
  if (!isSelectable(value)) return;
  if (value.isMember && value.user) {
    onSelectMember(value.user);
  } else if (value.deptId !== undefined) {
    onSelectDept(value.deptId);
  }
}
</script>
<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex shrink-0 flex-col gap-2 border-b border-border p-3">
      <Select
        :value="corpId"
        :options="corpOptions ?? []"
        :placeholder="corpPlaceholder ?? $t('contact.corpPlaceholder')"
        show-search
        option-filter-prop="label"
        @change="
          (value: any) => {
            emits('update:corpId', value);
            emits('corpChange', value);
          }
        "
      />
      <Input
        v-model:value="deptKeyword"
        allow-clear
        :placeholder="$t('contact.deptSearch')"
      />
      <!-- 宿主操作区（如同步按钮） -->
      <slot name="actions"></slot>
    </div>
    <Spin
      :spinning="deptLoading || memberLoading"
      class="min-h-0 flex-1 overflow-auto"
      :classes="{ root: 'w-full' }"
    >
      <Tree
        class="emp-tree"
        :collapsible="false"
        :tree-data="filteredTree"
        :default-expanded-level="3"
        label-field="title"
        value-field="key"
        :model-value="selectedKey"
        @update:model-value="onNodeSelect"
      >
        <template #node="{ value }">
          <span
            class="flex min-w-0 flex-1 items-center truncate"
            :class="[
              isSelected(value) ? 'font-medium text-primary' : undefined,
              isSelectable(value) ? 'cursor-pointer' : undefined,
            ]"
            @click.stop="onNodeClick(value)"
          >
            {{ value.title }}
            <IconifyIcon
              v-if="isSelected(value)"
              class="ml-0.5 inline-block size-4 shrink-0 text-primary"
              icon="lucide:check"
            />
          </span>
        </template>
      </Tree>
    </Spin>
  </div>
</template>
<style scoped>
/* vben Tree 的 data-[selected]:bg-accent 工具类在本构建中未生成,
   这里补选中节点的整行底色(蓝字/对勾由 #node 插槽实现) */
:deep(.emp-tree [data-selected]) {
  background-color: hsl(var(--accent));
}
</style>
