<script lang="ts" setup>
import type { AcquisitionApi, ContactApi } from '#/api';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Checkbox, Input, message, Select, TreeSelect } from 'antdv-next';

import {
  createAcquisitionLink,
  getContactList,
  getDeptTree,
  getDictOptionsByType,
  updateAcquisitionLink,
} from '#/api';
import { $t } from '#/locales';

/**
 * 获客链接 新建/编辑抽屉（后端 POST/PUT /scrm/acquisition/link，
 * 均同步企微接口）。字段约束与企微 create_link/update_link 对齐：
 * 链接名称≤30字符；使用范围成员/部门不可同时为空且为覆盖更新
 * （覆盖人数≤500）；优先分配 type=2 时优先成员必填（≤1000）；
 * 标记来源仅「营销获客」应用生效，默认开启。
 * 客户渠道为本地标记字段（sys_dict customer_channel），选填。
 */
const emits = defineEmits(['success']);

const corpId = ref<string>();
const corpName = ref('');
const isEdit = ref(false);
const editingRow = ref<AcquisitionApi.WxAcquisitionLink>();

const memberLoading = ref(false);
const members = ref<{ label: string; value: string }[]>([]);
const deptTree = ref<ContactApi.DeptTreeNode[]>([]);
const channelOptions = ref<{ label: string; value: string }[]>([]);

const formLinkName = ref('');
const formRangeUsers = ref<string[]>([]);
const formRangeDepts = ref<number[]>([]);
const formSkipVerify = ref(true);
const formPriorityType = ref<number>();
const formPriorityUseridList = ref<string[]>([]);
const formMarkSource = ref(true);
const formChannel = ref<string>();

const priorityTypeOptions = computed(() => [
  { label: $t('acquisition.priorityType1'), value: 1 },
  { label: $t('acquisition.priorityType2'), value: 2 },
]);

/** 部门树按当前企业过滤后转 TreeSelect 数据 */
function toTreeSelectData(
  nodes?: ContactApi.DeptTreeNode[],
): Array<{ children?: any[]; title: string; value: number }> {
  return (nodes ?? []).map((node) => ({
    children: toTreeSelectData(node.children),
    title: node.name || String(node.deptId),
    value: node.deptId,
  }));
}

const deptTreeData = computed(() => {
  const tree = deptTree.value ?? [];
  if (!corpId.value) return [];
  const matched = tree.filter((node) => node.corpId === corpId.value);
  return toTreeSelectData(matched.length > 0 ? matched : tree);
});

const rangeSummary = computed(() =>
  $t('acquisition.rangeSummary', [
    formRangeUsers.value.length,
    formRangeDepts.value.length,
  ]),
);

/** 加载表单选项：使用范围（成员/部门）+ 客户渠道字典 */
async function loadOptions() {
  if (!corpId.value) return;
  memberLoading.value = true;
  try {
    const users = await getContactList({ corpId: corpId.value });
    members.value = (users ?? []).map((user) => ({
      label: user.name || user.userId || '',
      value: user.userId || '',
    }));
    deptTree.value = (await getDeptTree()) ?? [];
    channelOptions.value = await getDictOptionsByType('customer_channel');
  } finally {
    memberLoading.value = false;
  }
}

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const linkName = formLinkName.value.trim();
    if (!linkName) {
      message.warning($t('acquisition.nameRequired'));
      return;
    }
    if (
      formRangeUsers.value.length === 0 &&
      formRangeDepts.value.length === 0
    ) {
      message.warning($t('acquisition.rangeRequired'));
      return;
    }
    if (
      formPriorityType.value === 2 &&
      formPriorityUseridList.value.length === 0
    ) {
      message.warning($t('acquisition.priorityListRequired'));
      return;
    }
    drawerApi.lock();
    try {
      // priorityType 未设置时不传（保持企微侧原值）；优先成员列表仅 type=2 时携带
      const priorityFields = {
        markSource: formMarkSource.value,
        priorityType: formPriorityType.value,
        priorityUseridList:
          formPriorityType.value === 2
            ? formPriorityUseridList.value
            : undefined,
        // 客户渠道为本地标记字段，选填
        customerChannel: formChannel.value || undefined,
      };
      if (isEdit.value && editingRow.value) {
        await updateAcquisitionLink({
          corpId: corpId.value ?? '',
          id: editingRow.value.id,
          linkId: editingRow.value.linkId ?? '',
          linkName,
          rangeDepartmentList: formRangeDepts.value,
          rangeUserList: formRangeUsers.value,
          skipVerify: formSkipVerify.value,
          ...priorityFields,
        });
        message.success($t('acquisition.updateSuccess'));
      } else {
        await createAcquisitionLink({
          corpId: corpId.value ?? '',
          linkName,
          rangeDepartmentList: formRangeDepts.value,
          rangeUserList: formRangeUsers.value,
          skipVerify: formSkipVerify.value,
          ...priorityFields,
        });
        message.success($t('acquisition.createSuccess'));
      }
      emits('success');
      drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData() as
      | undefined
      | {
          corpId?: string;
          corpName?: string;
          row?: AcquisitionApi.WxAcquisitionLink;
        };
    corpId.value = data?.corpId;
    corpName.value = data?.corpName ?? data?.corpId ?? '';
    isEdit.value = !!data?.row;
    editingRow.value = data?.row;
    formLinkName.value = data?.row?.linkName ?? '';
    formRangeUsers.value = [...(data?.row?.rangeUserList ?? [])];
    formRangeDepts.value = [...(data?.row?.rangeDepartmentList ?? [])];
    formSkipVerify.value = data?.row ? data.row.skipVerify !== false : true;
    formPriorityType.value = data?.row?.priorityType;
    formPriorityUseridList.value = [...(data?.row?.priorityUseridList ?? [])];
    formMarkSource.value = data?.row ? data.row.markSource !== false : true;
    formChannel.value = data?.row?.customerChannel || undefined;
    loadOptions();
  },
});

