<script lang="ts" setup>
import type { GroupChatApi } from '#/api';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Tag } from 'antdv-next';

import { getGroupChatMemberList, getGroupChatMemberStatistic } from '#/api';
import { $t } from '#/locales';

/**
 * 群成员查看抽屉（群列表"成员"入口）。
 * 成员身份按群主/管理员/成员标记；入群方式 0=成员邀请 3=扫描群二维码。
 * 头部汇总条展示当日成员变动统计（入群/退群）。
 */
const group = ref<GroupChatApi.WxGroupChat>();
const loading = ref(false);
const members = ref<GroupChatApi.WxGroupChatMember[]>([]);
const todayAdd = ref(0);
const todayDel = ref(0);

const [Drawer, drawerApi] = useVbenDrawer({
  footer: false,
  onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData() as
      | undefined
      | { group: GroupChatApi.WxGroupChat };
    group.value = data?.group;
    loadMembers();
    loadStatistic();
  },
});

async function loadMembers() {
  if (!group.value?.chatId) return;
  loading.value = true;
  try {
    members.value = (await getGroupChatMemberList(group.value.chatId)) ?? [];
  } finally {
    loading.value = false;
  }
}

/** 当日成员变动统计（入群/退群） */
async function loadStatistic() {
  if (!group.value?.chatId) return;
  try {
    const stat = await getGroupChatMemberStatistic(group.value.chatId);
    todayAdd.value = stat?.addCount ?? 0;
    todayDel.value = stat?.delCount ?? 0;
  } catch {
    todayAdd.value = 0;
    todayDel.value = 0;
  }
}

function roleOf(userId?: string): 'admin' | 'member' | 'owner' {
  if (userId && userId === group.value?.owner) return 'owner';
  if (userId && (group.value?.adminList ?? []).includes(userId)) return 'admin';
  return 'member';
}

function roleText(userId?: string) {
  const role = roleOf(userId);
  if (role === 'owner') return $t('groupchat.roleOwner');
  if (role === 'admin') return $t('groupchat.roleAdmin');
  return $t('groupchat.roleMember');
}

function roleColor(userId?: string) {
  const role = roleOf(userId);
  if (role === 'owner') return 'error';
  if (role === 'admin') return 'warning';
  return 'default';
}

function sceneText(scene?: number) {
  if (scene === 3) return $t('groupchat.scene3');
  if (scene === 0) return $t('groupchat.scene0');
  return '-';
}

function initial(name?: string) {
  return name ? name.slice(0, 1) : '?';
}

const drawerTitle = computed(
  () => `${$t('groupchat.memberDrawerTitle')} - ${group.value?.chatName ?? ''}`,
);
</script>
<template>
  <Drawer class="w-full max-w-140" :title="drawerTitle">
    <div class="mx-2 flex flex-col gap-3">
      <!-- 成员汇总 -->
      <div
        class="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
      >
        <span class="truncate text-base font-semibold">
          {{ group?.chatName }}
        </span>
        <div class="flex shrink-0 items-center gap-3 text-xs">
          <span class="text-muted-foreground">
            {{ $t('groupchat.statTodayAdd') }}：
            <span class="text-sm font-semibold text-green-600">
              {{ todayAdd }}
            </span>
          </span>
          <span class="text-muted-foreground">
            {{ $t('groupchat.statTodayDel') }}：
            <span class="text-sm font-semibold text-red-500">
              {{ todayDel }}
            </span>
          </span>
          <Tag color="primary">
            {{ $t('groupchat.memberCount', [members.length]) }}
          </Tag>
        </div>
      </div>

      <!-- 成员卡片列表 -->
      <div class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
        <div
          v-for="member in members"
          :key="member.userId"
          class="flex items-center gap-3 rounded-md border p-2.5"
        >
          <!-- 头像 -->
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary"
          >
            {{ initial(member.name || member.userId) }}
          </div>
          <!-- 名称与身份 -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium">
                {{ member.name || member.userId || '-' }}
              </span>
              <Tag class="shrink-0" :color="roleColor(member.userId)">
                {{ roleText(member.userId) }}
              </Tag>
            </div>
            <div
              v-if="member.groupNickname"
              class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground"
            >
              {{ $t('groupchat.groupNickname') }}：{{ member.groupNickname }}
            </div>
          </div>
          <!-- 入群信息 -->
          <div class="shrink-0 text-right text-xs text-muted-foreground">
            <div>{{ sceneText(member.joinScene) }}</div>
            <div class="mt-0.5">{{ member.joinTime ?? '-' }}</div>
          </div>
        </div>
      </div>
    </div>
  </Drawer>
</template>
