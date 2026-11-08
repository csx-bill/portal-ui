import { requestClient } from '#/api/request';

export namespace CorpTagApi {
  /** 企微客户标签（字段与后端 WxCorpTag 实体一致） */
  export interface WxCorpTag {
    corpId?: string;
    createTime?: string;
    /** 标签组id（企微侧标识） */
    groupId?: string;
    id: number | string;
    /** 标签次序值，order 值大的排序靠前 */
    order?: number;
    /** 标签id（企微侧标识） */
    tagId?: string;
    /** 标签名称 */
    tagName?: string;
    [key: string]: any;
  }

  /** 企微客户标签组（字段与后端 WxCorpTagGroup 实体一致） */
  export interface WxCorpTagGroup {
    corpId?: string;
    createTime?: string;
    /** 标签组id（企微侧标识） */
    groupId?: string;
    /** 标签组名称 */
    groupName?: string;
    id: number | string;
    /** 标签组次序值，order 值大的排序靠前 */
    order?: number;
    /** 组下标签列表（groupList 接口已按 order 排序填充） */
    tagList?: WxCorpTag[];
    [key: string]: any;
  }

  /** 标签组列表查询参数（corpId 精确 / groupName 模糊，仅非空字段生效） */
  export interface GroupListParams {
    corpId?: string;
    groupName?: string;
  }

  /** 标签新增参数（后端 WxTagCreateReq） */
  export interface WxTagCreateReq {
    /** 标签次序值，order 值大的排序靠前 */
    order?: number;
    /** 标签名称 */
    tagName: string;
  }

  /** 标签更新参数（后端 WxTagUpdateReq） */
  export interface WxTagUpdateReq {
    /** 主键ID（带 id 视为已有标签，可改名/排序；不带视为新增） */
    id?: number | string;
    order?: number;
    tagId?: string;
    tagName: string;
  }

  /** 标签组新增参数（后端 WxTagGroupCreateReq，调企微 add_corp_tag 建组并落库） */
  export interface GroupCreateParams {
    corpId: string;
    groupId?: string;
    groupName: string;
    order?: number;
    /** 组下初始标签（企微要求至少一个） */
    tagList?: WxTagCreateReq[];
  }

  /**
   * 标签组更新参数（后端 WxTagGroupUpdateReq）。整组提交、服务端做差量：
   * 组名/排序变更走 edit_corp_tag；tagList 中缺失的已有标签会被删除，
   * 新增的（无 id）走 add_corp_tag，改名的走 edit_corp_tag
   */
  export interface GroupUpdateParams {
    corpId: string;
    groupId?: string;
    groupName: string;
    /** 标签组主键ID */
    id: number | string;
    order?: number;
    tagList?: WxTagUpdateReq[];
  }
}

/**
 * 标签组列表（含组下标签，后端 WxCorpTagController /scrm/tag/groupList）
 */
export function getTagGroupList(params?: CorpTagApi.GroupListParams) {
  return requestClient.get<CorpTagApi.WxCorpTagGroup[]>('/scrm/tag/groupList', {
    params,
  });
}

/**
 * 新增标签组（含初始标签，后端 POST /scrm/tag，同步企微后落库）
 */
export function createTagGroup(params: CorpTagApi.GroupCreateParams) {
  return requestClient.post<string>('/scrm/tag', params);
}

/**
 * 更新标签组（组名/排序 + 组下标签增删改差量，后端 PUT /scrm/tag）
 */
export function updateTagGroup(params: CorpTagApi.GroupUpdateParams) {
  return requestClient.put<boolean>('/scrm/tag', params);
}

/**
 * 删除标签组（后端 DELETE /scrm/tag/group/{id}，同步删除企微侧标签组）
 */
export function delTagGroup(id: CorpTagApi.WxCorpTagGroup['id']) {
  return requestClient.delete<boolean>(`/scrm/tag/group/${id}`);
}

/**
 * 手动触发企业标签全量同步（后端以 corpId 查询参数接收，接口同步执行、耗时较长）
 */
export function triggerTagSync(corpId: string) {
  return requestClient.post<boolean>('/scrm/tag/sync/trigger', null, {
    params: { corpId },
  });
}
