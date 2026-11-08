import { requestClient } from '#/api/request';

export namespace WelcomeApi {
  /** 欢迎语内容项（wx_welcome_msg_rule.content JSON 数组元素） */
  export interface WelcomeContentItem {
    filename?: string;
    linkDesc?: string;
    linkTitle?: string;
    linkUrl?: string;
    /** 小程序appid（miniprogram 使用，须为关联到企业的小程序应用） */
    mpAppid?: string;
    /** 小程序页面路径 */
    mpPage?: string;
    /** 小程序标题（miniprogram 使用，最长 64 字节） */
    mpTitle?: string;
    /** 消息类型：text-文本，image-图片，video-视频，file-文件，link-链接，miniprogram-小程序 */
    msgType: string;
    textContent?: string;
    url?: string;
    [key: string]: any;
  }

  /** 分时规则（欢迎语即规则列表：内容 + 生效时间，全天生效兜底存为 [1..7] 00:00~23:59:59；sort 为匹配顺序） */
  export interface WelcomeTimeItem {
    content: WelcomeContentItem[];
    effectiveAt?: number[];
    endTime?: string;
    id?: number | string;
    name?: string;
    sort?: number;
    startTime?: string;
    [key: string]: any;
  }

  /** 绑定项（targetType：1=员工 2=部门；targetId 为 wx_user.id / wx_department.id） */
  export interface WelcomeBindItem {
    targetId: number | string;
    targetName?: string;
    targetType: number;
    [key: string]: any;
  }

  /** 企微欢迎语记录（字段与后端 WxWelcomeMsg 实体一致，主行为容器） */
  export interface WxWelcomeMsg {
    /** 绑定数量（列表回填） */
    bindCount?: number;
    /** 绑定范围对象名称列表（列表回填） */
    bindNames?: string[];
    corpId?: string;
    createTime?: string;
    id: number | string;
    /** 欢迎语标题 */
    name?: string;
    /** 规则数量（列表回填） */
    ruleCount?: number;
    [key: string]: any;
  }

  /** 欢迎语详情（GET /{id} 返回：容器信息 + 分时规则 + 绑定） */
  export interface WxWelcomeMsgResp extends WxWelcomeMsg {
    binds?: WelcomeBindItem[];
    timeItems?: WelcomeTimeItem[];
    [key: string]: any;
  }

  /** 保存参数（POST /scrm/welcome：id 为空新增，否则更新；规则整组替换） */
  export interface WxWelcomeMsgSaveReq {
    binds?: WelcomeBindItem[];
    corpId?: string;
    /** 绑定冲突时是否强制改指向（默认 false：报错并提示归属） */
    forceBind?: boolean;
    id?: number | string;
    name?: string;
    timeItems?: WelcomeTimeItem[];
    [key: string]: any;
  }

  /** 分页查询参数（仅返回主欢迎语） */
  export interface PageParams {
    corpId?: string;
    current?: number;
    /** 绑定部门ID（通讯录树过滤用，匹配绑定表 target_type=DEPT） */
    deptId?: number;
    name?: string;
    /** 绑定成员的企微userid（通讯录树过滤用，匹配绑定表 target_type=USER） */
    sender?: string;
    size?: number;
  }

  /** 分页返回（后端 IPage 结构） */
  export interface PageResult<T = WxWelcomeMsg> {
    current: number;
    pages: number;
    records: T[];
    size: number;
    total: number;
  }
}

/**
 * 欢迎语分页列表（后端 WxWelcomeMsgController /scrm/welcome/page，
 * 仅主欢迎语；过滤：corpId 精确、name 模糊）
 */
export function getWelcomeMsgPage(params: WelcomeApi.PageParams) {
  return requestClient.get<WelcomeApi.PageResult>('/scrm/welcome/page', {
    params,
  });
}

/** 欢迎语详情（含分时子项与绑定列表，绑定含 targetName） */
export function getWelcomeMsgById(id: WelcomeApi.WxWelcomeMsg['id']) {
  return requestClient.get<WelcomeApi.WxWelcomeMsgResp>(`/scrm/welcome/${id}`);
}

/** 保存欢迎语（id 为空新增，否则更新；分时子项与绑定整组替换） */
export function saveWelcomeMsg(data: WelcomeApi.WxWelcomeMsgSaveReq) {
  return requestClient.post<boolean>('/scrm/welcome', data);
}

/**
 * 绑定冲突预检（后端 /scrm/welcome/bindConflicts）：返回与库中已有绑定
 * 时间重叠的冲突描述列表（成员/部门「名称」已绑定欢迎语「标题」），
 * 空列表 = 无冲突。预检走正常请求，不触发错误 toast。
 */
export function checkWelcomeBindConflicts(
  data: WelcomeApi.WxWelcomeMsgSaveReq,
) {
  return requestClient.post<string[]>('/scrm/welcome/bindConflicts', data);
}

/** 批量删除欢迎语（连同分时子项与绑定） */
export function delWelcomeMsgs(ids: string) {
  return requestClient.delete<boolean>('/scrm/welcome', {
    params: { ids },
  });
}
