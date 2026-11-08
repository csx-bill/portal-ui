import { requestClient } from '#/api/request';

export namespace SystemDictApi {
  /** 系统字典项（字段与后端 SysDictItem 实体一致） */
  export interface SystemDictItem {
    clientId?: string;
    /** 所属字典 ID */
    dictId: number | string;
    /** 字典类型标识（冗余） */
    dictType?: string;
    id: number | string;
    /** 字典项标签 */
    label: string;
    sortOrder?: number;
    /** 字典项值 */
    itemValue: string;
    [key: string]: any;
  }

  /** 下拉选项（label/value 形式，value 取字典项 itemValue） */
  export interface DictOption {
    label: string;
    value: string;
  }
}

/**
 * 按字典类型取全部字典项（后端 getDictByType，按请求头里的 client_id 过滤）
 */
export function getDictByType(dictType: string) {
  return requestClient.get<SystemDictApi.SystemDictItem[]>(
    `/system/dict/type/${dictType}`,
  );
}

/**
 * 按字典类型标识取下拉选项（label/value）。
 * 类型不存在时返回空数组。
 */
export async function getDictOptionsByType(
  dictType: string,
): Promise<SystemDictApi.DictOption[]> {
  const items = (await getDictByType(dictType)) ?? [];
  return items.map((item) => ({
    label: item.label,
    value: item.itemValue,
  }));
}
