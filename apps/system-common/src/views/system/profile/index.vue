<script lang="ts" setup>
import { computed, ref } from 'vue';

import { Profile } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import ProfileBase from './base-setting.vue';
import ProfilePassword from './password-setting.vue';

/**
 * 个人中心页面（模块联邦 expose 入口：./ProfilePage）。
 *
 * 无菜单入口：各宿主以本地路由（path=/profile，hideInMenu）挂载，
 * 路由 component 写 loadRemotePage('ProfilePage')。
 * 页面标题取自文案键（宿主路由 meta.title 仍引用各自的 page.* 键）。
 */
const userStore = useUserStore();

const tabsValue = ref<string>('basic');

const tabs = computed(() => [
  {
    label: $t('systemCommon.system.profile.tabBasic'),
    value: 'basic',
  },
  {
    label: $t('systemCommon.system.profile.tabPassword'),
    value: 'password',
  },
]);
</script>
<template>
  <Profile
    v-model:model-value="tabsValue"
    :title="$t('systemCommon.system.profile.title')"
    :user-info="userStore.userInfo"
    :tabs="tabs"
  >
    <template #content>
      <ProfileBase v-if="tabsValue === 'basic'" />
      <ProfilePassword v-if="tabsValue === 'password'" />
    </template>
  </Profile>
</template>
