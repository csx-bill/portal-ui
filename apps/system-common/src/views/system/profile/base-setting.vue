<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, onMounted, ref } from 'vue';

import { ProfileBaseSetting } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import { message } from 'antdv-next';

import { getProfileApi, updateProfileApi } from '#/api/system/profile';

const profileBaseSettingRef = ref();

/**
 * 基本设置表单（当前登录用户自助）。
 * 性别取值对齐后端 SysUser.gender：0-未知 1-男 2-女；
 * 角色在角色管理里分配，不在个人中心维护。
 */
const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'name',
      component: 'Input',
      label: $t('systemCommon.system.profile.name'),
    },
    {
      fieldName: 'username',
      component: 'Input',
      label: $t('systemCommon.system.profile.username'),
    },
    {
      fieldName: 'mobile',
      component: 'Input',
      label: $t('systemCommon.system.profile.mobile'),
    },
    {
      component: 'Select',
      componentProps: {
        class: 'w-full',
        options: [
          { label: $t('systemCommon.system.profile.genderUnknown'), value: 0 },
          { label: $t('systemCommon.system.profile.genderMale'), value: 1 },
          { label: $t('systemCommon.system.profile.genderFemale'), value: 2 },
        ],
      },
      defaultValue: 0,
      fieldName: 'gender',
      label: $t('systemCommon.system.profile.gender'),
    },
    {
      fieldName: 'email',
      component: 'Input',
      label: $t('systemCommon.system.profile.email'),
    },
  ];
});

onMounted(async () => {
  const profile = await getProfileApi();
  profileBaseSettingRef.value.getFormApi().setValues({
    name: profile.name,
    username: profile.username,
    mobile: profile.mobile,
    email: profile.email,
    gender: profile.gender ?? 0,
  });
});

/**
 * 更新基本信息：调自助接口（PUT /system/user/profile），
 * 成功后同步宿主 store 里头部展示的用户姓名
 */
async function onSubmit(values: Recordable<any>) {
  const name = String(values.name ?? '');
  await updateProfileApi({
    name,
    username: values.username ? String(values.username) : undefined,
    mobile: values.mobile ? String(values.mobile) : undefined,
    gender: typeof values.gender === 'number' ? values.gender : undefined,
    email: values.email ? String(values.email) : undefined,
  });
  message.success($t('systemCommon.system.profile.updateSuccess'));
  const userStore = useUserStore();
  if (userStore.userInfo) {
    userStore.setUserInfo({ ...userStore.userInfo, realName: name });
  }
}
</script>
<template>
  <ProfileBaseSetting
    ref="profileBaseSettingRef"
    :form-schema="formSchema"
    @submit="onSubmit"
  />
</template>
