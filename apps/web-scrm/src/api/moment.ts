import { requestClient } from '#/api/request';

export namespace MomentApi {
  /** 企微朋友圈任务记录（字段与后端 WxMomentTask 实体一致） */
  export interface WxMomentTask {
    corpId?: string;
    cronExpression?: string;
    /** 执行类型（ScheduleType 枚举名） */
    executeType?: string;
    id: number | string;
    /** 预计执行时间 */
    scheduledTime?: string;
    /** 任务状态：0-停用，1-启用，2-执行中，3-已完成 */
    status?: number;
    /** 群发任务名称 */
    taskName?: string;
    /** 指定部门ID列表（visibleType=department 时使用） */
    visibleDeptList?: string[];
    /** 指定标签ID列表（visibleType=tag 时使用） */
    visibleTagList?: string[];
    /** 发表范围: all-全部成员 user-指定成员 department-指定部门 tag-指定客户标签 */
    visibleType?: string;
    /** 指定成员ID列表（visibleType=user 时使用） */
    visibleUserList?: string[];
    [key: string]: any;
  }

  /** 朋友圈内容（字段与后端 WxMomentContentSaveReq 一致） */
  export interface WxMomentContent {
    filename?: string;
    linkDesc?: string;
    linkTitle?: string;
    linkUrl?: string;
    /** 消息类型：text-文本，image-图片，video-视频，link-链接 */
    msgType: string;
    /** 附件排序（从小到大，最多9个） */
    sort?: string;
    /** 文本内容（msgType = text 时使用） */
    textContent?: string;
    /** 资源地址 */
    url?: string;
    [key: string]: any;
  }

  /**
   * 朋友圈任务保存参数（POST /scrm/moment 请求体；GET /{id} 编辑详情同构）
   */
  export interface WxMomentTaskSaveReq {
    contentList?: WxMomentContent[];
    corpId?: string;
    cronExpression?: string;
    executeType?: string;
    id?: number | string;
    scheduledTime?: string;
    status?: number;
    taskName?: string;
    visibleDeptList?: string[];
    visibleTagList?: string[];
    visibleType?: string;
    visibleUserList?: string[];
    [key: string]: any;
  }

  /** 企微朋友圈调用记录（字段与后端 WxMomentInvokeLog 实体一致） */
  export interface WxMomentInvokeLog {
    corpId?: string;
    createTime?: string;
    errmsg?: string;
    id: number | string;
    /** 企微异步任务id */
    jobid?: string;
    /** 朋友圈任务id（发表成功后回填） */
    momentId?: string;
    /** 朋友圈任务状态（企微 get_moment_task 返回状态，3 为终态并回填 momentId） */
    momentStatus?: number;
    /** 调用状态：SUCCESS-成功，FAIL-失败 */
    status?: string;
    taskId?: number | string;
    /** 群发任务名称 */
    taskName?: string;
    triggerType?: string;
    /** 发表范围: all/user/department/tag */
    visibleType?: string;
    [key: string]: any;
  }

  /**
   * 任务维度发表统计（全部批次合计，来自 /scrm/moment/statistic/taskList）。
   * 数据源 wx_moment_send_log：任务创建完成后由结果同步落库
   */
  export interface WxMomentTaskStat {
    batchCnt?: number;
    publishedCnt?: number;
    taskId: number | string;
    totalCnt?: number;
    unpublishedCnt?: number;
  }

  /** 单批次（一次调用）发表统计 */
  export interface WxMomentBatchStat {
    invokeId: number | string;
    /** 成员发表明细（单任务统计接口返回） */
    members?: WxMomentUserStat[];
    publishedCnt?: number;
    totalCnt?: number;
    unpublishedCnt?: number;
  }

  /** 成员维度发表统计 */
  export interface WxMomentUserStat {
    invokeId?: number | string;
    publishedCnt?: number;
    totalCnt?: number;
    unpublishedCnt?: number;
    userId: string;
  }

  /** 单任务发表统计（GET /scrm/moment/statistic/task/{taskId} 返回体） */
  export interface WxMomentTaskBatchStatResp {
    batches: WxMomentBatchStat[];
    summary: WxMomentTaskStat;
    taskId: number | string;
  }

