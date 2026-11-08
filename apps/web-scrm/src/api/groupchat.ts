import { requestClient } from '#/api/request';

export namespace GroupChatApi {
  /** 企微客户群记录（字段与后端 WxGroupChat 实体一致） */
  export interface WxGroupChat {
    /** 群管理员userid列表 */
    adminList?: string[];
    chatId?: string;
    /** 群名称 */
    chatName?: string;
    /** 群创建时间（企微群详情返回） */
    groupCreateTime?: string;
    corpId?: string;
    createTime?: string;
    id: number | string;
    /** 群成员总数 */
    memberNum?: number;
    /** 群成员版本号（update 回调 CurMemVer，事件一致性校验） */
    memberVersion?: number;
    /** 是否已解散: 0=否, 1=已解散 */
    dismissFlag?: number;
    /** 解散时间 */
    dismissTime?: string;
    /** 群公告 */
    notice?: string;
    /** 群主ID */
    owner?: string;
    /** 客户群跟进状态：0=跟进人正常, 1=跟进人离职, 2=离职继承中, 3=离职继承完成 */
    status?: number;
    [key: string]: any;
  }

  /** 分页查询参数（后端 Page 绑定 current/size，WxGroupChatQuery 绑定过滤字段） */
  export interface PageParams {
    chatName?: string;
    corpId?: string;
    current?: number;
    /** 群主ID（精确匹配） */
    owner?: string;
    size?: number;
  }

  /** 群成员（字段与后端 WxGroupChatMember 实体一致） */
  export interface WxGroupChatMember {
    chatId?: string;
    corpId?: string;
    id: number | string;
    /** 入群方式：0=成员邀请, 3=扫描群二维码 */
    joinScene?: number;
    /** 入群时间 */
    joinTime?: string;
    /** 群昵称 */
    groupNickname?: string;
    /** 成员名称 */
    name?: string;
    type?: number;
    /** 企业成员userid / 外部联系人userid */
    userId?: string;
    [key: string]: any;
  }

  /** 分页查询参数（后端 Page 绑定 current/size，WxGroupChatQuery 绑定过滤字段） */
  export interface ListParams {
    corpId?: string;
    /** 群主ID（精确匹配） */
    owner?: string;
    /** 群名称（模糊匹配） */
    chatName?: string;
  }

  /** 分页返回（后端 IPage 结构） */
  export interface PageResult {
    current: number;
    pages: number;
    records: WxGroupChat[];
    size: number;
    total: number;
  }
  /** 客户群数据统计行（按日聚合或按群主） */
  export interface GroupChatStatistic {
    statDate?: string;
    owner?: string;
    /** 新增客户群数量 */
    newChatCnt: number;
    /** 截至当天客户群总数 */
    chatTotal: number;
    /** 新增群人数 */
    newMemberCnt: number;
    /** 当日退群人数 */
    delMemberCnt: number;
    /** 截至当天群总人数 */
    memberTotal: number;
  }
}

/**
 * 客户群分页列表（后端 WxGroupChatController /scrm/groupchat/page）。
 * 过滤条件：corpId / owner 精确、chatName 模糊，仅非空字段生效
 */
export function getGroupChatPage(params: GroupChatApi.PageParams) {
  return requestClient.get<GroupChatApi.PageResult>('/scrm/groupchat/page', {
    params,
  });
}

/**
 * 客户群列表（不分页，后端 /scrm/groupchat/list，过滤条件同分页接口）
 */
export function getGroupChatList(params?: GroupChatApi.ListParams) {
  return requestClient.get<GroupChatApi.WxGroupChat[]>('/scrm/groupchat/list', {
    params,
  });
}

/**
 * 群成员列表（后端 /scrm/groupchat/member/list，按入群时间升序）
 */
export function getGroupChatMemberList(chatId: string) {
  return requestClient.get<GroupChatApi.WxGroupChatMember[]>(
    '/scrm/groupchat/member/list',
    { params: { chatId } },
  );
}

/**
 * 群成员变动统计（指定日期的入群/退群数量，date 不传默认当天）
 */
export function getGroupChatMemberStatistic(chatId: string) {
  return requestClient.get<{
    addCount?: number;
    delCount?: number;
  }>('/scrm/groupchat/member/statistic', {
    params: { chatId },
  });
}

/**
 * 按企业聚合的各群当日成员变动统计（每群一条：chatId + 入群/退群数）
 */
export function getGroupChatMemberStatisticList(corpId: string) {
  return requestClient.get<
    Array<{
      chatId: string;
      addCount: number;
      delCount: number;
    }>
  >('/scrm/groupchat/member/statistic/list', {
    params: { corpId },
  });
}

/**
 * 客户群数据统计-当日汇总（合计全部群主，date 不传默认当天）
 */
export function getGroupChatStatisticSummary(corpId: string, date?: string) {
  return requestClient.get<GroupChatApi.GroupChatStatistic>(
    '/scrm/groupchat/statistic/summary',
    { params: { corpId, date } },
  );
}

/**
 * 手动触发客户群全量同步（后端以 corpId 查询参数接收，接口同步执行、耗时较长）
 */
export function triggerGroupChatSync(corpId: string) {
  return requestClient.post<boolean>('/scrm/groupchat/sync/trigger', null, {
    params: { corpId },
  });
}
