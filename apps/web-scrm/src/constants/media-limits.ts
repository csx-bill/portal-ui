/**
 * 企微媒体文件限制（上传的媒体文件须大于5字节；
 * 图片10MB JPG/PNG；视频10MB MP4；文件20MB）。
 * 传给共享 MediaPickerModal 的 mediaLimits，用于上传/选择校验。
 */
export interface WecomMediaLimitRule {
  /** 允许的文件扩展名（小写） */
  formats?: string[];
  /** 最大字节数 */
  maxBytes: number;
}

export interface WecomMediaLimits {
  file?: WecomMediaLimitRule;
  image?: WecomMediaLimitRule;
  /** 所有文件最小字节数 */
  minBytes?: number;
  video?: WecomMediaLimitRule;
}

export const WECOM_MEDIA_LIMITS: WecomMediaLimits = {
  file: { maxBytes: 20 * 1024 * 1024 },
  image: { formats: ['jpg', 'jpeg', 'png'], maxBytes: 10 * 1024 * 1024 },
  minBytes: 5,
  video: { formats: ['mp4'], maxBytes: 10 * 1024 * 1024 },
};
