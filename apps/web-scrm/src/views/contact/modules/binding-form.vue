<script lang="ts" setup>
import type { UserBindingApi } from '#/api';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message, Select } from 'antdv-next';

import { bindWxUser, getSystemUserPage } from '#/api';
import { $t } from '#/locales';

/**
 * 企微成员 绑定/换绑系统账号 抽屉（后端 POST /scrm/user-binding）。
 * 绑定是数据权限的前置条件：业务数据归属企微成员，绑定后才能
 * 沿 成员→账号→系统部门 链路按角色数据范围过滤；
 * 租户内 账号↔成员 双向 1:1，同一成员已被其他账号绑定会由后端拒绝。
 */
const emits = defineEmits(['success']);

const saving = ref(false);
const sysUserLoading = ref(false);

/** 目标成员（发起绑定的企微成员，宿主传入；corpId 用于区分多企业下的同名成员） */
const member = ref<{ corpId?: string; name?: string; userId: string }>();
/** 当前已有的绑定（换绑场景，宿主传入） */
const existingBinding = ref<UserBindingApi.WxUserBinding>();

const sysUsers = ref<UserBindingApi.SysUserOption[]>([]);
const sysUserId = ref<UserBindingApi.SysUserOption['id']>();

/** 账号下拉远程搜索：每页条数与搜索防抖间隔 */
const SYS_USER_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const sysUserOptions = computed(() =>
  sysUsers.value.map((user) => ({
    label: `${user.name || user.username}（${user.username}）`,
    value: user.id,
  })),
);

const getDrawerTitle = computed(() =>
  existingBinding.value
    ? $t('contact.wxBinding.rebindTitle', [member.value?.name ?? ''])
    : $t('contact.wxBinding.bindTitle', [member.value?.name ?? '']),
);

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    if (!member.value?.userId) return;
    if (sysUserId.value === undefined) {
      message.warning($t('contact.wxBinding.sysUserRequired'));
      return;
    }
    drawerApi.lock();
    saving.value = true;
    try {
      await bindWxUser({
        corpId: member.value.corpId ?? '',
        sysUserId: sysUserId.value,
        wxUserid: member.value.userId,
      });
      message.success($t('contact.wxBinding.saveSuccess'));
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
          binding?: UserBindingApi.WxUserBinding;
          member?: { corpId?: string; name?: string; userId: string };
        };
    member.value = data?.member;
    existingBinding.value = data?.binding;
    sysUserId.value = undefined;
    sysUsers.value = [];
    loadSysUsers();
  },
});

defineExpose({ drawerApi });

/**
 * 账号下拉远程搜索：账号超过单页容量时按关键字查后端
 * （/system/user/page，keyword 对用户名/姓名/手机号模糊）；
 * 换绑时预选账号若不在当前结果页，手动补进选项保证回显
 */
async function loadSysUsers(keyword?: string) {
  sysUserLoading.value = true;
  try {
    const page = await getSystemUserPage({
      current: 1,
      keyword: keyword || undefined,
      size: SYS_USER_PAGE_SIZE,
    });
    const records = [...(page?.records ?? [])];
    const bound = existingBinding.value;
    if (
      bound &&
      !records.some((user) => String(user.id) === String(bound.sysUserId))
    ) {
      records.unshift({
        id: bound.sysUserId,
        name: bound.sysUserName,
        username: bound.sysUserUsername,
      });
    }
    sysUsers.value = records;
    if (bound) {
      sysUserId.value = bound.sysUserId;
    }
  } finally {
    sysUserLoading.value = false;
  }
}

function onSysUserSearch(keyword: string) {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => {
    loadSysUsers(keyword.trim() || undefined);
  }, SEARCH_DEBOUNCE_MS);
}
</script>
<template>
  <Drawer class="w-full max-w-100" :title="getDrawerTitle">
    <div class="mx-2 flex flex-col gap-4">
      <!-- 企微成员（随选中行，不可改） -->
      <div class="flex items-center gap-3">
        <span class="w-20 shrink-0 text-sm text-muted-foreground">
          {{ $t('contact.wxBinding.member') }}
        </span>
        <span class="text-sm">{{ member?.name ?? member?.userId }}</span>
      </div>
      <!-- 当前绑定（换绑场景展示） -->
      <div v-if="existingBinding" class="flex items-center gap-3">
        <span class="w-20 shrink-0 text-sm text-muted-foreground">
          {{ $t('contact.wxBinding.currentBinding') }}
        </span>
        <span class="text-sm">
          {{
            existingBinding.sysUserName ||
            existingBinding.sysUserUsername ||
            '-'
          }}
        </span>
      </div>
      <!-- 系统账号 -->
      <div class="flex items-center gap-3">
        <span class="w-20 shrink-0 text-sm text-muted-foreground">
          <span class="text-red-500">*</span>
          {{ $t('contact.wxBinding.sysUser') }}
        </span>
        <Select
          v-model:value="sysUserId"
          class="flex-1"
          :filter-option="false"
          :loading="sysUserLoading"
          :options="sysUserOptions"
          :placeholder="$t('contact.wxBinding.sysUserPlaceholder')"
          show-search
          @search="onSysUserSearch"
        />
      </div>
      <div class="text-xs text-muted-foreground">
        {{ $t('contact.wxBinding.hint') }}
      </div>
    </div>
  </Drawer>
</template>
