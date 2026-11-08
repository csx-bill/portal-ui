import { requestClient } from '#/api/request';

export namespace CustomerApi {
  /** 企微客户记录（字段与后端 WxCustomer 实体一致） */
  export interface WxCustomer {
    /** 头像 */
    avatar?: string;
    corpFullName?: string;
    /** 外部联系人所在企业的简称 */
    corpName?: string;
    corpId?: string;
    createTime?: string;
    /** 外部联系人的userid */
    externalUserId?: string;
    /** 性别：0=未知, 1=男, 2=女 */
    gender?: number;
    id: number | string;
    name?: string;
    position?: string;
    /** 同步版本号 */
    syncVersion?: number;
    /** 客户类型：1=微信用户, 2=企业微信用户 */
    type?: number;
    unionId?: string;
    /** 添加了此外部联系人的企业成员userid */
    userId?: string;
    /** 该成员添加此外部联系人的时间 */
    followCreateTime?: string;
    /** 企业自定义的state参数（联系我/获客链接渠道标识） */
    followState?: string;
    /** 企微原始数据快照（含 followedUsers[0].tags 客户标签等），列表解析展示用 */
    extraData?: Record<string, any>;
    /** 是否流失: 0=正常, 1=流失（好友关系解除） */
    lostFlag?: number;
    /** 流失发起方: 1=客户主动删除, 2=员工删除 */
    lostBy?: number;
    /** 流失原因 */
    lostReason?: string;
    /** 流失时间 */
    lostTime?: string;
    /** 客户交接目标成员userid（交接/继承场景） */
    handoverToUserid?: string;
    /** 客户交接时间 */
    handoverTime?: string;
    [key: string]: any;
  }

  /** 分页查询参数（后端 Page 绑定 current/size，WxCustomerQuery 绑定过滤字段） */
  export interface PageParams {
    corpId?: string;
    current?: number;
    /** 客户名称（模糊匹配） */
    name?: string;
    /** 是否流失: 0=正常, 1=流失（不传查全部） */
    lostFlag?: number;
    size?: number;
    /** 添加了此外部联系人的企业成员userid */
    userId?: string;
  }

  /** 列表查询参数（同分页过滤字段，不分页） */
  export interface ListParams {
    corpId?: string;
    /** 客户名称（模糊匹配） */
    name?: string;
    /** 添加了此外部联系人的企业成员userid */
    userId?: string;
  }

  /** 分页返回（后端 IPage 结构） */
  export interface PageResult {
    current: number;
    pages: number;
    records: WxCustomer[];
    size: number;
    total: number;
  }

  /** 客户标签编辑参数（后端转发企微 externalcontact/mark_tag） */
  export interface MarkTagParams {
    corpId: string;
    /** 跟进成员userid */
    userId: string;
    externalUserId: string;
    /** 要标记的标签ID列表 */
    addTag?: string[];
    /** 要移除的标签ID列表 */
    removeTag?: string[];
  }

  /** 修改客户备注信息参数（后端转发企微 externalcontact/remark） */
  export interface RemarkParams {
    corpId: string;
    /** 跟进成员userid */
    userId: string;
    externalUserId: string;
    /** 备注信息（最多20个字符） */
    remark?: string;
    /** 描述信息（最多150个字符） */
    description?: string;
    /** 备注的所属公司名称（最多20个字符，仅微信用户有效） */
    remarkCompany?: string;
    /** 备注手机号（覆盖式更新） */
    remarkMobiles?: string[];
  }

  /** 客户统计-当日汇总 */
  export interface Statistic {
    /** 客户总数 */
    total?: number;
    /** 今日新增（按添加时间） */
    todayNew?: number;
    /** 今日流失 */
    todayLost?: number;
    /** 累计流失 */
    lostTotal?: number;
  }
}

/**
 * 企微客户分页列表（后端 WxCustomerController /scrm/customer/page）。
 * 过滤条件：corpId / userId 精确、name 模糊，仅非空字段生效
 */
export function getCustomerPage(params: CustomerApi.PageParams) {
  return requestClient.get<CustomerApi.PageResult>('/scrm/customer/page', {
    params,
  });
}

/**
 * 客户列表（不分页，后端 /scrm/customer/list，过滤条件同分页接口）
 */
export function getCustomerList(params?: CustomerApi.ListParams) {
  return requestClient.get<CustomerApi.WxCustomer[]>('/scrm/customer/list', {
    params,
  });
}

/**
 * 手动触发客户全量同步（后端以 corpId 查询参数接收，接口同步执行、耗时较长）
 */
export function triggerCustomerSync(corpId: string) {
  return requestClient.post<boolean>('/scrm/customer/sync/trigger', null, {
    params: { corpId },
  });
}

/**
 * 客户统计-当日汇总（后端 WxCustomerController /scrm/customer/statistic/summary）。
 * 实时口径：本地表即时计算（客户总数/今日新增/今日流失/累计流失）
 */
export function getCustomerStatisticSummary(corpId: string) {
  return requestClient.get<CustomerApi.Statistic>(
    '/scrm/customer/statistic/summary',
    { params: { corpId } },
  );
}

/**
 * 编辑客户标签（后端转发企微 externalcontact/mark_tag，文档 92697）。
 * addTag/removeTag 为标签ID列表，成功后后端会刷新该客户的本地快照
 */
export function markCustomerTag(data: CustomerApi.MarkTagParams) {
  return requestClient.post<boolean>('/scrm/customer/markTag', data);
}

/**
 * 修改客户备注信息（后端转发企微 externalcontact/remark，文档 92694）。
 * 成功后后端会刷新该客户的本地快照
 */
export function updateCustomerRemark(data: CustomerApi.RemarkParams) {
  return requestClient.post<boolean>('/scrm/customer/remark', data);
}
