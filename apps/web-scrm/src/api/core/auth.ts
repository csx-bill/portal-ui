import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password?: string;
    username?: string;
    grantType?: string;
  }

  /** 登录接口返回值（适配后） */
  export interface LoginResult {
    accessToken: string;
    refreshToken: string;
  }

  export interface RefreshTokenResult {
    accessToken: string;
    refreshToken: string;
  }
}

/** OAuth2 客户端配置 */
const CLIENT_ID = import.meta.env.VITE_APP_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_APP_CLIENT_SECRET;

/**
 * 登录（OAuth2 password/mobile grant type）
 */
export async function loginApi(data: AuthApi.LoginParams) {
  const result = await requestClient.post('/oauth2/token', null, {
    params: {
      grant_type: data.grantType || 'password',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      username: data.username,
      password: data.password,
    },
  });

  // 映射 access_token → accessToken, refresh_token → refreshToken
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
  } as AuthApi.LoginResult;
}

/**
 * 刷新 accessToken（OAuth2 refresh_token grant type）
 */
export async function refreshTokenApi(refreshToken: string) {
  const result = await baseRequestClient.post('/oauth2/refresh', null, {
    params: {
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    },
  });

  return {
    accessToken: result.data?.access_token,
    refreshToken: result.data?.refresh_token,
  } as AuthApi.RefreshTokenResult;
}

/**
 * 退出登录
 */
export async function logoutApi(accessToken?: string) {
  return baseRequestClient.post('/oauth2/logout', null, {
    params: {
      access_token: accessToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    },
  });
}
