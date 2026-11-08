import { getRequestClient } from '#/shared/request-context';

/** 系统字典类型（字段与后端 SysDict 实体一致） */
export interface SystemDict {
  /** 字典 ID（后端 Long） */
  id: number | string;
  /** 字典类型标识 */
  dictType: string;
  /** 描述 */
  description?: string;
  /** 备注 */
  remarks?: string;
  /** 是否系统内置: 0=否, 1=是 */
  systemFlag?: string;
  [key: string]: any;
}

/** 系统字典项（字段与后端 SysDictItem 实体一致） */
export interface SystemDictItem {
  /** 字典项 ID（后端 Long） */
  id: number | string;
  /** 所属字典 ID */
  dictId: number | string;
  /** 字典项标签 */
  label: string;
  /** 字典项值 */
  itemValue: string;
  /** 排序 */
  sortOrder?: number;
  /** 描述 */
  description?: string;
  /** 备注 */
  remarks?: string;
  [key: string]: any;
}

/** 字典新增/更新提交参数（更新时必须带 id，后端 PUT 从 body 读取） */
export type SystemDictSaveParams = Omit<SystemDict, 'id'> & {
  id?: SystemDict['id'];
};

/** 字典项新增/更新提交参数 */
export type SystemDictItemSaveParams = Omit<SystemDictItem, 'id'> & {
  id?: SystemDictItem['id'];
};

/**
 * 全量字典类型列表。
 * request 实例由宿主注入（见 src/shared/request-context.ts）。
 */
export function getDictList() {
  return getRequestClient().get<SystemDict[]>('/system/dict/list');
}

/**
 * 字典类型标识是否已存在（编辑时传 excludeId 排除自身）
 */
export function isDictTypeExists(
  dictType: string,
  excludeId?: SystemDict['id'],
) {
  return getRequestClient().get<boolean>('/system/dict/exists/type', {
    params: { excludeId, type: dictType },
  });
}

/**
 * 新增字典类型
 */
export function createDict(data: Omit<SystemDictSaveParams, 'id'>) {
  return getRequestClient().post<boolean>('/system/dict', data);
}

/**
 * 更新字典类型（后端 PUT /system/dict，id 放在请求体）
 */
export function updateDict(data: SystemDictSaveParams) {
  return getRequestClient().put<boolean>('/system/dict', data);
}

/**
 * 删除字典类型（后端连带删除其全部字典项；系统内置字典拒绝删除）
 */
export function deleteDict(id: SystemDict['id']) {
  return getRequestClient().delete<boolean>(`/system/dict/${id}`);
}

/**
 * 指定字典下的全部字典项（按 sortOrder 排序）
 */
export function getDictItemList(dictId: SystemDict['id']) {
  return getRequestClient().get<SystemDictItem[]>('/system/dict/item/list', {
    params: { dictId },
  });
}

/**
 * 同一字典下字典项值是否已存在
 */
export function isDictItemValueExists(
  dictId: SystemDict['id'],
  itemValue: string,
  excludeId?: SystemDictItem['id'],
) {
  return getRequestClient().get<boolean>('/system/dict/item/exists/value', {
    params: { dictId, excludeId, value: itemValue },
  });
}

/**
 * 新增字典项
 */
export function createDictItem(data: Omit<SystemDictItemSaveParams, 'id'>) {
  return getRequestClient().post<boolean>('/system/dict/item', data);
}

/**
 * 更新字典项（后端 PUT /system/dict/item，id 放在请求体）
 */
export function updateDictItem(data: SystemDictItemSaveParams) {
  return getRequestClient().put<boolean>('/system/dict/item', data);
}

/**
 * 删除字典项
 */
export function deleteDictItem(id: SystemDictItem['id']) {
  return getRequestClient().delete<boolean>(`/system/dict/item/${id}`);
}
