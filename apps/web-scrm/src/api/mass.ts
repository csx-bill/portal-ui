import { requestClient } from '#/api/request';

export namespace MassApi {
  /** 企微群发任务记录（字段与后端 WxMassTask 实体一致） */
  export interface WxMassTask {
    /** 是否允许成员二次选择客户（0-否，1-是） */
    allowSelect?: boolean;
    chatId?: string;
    corpId?: string;
    createTime?: string;
    /** 群发类型：single-客户，group-客户群，tag-标签客户 */
    chatType?: string;
    cronExpression?: string;
    /** 执行类型（ScheduleType 枚举名） */
    executeType?: string;
    id: number | string;
    /** 任务状态：0-停用，1-启用，2-执行中，3-已完成 */
    status?: number;
    /** 预计执行时间 */
    scheduledTime?: string;
    /** 指定发送成员userid集合 */
    senderList?: string[];
    /** 群发任务名称 */
    taskName?: string;
    [key: string]: any;
  }

  /** 群发内容（字段与后端 WxMassContentSaveReq 一致） */
  export interface WxMassContent {
    filename?: string;
    linkDesc?: string;
    linkTitle?: string;
    linkUrl?: string;
    miniAppid?: string;
    miniPage?: string;
    miniTitle?: string;
    /** 消息类型：text-文本，image-图片，video-视频，file-文件，link-链接，miniprogram-小程序 */
    msgType: string;
    /** 附件排序（从小到大，最多9个） */
    sort?: string;
    /** 文本内容（msg_type = text 时使用） */
    textContent?: string;
    /** 资源地址 */
    url?: string;
    [key: string]: any;
  }

  /**
   * 群发任务保存参数（POST /scrm/mass 请求体；GET /{id} 编辑详情同构）。
   * targetIdList 必须始终传数组（后端保存目标时直接 stream，null 会 NPE）
   */
  export interface WxMassTaskSaveReq {
    allowSelect?: boolean;
    chatType: string;
    corpId?: string;
    cronExpression?: string;
    contentList?: WxMassContent[];
    id?: number | string;
    /** 客户标签过滤条件（企微 group_list JSON 串） */
    tagFilter?: string;
    /** 发送目标列表（single-客户ID / group-群ID；tag 类型传空数组） */
    targetIdList?: string[];
    /** 执行类型（ScheduleType 枚举名）：IMMEDIATE-立即执行，ONCE-仅一次，DAILY-每天，WEEKLY-每周，MONTHLY-每月，CRON-自定义Cron */
    executeType?: string;
    scheduledTime?: string;
    senderList?: string[];
    status?: number;
    taskName?: string;
    [key: string]: any;
  }

  /** 企微群发调用记录（字段与后端 WxMassInvokeLog 实体一致） */
  export interface WxMassInvokeLog {
    allowSelect?: boolean;
    corpId?: string;
    createTime?: string;
    errmsg?: string;
    /** 标签过滤条件 JSON 串 */
    extraData?: string;
    id: number | string;
    /** 群发消息ID */
    msgid?: string;
    sender?: string;
    status?: string;
    /** 群发任务名称 */
    taskName?: string;
    taskId?: number | string;
    triggerType?: string;
    /** 群发类型：single-客户，group-客户群，tag-标签客户 */
    chatType?: string;
    /** 该次调用的发送目标列表（invokeLog/{id} 详情返回） */
    targetIdList?: string[];
    /** 该次调用的内容快照（invokeLog/{id} 详情返回） */
    contentList?: WxMassContent[];
    [key: string]: any;
  }

  /**
   * 任务维度送达统计（全部批次合计，来自 /scrm/mass/statistic/taskList）。
   * 口径：未发送（status=0，成员未确认）不计入失败；
   * 失败 = 客户非好友（status=2）+ 已收到其他群发（status=3）
   */
  export interface WxMassTaskStat {
    batchCnt?: number;
    deliveredCnt?: number;
    failFriendCnt?: number;
    failOtherCnt?: number;
    taskId: number | string;
    totalCnt?: number;
    unsentCnt?: number;
  }

  /** 单批次（一次调用）送达统计 */
  export interface WxMassBatchStat {
    deliveredCnt?: number;
    failFriendCnt?: number;
    failOtherCnt?: number;
    invokeId: number | string;
    /** 成员发送明细（单任务统计接口返回） */
    members?: WxMassUserStat[];
    totalCnt?: number;
    unsentCnt?: number;
  }

