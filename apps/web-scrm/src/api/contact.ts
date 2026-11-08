import { requestClient } from '#/api/request';

export namespace ContactApi {
  /** 部门树节点（字段与后端 WxDepartmentTreeVO 一致） */
  export interface DeptTreeNode {
    children?: DeptTreeNode[];
    /** 企业ID */
    corpId?: string;
    /** 企微部门ID（树过滤、成员过滤都用它） */
    deptId: number;
    id: number | string;
    /** 部门名称 */
    name?: string;
    /** 企微父部门ID（根部门为 1） */
    parentId?: number;
    [key: string]: any;
  }

  /** 企微成员（字段与后端 WxUser 实体一致） */
  export interface WxUser {
    /** 头像 */
    avatar?: string;
    corpId?: string;
    createTime?: string;
    /** 所属部门ID列表（JSON 数组） */
    departIds?: number[];
    email?: string;
    /** 性别：0=未定义, 1=男, 2=女 */
    gender?: number;
    id: number | string;
    /** 主部门ID */
    mainDepartment?: number;
    mobile?: string;
    name?: string;
    position?: string;
    /** 激活状态: 1=已激活, 2=已禁用, 4=未激活, 5=退出企业 */
    status?: number;
    /** 企微账号ID */
    userId?: string;
    [key: string]: any;
  }

  /** 分页查询参数（后端 Page 绑定 current/size，WxUserQuery 绑定过滤字段） */
  export interface PageParams {
    corpId?: string;
    current?: number;
    /** 部门过滤：成员 departIds 命中即返回 */
    deptId?: number;
    /** 姓名（模糊匹配） */
    name?: string;
    size?: number;
    /** 激活状态：1=已激活, 2=已禁用, 4=未激活, 5=退出企业 */
    status?: number;
  }

  /** 分页返回（后端 IPage 结构） */
  export interface PageResult {
    current: number;
    pages: number;
    records: WxUser[];
    size: number;
    total: number;
  }
  /** 成员列表查询参数（corpId/status 精确、name 模糊、deptId 部门命中） */
  export interface ListParams {
    corpId?: string;
    /** 部门ID：成员 departIds 命中即返回 */
    deptId?: number;
    /** 姓名（模糊匹配） */
    name?: string;
    /** 激活状态：1=已激活, 2=已禁用, 4=未激活, 5=退出企业 */
    status?: number;
  }
}

/**
 * 部门树（后端 WxContactController /scrm/contact/deptTree）
 */
export function getDeptTree() {
  return requestClient.get<ContactApi.DeptTreeNode[]>('/scrm/contact/deptTree');
}

/**
 * 成员列表（不分页，后端 /scrm/contact/list，过滤条件同分页接口）
 */
export function getContactList(params?: ContactApi.ListParams) {
  return requestClient.get<ContactApi.WxUser[]>('/scrm/contact/list', {
    params,
  });
}

/**
 * 成员分页列表
 */
export function getWxUserPage(params: ContactApi.PageParams) {
  return requestClient.get<ContactApi.PageResult>('/scrm/contact/page', {
    params,
  });
}

/**
 * 手动触发通讯录全量同步（后端以 corpId 查询参数接收，接口同步执行、耗时较长）
 */
export function triggerContactSync(corpId: string) {
  return requestClient.post<boolean>('/scrm/contact/sync/trigger', null, {
    params: { corpId },
  });
}