  /** 任务分页查询参数（后端 Page 绑定 current/size，WxMomentTaskQueryReq 绑定过滤字段） */
  export interface PageParams {
    corpId?: string;
    current?: number;
    /** 可见部门ID（仅匹配 visible_type=DEPARTMENT 的任务，通讯录树过滤用） */
    deptId?: number;
    /** 可见成员userid（仅匹配 visible_type=USER 的任务，通讯录树过滤用） */
    sender?: string;
    size?: number;
    /** 任务状态：0-停用，1-启用，2-执行中，3-已完成 */
    status?: number;
    /** 任务名称（模糊匹配） */
    taskName?: string;
    /** 发表范围: all/user/department/tag */
    visibleType?: string;
  }

  /** 调用记录分页查询参数 */
  export interface InvokeLogPageParams {
    corpId?: string;
    current?: number;
    size?: number;
    /** 调用状态：SUCCESS-成功，FAIL-失败 */
    status?: string;
    taskId?: number | string;
    taskName?: string;
    /** 发表范围: all/user/department/tag */
    visibleType?: string;
  }

  /** 分页返回（后端 IPage 结构） */
  export interface PageResult<T = WxMomentTask> {
    current: number;
    pages: number;
    records: T[];
    size: number;
    total: number;
  }
}

/**
 * 朋友圈任务分页列表（后端 WxMomentController /scrm/moment/taskPage）。
 * 过滤条件：corpId/visibleType/status 精确、taskName 模糊，仅非空字段生效
 */
export function getMomentTaskPage(params: MomentApi.PageParams) {
  return requestClient.get<MomentApi.PageResult>('/scrm/moment/taskPage', {
    params,
  });
}

/** 朋友圈任务详情（含内容 contentList，编辑回显用） */
export function getMomentTaskById(id: MomentApi.WxMomentTask['id']) {
  return requestClient.get<MomentApi.WxMomentTaskSaveReq>(`/scrm/moment/${id}`);
}

/** 保存朋友圈任务（后端 POST /scrm/moment：id 为空新增，否则更新） */
export function saveMomentTask(data: MomentApi.WxMomentTaskSaveReq) {
  return requestClient.post<boolean>('/scrm/moment', data);
}

/** 批量删除朋友圈任务（后端以逗号分隔的 ids 查询参数接收，同时取消调度） */
export function delMomentTasks(ids: string) {
  return requestClient.delete<boolean>('/scrm/moment', {
    params: { ids },
  });
}

/** 朋友圈调用记录分页列表（后端 /scrm/moment/invokeLogPage） */
export function getMomentInvokeLogPage(params: MomentApi.InvokeLogPageParams) {
  return requestClient.get<MomentApi.PageResult<MomentApi.WxMomentInvokeLog>>(
    '/scrm/moment/invokeLogPage',
    { params },
  );
}

/**
 * 朋友圈调用记录详情（后端 WxMomentInvokeLogResp：status 为调用状态
 * SUCCESS/FAIL，区别于任务状态 0-3；含该次调用的内容快照 contentList）
 */
export function getMomentInvokeLogById(id: MomentApi.WxMomentInvokeLog['id']) {
  return requestClient.get<MomentApi.WxMomentInvokeLog>(
    `/scrm/moment/invokeLog/${id}`,
  );
}

/**
 * 任务维度发表统计（全部批次合计）。
 * 无发表记录的任务不在返回中，调用方按 taskId 自行补零
 */
export function getMomentTaskStats(ids: Array<number | string>) {
  return requestClient.get<MomentApi.WxMomentTaskStat[]>(
    '/scrm/moment/statistic/taskList',
    { params: { ids: ids.join(',') } },
  );
}

/**
 * 单任务发表统计：全部批次合计 + 各批次明细（含成员维度）
 */
export function getMomentTaskBatchStats(taskId: MomentApi.WxMomentTask['id']) {
  return requestClient.get<MomentApi.WxMomentTaskBatchStatResp>(
    `/scrm/moment/statistic/task/${taskId}`,
  );
}

/**
 * 手动同步企微朋友圈任务结果（后端 POST /scrm/moment/syncResult）：
 * 同步近3天内未完成任务的创建状态与逐成员发表结果，
 * 返回处理的批次（调用记录）数量，0 表示数据已是最新
 */
export function syncMomentTaskResult(corpId: string) {
  return requestClient.post<number>('/scrm/moment/syncResult', null, {
    params: { corpId },
  });
}
