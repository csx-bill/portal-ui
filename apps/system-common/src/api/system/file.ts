import { getRequestClient } from '#/shared/request-context';

/** 系统文件分组（字段与后端 SysFileGroup 实体一致） */
export interface SystemFileGroup {
  /** 分组 ID（后端 Long） */
  id: number | string;
  /** 分组名称 */
  name: string;
  /** 上级分组 ID */
  parentId?: number | string;
  /** 子分组 */
  children?: SystemFileGroup[];
  [key: string]: any;
}

/** 系统文件元数据（字段与后端 SysFile 实体一致） */
export interface SystemFile {
  /** 文件 ID（后端 Long） */
  id: number | string;
  /** 所属分组 ID */
  groupId?: number | string;
  /** 文件名（存储侧） */
  fileName: string;
  /** 存储桶名 */
  bucketName?: string;
  /** 存储目录 */
  dir?: string;
  /** 原始文件名 */
  original?: string;
  /** 文件类型 */
  type?: string;
  /** 文件大小（字节） */
  fileSize?: number;
  /**
   * 文件访问地址，由后端在上传时落库下发：本地存储为
   * /{bucket}/{clientId}/{dir}/{fileName}（生产由 nginx 直服），
   * 对象存储为对外域名地址。前端用它读取/下载资源，不经应用转发。
   * 早期数据可能为空，此时无法直连访问。
   */
  url?: null | string;
  [key: string]: any;
}

/** 分组新增/更新提交参数（更新时必须带 id，后端 PUT 从 body 读取） */
export type SystemFileGroupSaveParams = Omit<
  SystemFileGroup,
  'children' | 'id'
> & {
  id?: SystemFileGroup['id'];
};

/** 文件新增/更新提交参数 */
export type SystemFileSaveParams = Omit<SystemFile, 'id'> & {
  id?: SystemFile['id'];
};

/**
 * 文件上传结果（后端 SysFileUploadDTO）。
 * 元数据由后端在上传时一并写入，这里只回传存储侧文件名与访问地址。
 */
export interface SystemFileUploadResult {
  /** 文件名（存储侧，形如 uuid.ext） */
  fileName: string;
  /** 文件访问地址 */
  url?: null | string;
}

/** 上传参数（对应后端 upload 的可选参数） */
export interface FileUploadParams {
  /** 存储目录，为空时落在客户端根目录下 */
  dir?: string;
  /** 所属分组，为空表示未分组 */
  groupId?: SystemFile['groupId'];
  /** 文件类型；后端当前以文件 Content-Type 为准，未使用该参数 */
  type?: string;
}

/** 文件分页查询参数（后端 Page 对象绑定 current/size） */
export interface FilePageParams {
  current?: number;
  fileName?: string;
  groupId?: number | string;
  size?: number;
  /** 类型分类: image=图片, video=视频, file=其他 */
  typeCategory?: 'file' | 'image' | 'video';
  /** 仅查询未分组文件 */
  ungrouped?: boolean;
}

/** 文件分页返回（后端 IPage 结构） */
export interface FilePageResult {
  current: number;
  pages: number;
  records: SystemFile[];
  size: number;
  total: number;
}

/**
 * 分组树。
 * request 实例由宿主注入（见 src/shared/request-context.ts）。
 */
export function getFileGroupTree() {
  return getRequestClient().get<SystemFileGroup[]>('/system/file/group/tree');
}

/**
 * 新增分组
 */
export function createFileGroup(data: Omit<SystemFileGroupSaveParams, 'id'>) {
  return getRequestClient().post<boolean>('/system/file/group', data);
}

/**
 * 更新分组（后端 PUT /system/file/group，id 放在请求体）
 */
export function updateFileGroup(data: SystemFileGroupSaveParams) {
  return getRequestClient().put<boolean>('/system/file/group', data);
}

/**
 * 删除分组（存在子分组或文件时后端拒绝删除）
 */
export function deleteFileGroup(id: SystemFileGroup['id']) {
  return getRequestClient().delete<boolean>(`/system/file/group/${id}`);
}

/**
 * 文件分页列表（可选分组/文件名过滤）
 */
export function getFilePage(params: FilePageParams) {
  return getRequestClient().get<FilePageResult>('/system/file/page', {
    params,
  });
}

/**
 * 新增文件元数据
 */
export function createFile(data: Omit<SystemFileSaveParams, 'id'>) {
  return getRequestClient().post<boolean>('/system/file', data);
}

/**
 * 更新文件元数据（后端 PUT /system/file，id 放在请求体）
 */
export function updateFile(data: SystemFileSaveParams) {
  return getRequestClient().put<boolean>('/system/file', data);
}

/**
 * 删除文件元数据
 */
export function deleteFile(id: SystemFile['id']) {
  return getRequestClient().delete<boolean>(`/system/file/${id}`);
}

/**
 * 上传文件（multipart）。
 * 后端落盘并写入元数据后，返回存储侧文件名与直连访问地址；
 * 之后的读取/下载都用该地址，不再经应用转发。
 */
export function uploadFile(file: File, params: FileUploadParams = {}) {
  const { dir, groupId, type } = params;
  const formData = new FormData();
  formData.append('file', file);
  if (groupId !== undefined && groupId !== null && groupId !== '') {
    formData.append('groupId', String(groupId));
  }
  if (dir) formData.append('dir', dir);
  if (type) formData.append('type', type);
  return getRequestClient().post<SystemFileUploadResult>(
    '/system/file/upload',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
}

/**
 * 下载文件：用元数据里的直连地址触发浏览器下载。
 *
 * 同源（本地存储 /{bucket}/...）时 download 属性生效；对象存储域名等
 * 跨域场景下 download 会被忽略，改为新窗口打开由浏览器自行处理。
 * 没有地址（早期数据）时无法下载，返回 false 交由调用方提示。
 */
export function downloadFile(file: SystemFile): boolean {
  if (!file.url) return false;
  const anchor = document.createElement('a');
  anchor.href = file.url;
  anchor.download = file.original ?? file.fileName;
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  return true;
}

/**
 * 批量删除文件（含物理文件）
 */
export function deleteFiles(ids: Array<SystemFile['id']>) {
  return getRequestClient().delete<boolean>('/system/file', {
    data: { ids },
  });
}

/**
 * 批量移动文件到指定分组（groupId 为空表示移到未分组）
 */
export function moveFiles(
  ids: Array<SystemFile['id']>,
  groupId?: SystemFile['groupId'],
) {
  return getRequestClient().post<boolean>('/system/file/move', {
    groupId: groupId ?? null,
    ids,
  });
}
