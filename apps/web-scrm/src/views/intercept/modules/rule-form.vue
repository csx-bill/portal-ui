<script lang="ts" setup>
import type { ContactApi, InterceptRuleApi } from '#/api';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Button,
  CheckboxGroup,
  Input,
  message,
  Select,
  Spin,
  TreeSelect,
} from 'antdv-next';

import {
  createInterceptRule,
  getContactList,
  getDeptTree,
  getInterceptRule,
  updateInterceptRule,
} from '#/api';
import { $t } from '#/locales';

/**
 * 敏感词规则 新建/编辑抽屉（后端 POST/PUT /scrm/intercept/rule，
 * 均直接调用企微接口）。字段约束与企微 intercept_rule 系列对齐：
 * 规则名称≤20字符；敏感词每个1~32字符、最多300个（修改时整组覆盖，
 * 企微不支持通过修改清空全部敏感词）；语义规则勾选项整组提交，
 * 编辑时全不勾=清除全部语义规则；适用范围成员/部门至少填一个，
 * 服务端按企微详情做差量增删。
 */
const emits = defineEmits(['success']);

/** 语义规则可选项（值与企微 semantics_list 一致） */
const SEMANTICS_OPTIONS = [
  { label: $t('intercept.semanticsPhone'), value: 1 },
  { label: $t('intercept.semanticsEmail'), value: 2 },
  { label: $t('intercept.semanticsRedPacket'), value: 3 },
];

/** 拦截动作可选项（值与企微 intercept_type 一致） */
const INTERCEPT_TYPE_OPTIONS = [
  { label: $t('intercept.interceptType1'), value: 1 },
  { label: $t('intercept.interceptType2'), value: 2 },
];

/** 单个敏感词最大长度 / 规则内敏感词数量上限（企微限制） */
const WORD_MAX_LENGTH = 32;
const WORD_MAX_COUNT = 300;

const corpId = ref<string>();
const corpName = ref('');
const isEdit = ref(false);
const editingRuleId = ref<string>();

const detailLoading = ref(false);
const saving = ref(false);

const ruleName = ref('');
const interceptType = ref<number>(1);
const words = ref<string[]>([]);
const wordInput = ref('');
const semantics = ref<number[]>([]);
const formRangeUsers = ref<string[]>([]);
const formRangeDepts = ref<number[]>([]);

const members = ref<{ label: string; value: string }[]>([]);
const memberLoading = ref(false);
const deptTree = ref<ContactApi.DeptTreeNode[]>([]);

const wordsOverflow = computed(() => words.value.length >= WORD_MAX_COUNT);

const rangeSummary = computed(() =>
  $t('intercept.rangeSummary', [
    formRangeUsers.value.length,
    formRangeDepts.value.length,
  ]),
);

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

function onAddWord() {
  const word = wordInput.value.trim();
  if (!word) return;
  if (word.length > WORD_MAX_LENGTH) {
    message.warning($t('intercept.wordTooLong'));
    return;
  }
  if (words.value.includes(word)) {
    message.warning($t('intercept.wordDuplicate'));
    return;
  }
  if (words.value.length >= WORD_MAX_COUNT) {
    message.warning($t('intercept.wordMaxCount'));
    return;
  }
  words.value.push(word);
  wordInput.value = '';
}

function onRemoveWord(index: number) {
  words.value.splice(index, 1);
}

/** 加载适用范围选项：成员 + 部门树 */
async function loadRangeOptions() {
  if (!corpId.value) return;
  memberLoading.value = true;
  try {
    const users = await getContactList({ corpId: corpId.value });
    members.value = (users ?? []).map((user) => ({
      label: user.name || user.userId || '',
      value: user.userId || '',
    }));
    deptTree.value = (await getDeptTree()) ?? [];
  } finally {
    memberLoading.value = false;
  }
}

