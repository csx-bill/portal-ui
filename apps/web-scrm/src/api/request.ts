/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';
import {
  TENANT_LIST_URL,
  TENANT_STORAGE_KEY,
} from '@vben/system-common/constants';

import { message } from 'antdv-next';

import { useAuthStore } from '#/store';

import { refreshTokenApi } from './core';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    const accessStore = useAccessStore();
    const authStore = useAuthStore();
    accessStore.setAccessToken(null);
    if (
      preferences.app.loginExpiredMode === 'modal' &&
      accessStore.isAccessChecked
    ) {
      accessStore.setLoginExpired(true);
    } else {
      await authStore.logout();
    }
  }

  /**
   * 刷新token逻辑
   */
  async function doRefreshToken() {
    const accessStore = useAccessStore();
    const resp = await refreshTokenApi(accessStore.refreshToken ?? '');
    accessStore.setAccessToken(resp.accessToken);
    accessStore.setRefreshToken(resp.refreshToken);
    return resp.accessToken;
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  const CLIENT_ID = import.meta.env.VITE_APP_CLIENT_ID;

  /**
   * 确保租户 ID 已建立（localStorage 里可能没有值：首次使用、
   * 或登出时 resetAllStores 清掉了）。首个业务请求前懒加载租户
   * 列表并取第一个写入 localStorage；不依赖 system-common 的
   * 远程 store（租户切换弹窗打开时也会由它刷新该键）。
   */
  let ensureTenantIdPromise: null | Promise<void> = null;
  function ensureTenantId() {
    if (localStorage.getItem(TENANT_STORAGE_KEY)) {
      return;
    }
    ensureTenantIdPromise ??= client
      .get<Array<{ id: number | string }>>(TENANT_LIST_URL)
      .then((list) => {
        const firstTenant = list?.[0];
        if (firstTenant) {
          localStorage.setItem(TENANT_STORAGE_KEY, String(firstTenant.id));
        }
      })
      .catch(() => {
        // 拉取失败（如未登录）不阻塞业务请求，下次请求再试
      })
      .finally(() => {
        // 无论成败都清掉缓存的 Promise：成功后若键再被清空
        // （如登出时 resetAllStores），下次请求才能重新建立，
        // 否则会一直命中已解决的旧 Promise 导致租户头丢失
        ensureTenantIdPromise = null;
      });
    return ensureTenantIdPromise;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      config.headers['Client-Id'] = CLIENT_ID;

      // 多租户：登录/刷新 token 接口与租户列表自身无需租户头，
      // 其余首个业务请求前先确保租户 ID 已建立（见 ensureTenantId）
      const requestUrl = config.url ?? '';
      const skipTenantEnsure =
        requestUrl.includes('/oauth2/') || requestUrl.includes(TENANT_LIST_URL);
      if (!skipTenantEnsure) {
        await ensureTenantId();
      }
      // 当前租户 ID 以 localStorage 的 last_tenant_id 为唯一事实来源
      // （与远程 useTenantStore 的持久化键一致），直接读取，
      // 避免请求层对远程模块产生运行时依赖
      const tenantId = localStorage.getItem(TENANT_STORAGE_KEY);
      if (tenantId) {
        config.headers['X-Tenant-Id'] = tenantId;
      }
      return config;
    },
  });

  // 处理返回的响应数据格式
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode: 0,
    }),
  );

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
      // 当前mock接口返回的错误字段是 error 或者 message
      const responseData = error?.response?.data ?? {};
      const errorMessage = responseData?.error ?? responseData?.message ?? '';
      // 如果没有错误信息，则会根据状态码进行提示
      message.error(errorMessage || msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
