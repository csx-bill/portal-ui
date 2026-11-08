import { requestClient } from '#/api/request';

export namespace UserBindingApi {
  /** 系统用户-企微成员绑定（字段与后端 WxUserBindingVo 一致） */
  export interface WxUserBinding {
    /** 绑定记录ID */
    id: string;
    corpId?: string;
    createTime?: string;
    /** 系统用户ID */
    sysUserId: number | string;
    /** 系统用户登录账号 */
    sysUserUsername?: string;
    /** 系统用户姓名 */
    sysUserName?: string;
    /** 企微成员ID */
    wxUserid: string;
    /** 企微成员姓名 */
    wxUserName?: string;
    [key: string]: any;
  }

  /** 绑定/换绑参数（后端 WxUserBindingSaveReq，同企业内 账号↔成员 双向 1:1） */
  export interface BindParams {
    /** 系统用户ID */
    sysUserId: number | string;
    /** 企业ID（成员所属企业，一个租户可授权多家企业） */
    corpId: string;
    /** 企微成员ID */
    wxUserid: string;
  }

  /** 绑定抽屉的账号选项（取自 /system/user/page 的 SystemUser） */
  export interface SysUserOption {
    id: number | string;
    mobile?: string;
    name?: string;
    username?: string;
    [key: string]: any;
  }

  /** /system/user/page 返回（后端 IPage 结构） */
  export interface SysUserPageResult {
    current: number;
    pages: number;
    records: SysUserOption[];
    size: number;
    total: number;
  }
}

/**
 * 绑定列表（后端 WxUserBindingController /scrm/user-binding/list，
 * 当前租户全部绑定，带成员姓名与账号信息）
 */
export function getWxUserBindings() {
  return requestClient.get<UserBindingApi.WxUserBinding[]>(
    '/scrm/user-binding/list',
  );
}

/**
 * 系统用户分页（绑定抽屉的账号下拉数据源，直接复用 system 模块已有接口）
 */
export function getSystemUserPage(params?: {
  current?: number;
  keyword?: string;
  size?: number;
}) {
  return requestClient.get<UserBindingApi.SysUserPageResult>(
    '/system/user/page',
    { params },
  );
}

/**
 * 绑定/换绑（同一账号重复绑定视为换绑；成员已被其他账号绑定则后端拒绝）
 */
export function bindWxUser(params: UserBindingApi.BindParams) {
  return requestClient.post<boolean>('/scrm/user-binding', params);
}

/**
 * 解绑
 */
export function unbindWxUser(id: UserBindingApi.WxUserBinding['id']) {
  return requestClient.delete<boolean>(`/scrm/user-binding/${id}`);
}