/** 编辑模式按详情加载完整配置（列表数据仅为摘要） */
async function loadDetail(ruleId: string) {
  detailLoading.value = true;
  try {
    const detail = await getInterceptRule(corpId.value ?? '', ruleId);
    ruleName.value = detail.ruleName ?? '';
    interceptType.value = detail.interceptType ?? 1;
    words.value = [...(detail.wordList ?? [])];
    semantics.value = [...(detail.semanticsList ?? [])];
    formRangeUsers.value = [...(detail.userList ?? [])];
    formRangeDepts.value = [...(detail.departmentList ?? [])];
  } finally {
    detailLoading.value = false;
  }
}

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const name = ruleName.value.trim();
    if (!name) {
      message.warning($t('intercept.ruleNameRequired'));
      return;
    }
    if (words.value.length === 0) {
      message.warning($t('intercept.wordRequired'));
      return;
    }
    if (
      formRangeUsers.value.length === 0 &&
      formRangeDepts.value.length === 0
    ) {
      message.warning($t('intercept.rangeRequired'));
      return;
    }
    drawerApi.lock();
    saving.value = true;
    try {
      // 语义规则整组提交：编辑时全不勾=空数组=清除全部语义规则
      const params: InterceptRuleApi.SaveParams = {
        corpId: corpId.value ?? '',
        departmentList: formRangeDepts.value,
        interceptType: interceptType.value,
        ruleId: editingRuleId.value,
        ruleName: name,
        semanticsList: semantics.value,
        userList: formRangeUsers.value,
        wordList: words.value,
      };
      await (isEdit.value
        ? updateInterceptRule(params)
        : createInterceptRule(params));
      message.success($t('intercept.saveSuccess'));
      emits('success');
      drawerApi.close();
    } finally {
      saving.value = false;
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
          row?: InterceptRuleApi.WxInterceptRule;
        };
    corpId.value = data?.corpId;
    corpName.value = data?.corpName ?? data?.corpId ?? '';
    isEdit.value = !!data?.row;
    editingRuleId.value = data?.row?.ruleId;
    ruleName.value = data?.row?.ruleName ?? '';
    interceptType.value = 1;
    words.value = [];
    wordInput.value = '';
    semantics.value = [];
    formRangeUsers.value = [];
    formRangeDepts.value = [];
    loadRangeOptions();
    if (isEdit.value && editingRuleId.value) {
      loadDetail(editingRuleId.value);
    }
  },
});

defineExpose({ drawerApi });

const getDrawerTitle = computed(() =>
  isEdit.value ? $t('intercept.edit') : $t('intercept.create'),
);
</script>
<template>
  <Drawer class="w-full max-w-130" :title="getDrawerTitle">
    <Spin :spinning="detailLoading">
      <div class="mx-2 flex flex-col gap-4">
        <!-- 企业（随列表当前筛选，不可改） -->
        <div class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm text-muted-foreground">
            {{ $t('intercept.corp') }}
          </span>
          <span class="text-sm">{{ corpName }}</span>
        </div>
        <!-- 规则名称 -->
        <div class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm text-muted-foreground">
            <span class="text-red-500">*</span>
            {{ $t('intercept.ruleName') }}
          </span>
          <Input
            v-model:value="ruleName"
            allow-clear
            class="flex-1"
            :maxlength="20"
            :placeholder="$t('intercept.ruleNamePlaceholder')"
            show-count
          />
        </div>
        <!-- 拦截动作 -->
        <div class="flex items-center gap-3">
          <span class="w-20 shrink-0 text-sm text-muted-foreground">
            <span class="text-red-500">*</span>
            {{ $t('intercept.interceptType') }}
          </span>
          <Select
            v-model:value="interceptType"
            class="flex-1"
            :options="INTERCEPT_TYPE_OPTIONS"
          />
        </div>
        <!-- 敏感词 -->
        <div class="flex flex-col gap-2">
          <span class="text-sm text-muted-foreground">
            <span class="text-red-500">*</span>
            {{ $t('intercept.wordList') }}
          </span>
          <div
            v-for="(word, index) in words"
            :key="word"
            class="flex items-center gap-2"
          >
            <Input
              class="flex-1"
              :maxlength="WORD_MAX_LENGTH"
              readonly
              :value="word"
            />
            <Button danger type="text" @click="onRemoveWord(index)">✕</Button>
          </div>
          <div class="flex items-center gap-2">
            <Input
              v-model:value="wordInput"
              allow-clear
              class="flex-1"
              :maxlength="WORD_MAX_LENGTH"
              :disabled="wordsOverflow"
              :placeholder="$t('intercept.addWordPlaceholder')"
              @press-enter="onAddWord"
            />
            <Button :disabled="wordsOverflow" @click="onAddWord">
              {{ $t('intercept.addWord') }}
            </Button>
          </div>
          <div class="text-xs text-muted-foreground">
            {{ $t('intercept.wordCountTip', [words.length, WORD_MAX_COUNT]) }}
          </div>
        </div>
        <!-- 语义规则 -->
        <div class="flex items-start gap-3">
          <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
            {{ $t('intercept.semantics') }}
          </span>
          <div class="flex flex-1 flex-col gap-1">
            <CheckboxGroup
              v-model:value="semantics"
              :options="SEMANTICS_OPTIONS"
            />
            <div v-if="isEdit" class="text-xs text-muted-foreground">
              {{ $t('intercept.semanticsEditTip') }}
            </div>
          </div>
        </div>
        <!-- 适用范围 -->
        <div class="flex items-start gap-3">
          <span class="w-20 shrink-0 pt-1.5 text-sm text-muted-foreground">
            <span class="text-red-500">*</span>
            {{ $t('intercept.range') }}
          </span>
          <div class="flex flex-1 flex-col gap-2">
            <Select
              v-model:value="formRangeUsers"
              allow-clear
              :loading="memberLoading"
              :max-tag-count="3"
              mode="multiple"
              :options="members"
              :placeholder="$t('intercept.userPlaceholder')"
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
              :placeholder="$t('intercept.deptPlaceholder')"
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
      </div>
    </Spin>
  </Drawer>
</template>
