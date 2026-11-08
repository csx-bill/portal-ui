/**
 * 文件上传约束（前端配置）。
 *
 * 这里是上传限制的唯一来源（弹窗的 accept 过滤、拖拽/选择预校验、
 * 提示文案都用它）：
 * - 大小：不限制（后端 spring.servlet.multipart.max-file-size=-1），
 *   仅受磁盘空间约束；
 * - 扩展名白名单：后端不做扩展名校验（FileProperties 只有存储相关配置），
 *   这里是纯前端限制，调整它只影响本页可选的格式范围。
 */

/** 各分类（对应页面标签页）允许的扩展名 */
export const UPLOAD_ALLOWED_EXTENSIONS: Record<
  'file' | 'image' | 'video',
  string[]
> = {
  // 图片
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'],
  // 视频
  video: ['mp4', 'webm', 'mov', 'avi'],
  // 文件（非图片、非视频）
  file: [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'txt',
    'csv',
    'zip',
    'rar',
    '7z',
  ],
};
