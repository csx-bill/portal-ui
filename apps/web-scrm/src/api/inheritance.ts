import { requestClient } from '#/api/request';

export namespace InheritanceApi {
  /** 待分配的离职成员客户项 */
  export interface UnassignedItem {
    /** 离职成员的企微 userid */
    handoverUserid: string;
    /** 外部联系人 userid */
    externalUserid: string;
    /** 成员离职时间（时间戳，秒） */
    dimissionTime?: number;
    [key: string]: any;
  }

  /** 待分配列表（游标分页） */
  export interface UnassignedListResp {
    list: UnassignedItem[];
    isLast?: boolean;
    nextCursor?: string;
    [key: string]: any;
  }

  /** 待分配列表查询参数 */
  export interface UnassignedListReq {
    corpId: string;
    cursor?: string;
    pageSize?: number;
    [key: string]: any;
  }

  /** 客户分配请求（在职/离职共用） */
  export interface CustomerTransferReq {
    corpId: string;
    handoverUserid: string;
    takeoverUserid: string;
    externalUseridList: string[];
    /** 转接成功后发给客户的消息（在职继承支持） */
    transferMsg?: string;
    [key: string]: any;
  }

  /** 单个客户的分配结果（errcode=0 仅表示已发起接替流程） */
  export interface CustomerTransferResult {
    externalUserid: string;
    errcode: number;
    [key: string]: any;
  }

  /** 接替状态查询参数（在职/离职共用，游标分页） */
  export interface TransferResultReq {
    corpId: string;
    cursor?: string;
    handoverUserid: string;
    takeoverUserid: string;
    [key: string]: any;
  }

  /** 接替状态项：1-接替完毕 2-等待接替 3-客户拒绝 4-上限 5-无记录 */
  export interface TransferResultItem {
    externalUserid: string;
    status?: number;
    takeoverTime?: number;
    [key: string]: any;
  }

  /** 接替状态查询结果（游标分页） */
  export interface TransferResultResp {
    customer: TransferResultItem[];
    nextCursor?: string;
    [key: string]: any;
  }

  /** 客户群群主转接请求（在职/离职共用） */
  export interface GroupChatTransferReq {
    corpId: string;
    chatIdList: string[];
    newOwner: string;
    [key: string]: any;
  }

  /** 未成功继承的客户群 */
  export interface GroupChatTransferFailed {
    chatId: string;
    errcode?: number;
    errmsg?: string;
    [key: string]: any;
  }

  /** 客户群群主转接结果 */
  export interface GroupChatTransferResp {
    failedChatList?: GroupChatTransferFailed[];
    [key: string]: any;
  }
}

/**
 * 待分配的离职成员客户列表（后端 WxInheritanceController，
 * 代理企微 /externalcontact/get_unassigned_list，游标分页）
 */
export function getUnassignedList(data: InheritanceApi.UnassignedListReq) {
  return requestClient.post<InheritanceApi.UnassignedListResp>(
    '/scrm/inheritance/unassigned/list',
    data,
  );
}

/**
 * 在职继承：分配在职成员的客户（代理 /externalcontact/transfer_customer，
 * 返回逐客户结果，errcode=0 仅表示已发起接替流程）
 */
export function transferOnjobCustomer(
  data: InheritanceApi.CustomerTransferReq,
) {
  return requestClient.post<InheritanceApi.CustomerTransferResult[]>(
    '/scrm/inheritance/onjob/customer/transfer',
    data,
  );
}

/**
 * 在职继承：查询客户接替状态（代理 /externalcontact/transfer_result，
 * status：1-接替完毕 2-等待接替 3-客户拒绝 4-接替成员客户达到上限）
 */
export function getOnjobTransferResult(data: InheritanceApi.TransferResultReq) {
  return requestClient.post<InheritanceApi.TransferResultResp>(
    '/scrm/inheritance/onjob/customer/transfer/result',
    data,
  );
}

/**
 * 在职继承：分配在职成员的客户群（代理 /externalcontact/groupchat/onjob_transfer）
 */
export function transferOnjobGroupChat(
  data: InheritanceApi.GroupChatTransferReq,
) {
  return requestClient.post<InheritanceApi.GroupChatTransferResp>(
    '/scrm/inheritance/onjob/groupchat/transfer',
    data,
  );
}

/**
 * 离职继承：分配离职成员的客户（代理 /externalcontact/resigned/transfer_customer）
 */
export function transferResignedCustomer(
  data: InheritanceApi.CustomerTransferReq,
) {
  return requestClient.post<InheritanceApi.CustomerTransferResult[]>(
    '/scrm/inheritance/resigned/customer/transfer',
    data,
  );
}

/**
 * 离职继承：查询客户接替状态（代理
 * /externalcontact/resigned/transfer_result，游标分页）
 */
export function getResignedTransferResult(
  data: InheritanceApi.TransferResultReq,
) {
  return requestClient.post<InheritanceApi.TransferResultResp>(
    '/scrm/inheritance/resigned/customer/transfer/result',
    data,
  );
}

/**
 * 离职继承：分配离职成员的客户群（代理 /externalcontact/groupchat/transfer）
 */
export function transferResignedGroupChat(
  data: InheritanceApi.GroupChatTransferReq,
) {
  return requestClient.post<InheritanceApi.GroupChatTransferResp>(
    '/scrm/inheritance/resigned/groupchat/transfer',
    data,
  );
}
