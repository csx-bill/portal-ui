import { getRequestClient } from '#/shared/request-context';

/**
 * 国际化词条（字段与后端 SysI18n 实体一致：name=键名, zh=中文, en=英文）
 */
export interface SystemI18n {
  /** 词条 ID（后端 Long） */
  id: number | string;
  /** 词条键名，如 systemCommon.system.i18n.title */
  name: string;
  /** 中文文案 */
  zh?: string;
  /** 英文文案 */
  en?: string;
  [key: string]: any;
}

/** 国际化分页查询参数（后端 Page 对象绑定 current/size） */
export interface I18nPageParams {
  current?: number;
  name?: string;
  size?: number;
}

/** 国际化分页返回（后端 IPage 结构） */
export interface I18nPageResult {
  current: number;
  pages: number;
  records: SystemI18n[];
  size: number;
  total: number;
}

/** 新增/更新词条的提交参数（更新时必须带 id，后端 PUT 从 body 读取） */
export type SystemI18nSaveParams = Omit<SystemI18n, 'id'> & {
  id?: SystemI18n['id'];
};

/**
 * 国际化词条分页列表。
 * request 实例由宿主注入（见 src/shared/request-context.ts），
 * token / baseURL / 拦截器均继承宿主配置。
 */
export function getI18nPage(params: I18nPageParams) {
  return getRequestClient().get<I18nPageResult>('/system/i18n/page', {
    params,
  });
}

/**
 * 新增词条
 */
export function createI18n(data: Omit<SystemI18nSaveParams, 'id'>) {
  return getRequestClient().post<boolean>('/system/i18n', data);
}

/**
 * 更新词条（后端 PUT /system/i18n，id 放在请求体）
 */
export function updateI18n(data: SystemI18nSaveParams) {
  return getRequestClient().put<boolean>('/system/i18n', data);
}

/**
 * 删除词条
 */
export function deleteI18n(id: SystemI18n['id']) {
  return getRequestClient().delete<boolean>(`/system/i18n/${id}`);
}
