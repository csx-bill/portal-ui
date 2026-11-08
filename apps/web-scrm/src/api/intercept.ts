import { requestClient } from '#/api/request';

export namespace InterceptRuleApi {
  /** 敏感词规则（字段与后端 WxInterceptRuleVo 一致；列表项仅含 ruleId/ruleName/createTime） */
  export interface WxInterceptRule {
    /** 创建时间（yyyy-MM-dd HH:mm:ss） */
    createTime?: string;
    /** 拦截动作：1=警告并拦截发送, 2=仅发警告 */
    interceptType?: number;
    /** 规则名称（1~20个utf8字符） */
    ruleName?: string;
    /** 规则ID（企微侧标识） */
    ruleId: string;
    /** 语义规则：1=手机号, 2=邮箱地址, 3=红包 */
    semanticsList?: number[];
    /** 适用范围-部门ID列表（详情仅返回应用可见范围内的节点） */
    departmentList?: number[];
    /** 适用范围-成员ID列表 */
    userList?: string[];
    /** 敏感词列表（每个1~32个utf8字符，最多300个） */
    wordList?: string[];
    [key: string]: any;
  }

  /** 新建/修改参数（后端 WxInterceptRuleSaveReq，ruleId 为空新建、非空修改） */
  export interface SaveParams {
    corpId: string;
    departmentList?: number[];
    /** 拦截动作：1=警告并拦截发送, 2=仅发警告 */
    interceptType: number;
    /** 规则名称 */
    ruleName: string;
    /** 规则ID（修改时必填） */
    ruleId?: string;
    /** 语义规则（修改时传空数组=清除全部语义规则） */
    semanticsList?: number[];
    userList?: string[];
    /** 敏感词（修改时为空表示不调整） */
    wordList?: string[];
  }
}

/**
 * 敏感词规则列表（后端 WxInterceptRuleController /scrm/intercept/rule/list，
 * 企微全量规则轻量摘要，完整配置见 getInterceptRule）
 */
export function getInterceptRuleList(corpId: string) {
  return requestClient.get<InterceptRuleApi.WxInterceptRule[]>(
    '/scrm/intercept/rule/list',
    { params: { corpId } },
  );
}

/**
 * 敏感词规则详情（含敏感词、语义规则、适用范围）
 */
export function getInterceptRule(corpId: string, ruleId: string) {
  return requestClient.get<InterceptRuleApi.WxInterceptRule>(
    `/scrm/intercept/rule/${ruleId}`,
    { params: { corpId } },
  );
}

/**
 * 新建敏感词规则（返回企微侧规则ID）
 */
export function createInterceptRule(params: InterceptRuleApi.SaveParams) {
  return requestClient.post<string>('/scrm/intercept/rule', params);
}

/**
 * 修改敏感词规则（敏感词整组覆盖；语义规则空数组=清除；
 * 适用范围服务端按详情做差量增删）
 */
export function updateInterceptRule(params: InterceptRuleApi.SaveParams) {
  return requestClient.put<boolean>('/scrm/intercept/rule', params);
}

/**
 * 删除敏感词规则（仅可删除本应用创建的规则）
 */
export function deleteInterceptRule(corpId: string, ruleId: string) {
  return requestClient.delete<boolean>(`/scrm/intercept/rule/${ruleId}`, {
    params: { corpId },
  });
}
