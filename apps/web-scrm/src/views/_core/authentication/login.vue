<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();

/**
 * 账号密码登录表单（OAuth2 password 授权）。
 * 验证码登录/二维码登录/注册/忘记密码暂未启用（无对应后端能力），
 * 相应入口均已隐藏；滑块验证为纯前端演示件且后端不校验，一并移除。
 */
const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
  ];
});
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-third-party-login="false"
    :sub-title="$t('login.welcomeSubtitle')"
    :submit-button-text="$t('login.signIn')"
    :title="$t('login.welcomeTitle')"
    @submit="
      (values) => authStore.authLogin({ ...values, grantType: 'password' })
    "
  />
</template>