  /** 成员维度发送统计 */
  export interface WxMassUserStat {
    deliveredCnt?: number;
    failFriendCnt?: number;
    failOtherCnt?: number;
    totalCnt?: number;
    unsentCnt?: number;
    userId: string;
  }

  /** 单任务送达统计（GET /scrm/mass/statistic/task/{taskId} 返回体） */
  export interface WxMassTaskBatchStatResp {
    batches: WxMassBatchStat[];
    summary: WxMassTaskStat;
    taskId: number | string;
  }

  /** 任务分页查询参数（后端 Page 绑定 current/size，WxMassTaskQuery 绑定过滤字段） */
  export interface PageParams {
    chatType?: string;
    corpId?: string;
    current?: number;
    /** 发送成员userid（按 sender_list 过滤，通讯录树过滤用） */
    sender?: string;
    size?: number;
    /** 任务状态：0-停用，1-启用，2-执行中，3-已完成 */
    status?: number;
    /** 任务名称（模糊匹配） */
    taskName?: string;
  }

  /** 调用记录分页查询参数 */
  export interface InvokeLogPageParams {
    chatType?: string;
    corpId?: string;
    current?: number;
    size?: number;
    /** 调用状态：SUCCESS-成功，FAIL-失败 */
    status?: string;
    taskId?: number | string;
    taskName?: string;
  }

  /** 分页返回（后端 IPage 结构） */
  export interface PageResult<T = WxMassTask> {
    current: number;
    pages: number;
    records: T[];
    size: number;
    total: number;
  }
}

/**
 * 群发任务分页列表（后端 WxMassController /scrm/mass/taskPage）。
 * 过滤条件：corpId/chatType/status 精确、taskName 模糊，仅非空字段生效
 */
export function getMassTaskPage(params: MassApi.PageParams) {
  return requestClient.get<MassApi.PageResult>('/scrm/mass/taskPage', {
    params,
  });
}

/**
 * 群发任务详情（含发送目标 targetIdList 与内容 contentList，编辑回显用）
 */
export function getMassTaskById(id: MassApi.WxMassTask['id']) {
  return requestClient.get<MassApi.WxMassTaskSaveReq>(`/scrm/mass/${id}`);
}

/**
 * 保存群发任务（后端 POST /scrm/mass：id 为空新增，否则更新）
 */
export function saveMassTask(data: MassApi.WxMassTaskSaveReq) {
  return requestClient.post<boolean>('/scrm/mass', data);
}

/**
 * 批量删除群发任务（后端以逗号分隔的 ids 查询参数接收，同时取消调度）
 */
export function delMassTasks(ids: string) {
  return requestClient.delete<boolean>('/scrm/mass', {
    params: { ids },
  });
}

/**
 * 调用记录分页列表（后端 /scrm/mass/invokeLogPage）
 */
export function getInvokeLogPage(params: MassApi.InvokeLogPageParams) {
  return requestClient.get<MassApi.PageResult<MassApi.WxMassInvokeLog>>(
    '/scrm/mass/invokeLogPage',
    { params },
  );
}

/**
 * 调用记录详情（后端返回该次调用的记录+发送目标+内容快照 WxMassInvokeLogResp，
 * status 为调用状态 SUCCESS/FAIL，区别于任务状态 0-3）
 */
export function getInvokeLogById(id: MassApi.WxMassInvokeLog['id']) {
  return requestClient.get<MassApi.WxMassInvokeLog>(
    `/scrm/mass/invokeLog/${id}`,
  );
}

/**
 * 手动同步企微群发任务结果（后端 POST /scrm/mass/syncResult）：
 * 同步近3天内已发送任务的送达结果，返回处理的批次数量，0 表示数据已是最新
 */
export function syncMassTaskResult(corpId: string) {
  return requestClient.post<number>('/scrm/mass/syncResult', null, {
    params: { corpId },
  });
}

/**
 * 任务维度送达统计（全部批次合计）。
 * 无发送记录的任务不在返回中，调用方按 taskId 自行补零
 */
export function getMassTaskStats(ids: Array<number | string>) {
  return requestClient.get<MassApi.WxMassTaskStat[]>(
    '/scrm/mass/statistic/taskList',
    { params: { ids: ids.join(',') } },
  );
}

/**
 * 单任务送达统计：全部批次合计 + 各批次明细（含成员维度）
 */
export function getMassTaskBatchStats(taskId: MassApi.WxMassTask['id']) {
  return requestClient.get<MassApi.WxMassTaskBatchStatResp>(
    `/scrm/mass/statistic/task/${taskId}`,
  );
}
