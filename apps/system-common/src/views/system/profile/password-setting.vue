<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, ref } from 'vue';

import { ProfilePasswordSetting, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { message } from 'antdv-next';

import { updateProfilePasswordApi } from '#/api/system/profile';

const passwordSettingRef = ref();

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'oldPassword',
      label: $t('systemCommon.system.profile.oldPassword'),
      component: 'InputPassword',
      componentProps: {
        placeholder: $t('systemCommon.system.profile.oldPasswordPlaceholder'),
      },
    },
    {
      fieldName: 'newPassword',
      label: $t('systemCommon.system.profile.newPassword'),
      component: 'InputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: $t('systemCommon.system.profile.newPasswordPlaceholder'),
      },
    },
    {
      fieldName: 'confirmPassword',
      label: $t('systemCommon.system.profile.confirmPassword'),
      component: 'InputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: $t(
          'systemCommon.system.profile.confirmPasswordPlaceholder',
        ),
      },
      dependencies: {
        rules(values) {
          const { newPassword } = values;
          return z
            .string({
              error: $t(
                'systemCommon.system.profile.confirmPasswordPlaceholder',
              ),
            })
            .min(1, {
              message: $t(
                'systemCommon.system.profile.confirmPasswordPlaceholder',
              ),
            })
            .refine((value) => value === newPassword, {
              message: $t('systemCommon.system.profile.passwordMismatch'),
            });
        },
        triggerFields: ['newPassword'],
      },
    },
  ];
});

/**
 * 更新密码：调自助接口（PUT /system/user/profile/password），
 * 后端校验旧密码；成功后清空表单
 */
async function handleSubmit(values: Recordable<any>) {
  await updateProfilePasswordApi({
    newPassword: String(values.newPassword ?? ''),
    oldPassword: String(values.oldPassword ?? ''),
  });
  message.success($t('systemCommon.system.profile.passwordChangeSuccess'));
  passwordSettingRef.value?.getFormApi()?.resetForm();
}
</script>
<template>
  <ProfilePasswordSetting
    ref="passwordSettingRef"
    class="w-1/3"
    :form-schema="formSchema"
    @submit="handleSubmit"
  />
</template>
