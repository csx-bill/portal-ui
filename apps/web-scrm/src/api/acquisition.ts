import { requestClient } from '#/api/request';

export namespace AcquisitionApi {
  /** 企微获客链接（字段与后端 WxAcquisitionLink 实体一致） */
  export interface WxAcquisitionLink {
    corpId?: string;
    createTime?: string;
    id: number | string;
    /** 是否标记客户添加来源（仅营销获客应用生效） */
    markSource?: boolean;
    /** 链接ID（企微返回） */
    linkId?: string;
    /** 链接名称，最长30字符 */
    linkName?: string;
    /** 优先级成员ID列表（priorityType=2 时使用） */
    priorityUseridList?: string[];
    /** 优先级类型: 1-企业全员优先, 2-指定成员列表 */
    priorityType?: number;
    /** 使用范围-部门ID列表（企微部门ID） */
    rangeDepartmentList?: number[];
    /** 使用范围-成员ID列表（企微 userid） */
    rangeUserList?: string[];
    /** 是否无需验证，默认 true */
    skipVerify?: boolean;
    /** 同步版本号 */
    syncVersion?: number;
    /** 链接URL（客户扫码/点击后添加成员） */
    url?: string;
    [key: string]: any;
  }

  /** 分页查询参数（后端 Page 绑定 current/size，Query 绑定过滤字段） */
  export interface PageParams {
    corpId?: string;
    current?: number;
    /** 链接名称（模糊匹配） */
    linkName?: string;
    /** 按使用范围部门过滤（企微部门ID，命中 range_department_list） */
    rangeDeptId?: number;
    /** 按使用范围成员过滤（企微 userid，命中 range_user_list） */
    rangeUserid?: string;
    size?: number;
  }

  /** 分页返回（后端 IPage 结构） */
  export interface PageResult {
    current: number;
    pages: number;
    records: WxAcquisitionLink[];
    size: number;
    total: number;
  }

  /** 创建参数（对应企微 customer_acquisition/create_link） */
  export interface CreateReq {
    corpId: string;
    /** 链接名称，最长30字符 */
    linkName: string;
    /** 使用范围-成员ID列表；与部门列表不可同时为空，覆盖人数≤500 */
    rangeUserList?: string[];
    /** 使用范围-部门ID列表 */
    rangeDepartmentList?: number[];
    /** 是否无需验证，默认 true */
    skipVerify?: boolean;
    /** 客户与成员关系绑定: 1-企业内优先好友成员, 2-指定成员优先（仅部分经营类目企业支持） */
    priorityType?: number;
    /** 优先级成员ID列表（priorityType=2 时必填，最多1000个） */
    priorityUseridList?: string[];
    /** 是否标记客户添加来源，默认 true；仅「营销获客」应用生效 */
    markSource?: boolean;
  }

  /** 更新参数（对应企微 customer_acquisition/update_link，range 为覆盖更新） */
  export interface UpdateReq {
    id: number | string;
    corpId: string;
    /** 获客链接ID（企微返回） */
    linkId: string;
    linkName?: string;
    rangeUserList?: string[];
    rangeDepartmentList?: number[];
    skipVerify?: boolean;
    /** 不传保持原值 */
    priorityType?: number;
    /** priorityType=2 时必填，最多1000个 */
    priorityUseridList?: string[];
    /** 不传保持原值 */
    markSource?: boolean;
  }
}

/**
 * 获客链接分页列表（后端 WxAcquisitionLinkController
 * /scrm/acquisition/link/page，代理企微 /customer_acquisition/list_link）。
 * 过滤条件：corpId / linkName 模糊，仅非空字段生效
 */
export function getAcquisitionLinkPage(params: AcquisitionApi.PageParams) {
  return requestClient.get<AcquisitionApi.PageResult>(
    '/scrm/acquisition/link/page',
    { params },
  );
}

/** 获客链接详情（按数据库主键查询） */
export function getAcquisitionLinkById(id: number | string) {
  return requestClient.get<AcquisitionApi.WxAcquisitionLink>(
    `/scrm/acquisition/link/${id}`,
  );
}

/**
 * 创建获客链接（代理企微 /customer_acquisition/create_link：
 * link_name 必填≤30字符，range 成员/部门不可同时为空）
 */
export function createAcquisitionLink(data: AcquisitionApi.CreateReq) {
  return requestClient.post<boolean>('/scrm/acquisition/link', data);
}

/**
 * 编辑获客链接（代理企微 /customer_acquisition/update_link，
 * range 为覆盖更新；仅当前应用创建的链接可编辑）
 */
export function updateAcquisitionLink(data: AcquisitionApi.UpdateReq) {
  return requestClient.put<boolean>('/scrm/acquisition/link', data);
}

/** 删除获客链接（代理企微 /customer_acquisition/delete_link，删除后链接失效） */
export function deleteAcquisitionLink(id: number | string) {
  return requestClient.delete<boolean>(`/scrm/acquisition/link/${id}`);
}

/** 手动触发获客链接全量同步（后端以 corpId 查询参数接收，接口同步执行、耗时较长） */
export function triggerAcquisitionLinkSync(corpId: string) {
  return requestClient.post<boolean>(
    '/scrm/acquisition/link/sync/trigger',
    null,
    {
      params: { corpId },
    },
  );
}