const getDrawerTitle = computed(() =>
  isEdit.value ? $t('acquisition.editTitle') : $t('acquisition.create'),
);
</script>
<template>
  <Drawer class="w-full max-w-130" :title="getDrawerTitle">
    <div class="mx-2 flex flex-col gap-4">
      <!-- 企业（随列表当前筛选，不可改） -->
      <div class="flex items-center gap-3">
        <span class="w-20 shrink-0 text-sm text-muted-foreground">
          {{ $t('acquisition.corp') }}
        </span>
        <span class="text-sm">{{ corpName }}</span>
      </div>
      <!-- 链接名称 -->
      <div class="flex items-center gap-3">
        <span class="w-20 shrink-0 text-sm text-muted-foreground">
          <span class="text-red-500">*</span>
          {{ $t('acquisition.linkName') }}
        </span>
        <Input
          v-model:value="formLinkName"
          allow-clear
          class="flex-1"
          :maxlength="30"
          :placeholder="$t('acquisition.linkNamePlaceholder')"
          show-count
        />
      </div>
      <!-- 使用范围 -->
      <div class="flex items-start gap-3">
        <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
          {{ $t('acquisition.range') }}
        </span>
        <div class="flex flex-1 flex-col gap-2">
          <Select
            v-model:value="formRangeUsers"
            allow-clear
            :loading="memberLoading"
            :max-tag-count="3"
            mode="multiple"
            :options="members"
            :placeholder="$t('acquisition.userPlaceholder')"
            show-search
            option-filter-prop="label"
          />
          <TreeSelect
            v-model:value="formRangeDepts"
            allow-clear
            class="w-full"
            :loading="memberLoading"
            :max-tag-count="3"
            multiple
            :placeholder="$t('acquisition.deptPlaceholder')"
            show-search
            :tree-data="deptTreeData"
            tree-default-expand-all
            tree-node-filter-prop="title"
          />
          <div class="text-xs text-muted-foreground">
            {{ rangeSummary }}
          </div>
        </div>
      </div>
      <!-- 无需验证 -->
      <div class="flex items-center gap-3">
        <span class="w-20 shrink-0 text-sm text-muted-foreground">
          {{ $t('acquisition.skipVerify') }}
        </span>
        <Checkbox v-model:checked="formSkipVerify">
          {{ $t('acquisition.skipVerifyTrue') }}
        </Checkbox>
      </div>
      <!-- 客户渠道（本地标记，字典可选） -->
      <div class="flex items-center gap-3">
        <span class="w-20 shrink-0 text-sm text-muted-foreground">
          {{ $t('acquisition.customerChannel') }}
        </span>
        <Select
          v-model:value="formChannel"
          allow-clear
          class="flex-1"
          :loading="memberLoading"
          :options="channelOptions"
          :placeholder="$t('acquisition.channelPlaceholder')"
        />
      </div>
      <!-- 优先分配 -->
      <div class="flex items-start gap-3">
        <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
          {{ $t('acquisition.priorityType') }}
        </span>
        <div class="flex flex-1 flex-col gap-2">
          <Select
            v-model:value="formPriorityType"
            allow-clear
            class="w-full"
            :options="priorityTypeOptions"
            :placeholder="$t('acquisition.priorityPlaceholder')"
          />
          <Select
            v-if="formPriorityType === 2"
            v-model:value="formPriorityUseridList"
            allow-clear
            :loading="memberLoading"
            :max-tag-count="3"
            mode="multiple"
            :options="members"
            :placeholder="$t('acquisition.userPlaceholder')"
            show-search
            option-filter-prop="label"
          />
        </div>
      </div>
      <!-- 标记来源 -->
      <div class="flex items-start gap-3">
        <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
          {{ $t('acquisition.markSource') }}
        </span>
        <div class="flex flex-1 flex-col gap-1">
          <Checkbox v-model:checked="formMarkSource">
            {{ $t('acquisition.markSource') }}
          </Checkbox>
          <div class="text-xs text-muted-foreground">
            {{ $t('acquisition.markSourceHint') }}
          </div>
        </div>
      </div>
    </div>
  </Drawer>
</template>
