import { getRequestClient } from '#/shared/request-context';

/** 系统部门（字段与后端 SysDept 实体一致） */
export interface SystemDept {
  id: number | string;
  /** 部门名称 */
  name?: string;
  /** 上级部门 ID（空为根部门） */
  parentId?: null | number | string;
  /** 排序 */
  sortOrder?: number;
  /** 子部门（树接口组装） */
  children?: SystemDept[];
  [key: string]: any;
}

/** 部门新增/更新提交参数 */
export type SystemDeptSaveParams = Pick<
  SystemDept,
  'name' | 'parentId' | 'sortOrder'
> & {
  id?: SystemDept['id'];
};

/**
 * 部门树（当前租户全量）
 */
export function getDeptTree() {
  return getRequestClient().get<SystemDept[]>('/system/dept/tree');
}

/**
 * 新增部门
 */
export function createDept(data: Omit<SystemDeptSaveParams, 'id'>) {
  return getRequestClient().post<boolean>('/system/dept', data);
}

/**
 * 更新部门（后端 PUT /system/dept，id 放在请求体）
 */
export function updateDept(data: SystemDeptSaveParams) {
  return getRequestClient().put<boolean>('/system/dept', data);
}

/**
 * 删除部门（存在子部门时后端拒绝）
 */
export function deleteDept(id: SystemDept['id']) {
  return getRequestClient().delete<boolean>(`/system/dept/${id}`);
}
