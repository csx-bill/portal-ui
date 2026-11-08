import { requestClient } from '#/api/request';

export namespace CorpApi {
  /** 企微企业授权记录（字段与后端 WxCorpAuth 实体一致） */
  export interface WxCorpAuth {
    [key: string]: any;
    /** 企业应用id */
    agentId?: number | string;
    /** 企业应用名称 */
    agentName?: string;
    /** 应用标识 */
    app?: string;
    /** 授权状态: 0-已取消/过期, 1-正常授权 */
    authStatus?: number;
    /** 企业ID（企微唯一标识） */
    corpId: string;
    /** 企业名称 */
    corpName?: string;
    /** 应用类型: SELF-自建应用, SUITE-代开发 */
    corpType?: string;
    /** 创建时间 */
    createTime?: string;
    /** 主键ID */
    id: number | string;
    /** 企业应用方形头像 */
    squareLogoUrl?: string;
    /** 租户ID */
    tenantId?: number | string;
  }

  /** 列表查询参数（后端 WxCorpAuthQuery 绑定过滤字段） */
  export interface ListParams {
    /** 企业ID（精确匹配） */
    corpId?: string;
    /** 企业名称（模糊匹配） */
    corpName?: string;
  }
}

/**
 * 企微企业授权列表（后端 WxCorpAuthController /scrm/corp/list，不分页）。
 * 过滤条件：corpId 精确 / corpName 模糊，仅非空字段生效
 */
export function getCorpList(params?: CorpApi.ListParams) {
  return requestClient.get<CorpApi.WxCorpAuth[]>('/scrm/corp/list', {
    params,
  });
}
