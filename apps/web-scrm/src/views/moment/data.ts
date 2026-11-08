import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { MomentApi } from '#/api';

import { $t } from '#/locales';

/**
 * 发表范围选项（对齐后端 WxMomentTask.visibleType）
 */
export function getVisibleTypeOptions() {
  return [
    { label: $t('moment.visibleAll'), value: 'all' },
    { label: $t('moment.visibleUser'), value: 'user' },
    { label: $t('moment.visibleDepartment'), value: 'department' },
    { label: $t('moment.visibleTag'), value: 'tag' },
  ];
}

/**
 * 任务状态选项（对齐后端 WxMomentTask.status）
 */
export function getStatusOptions() {
  return [
    { label: $t('moment.statusDisabled'), value: 0 },
    { label: $t('moment.statusEnabled'), value: 1 },
    { label: $t('moment.statusRunning'), value: 2 },
    { label: $t('moment.statusDone'), value: 3 },
  ];
}

/**
 * 执行类型文案（对齐 ScheduleType 枚举名）
 */
export function executeTypeText(executeType?: string) {
  switch (executeType) {
    case 'IMMEDIATE': {
      return $t('moment.executeImmediate');
    }
    case 'ONCE': {
      return $t('moment.executeOnce');
    }
    case 'DAILY': {
      return $t('moment.executeDaily');
    }
    case 'WEEKLY': {
      return $t('moment.executeWeekly');
    }
    case 'MONTHLY': {
      return $t('moment.executeMonthly');
    }
    case 'CRON': {
      return $t('moment.executeCron');
    }
    default: {
      return executeType;
    }
  }
}

/**
 * 发表范围文案
 */
export function visibleTypeText(visibleType?: string) {
  const found = getVisibleTypeOptions().find(
    (item) => item.value === visibleType,
  );
  return found?.label ?? visibleType;
}

/**
 * 表格上方搜索表单（后端 WxMomentTaskQueryReq 支持 corpId/visibleType/status
 * 精确、taskName 模糊、sender 精确）。企业与可见成员过滤来自左侧通讯录面板，
 * 此处保留任务名称/发表范围/任务状态筛选
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('moment.taskNamePlaceholder'),
      },
      fieldName: 'taskName',
      label: $t('moment.taskName'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: getVisibleTypeOptions(),
        placeholder: $t('moment.visibleType'),
      },
      fieldName: 'visibleType',
      label: $t('moment.visibleType'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: getStatusOptions(),
        placeholder: $t('moment.status'),
      },
      fieldName: 'status',
      label: $t('moment.status'),
    },
  ];
}

/**
 * 表格列定义。报表列（应发表/已发表/发表率/未发表）来自
 * /scrm/moment/statistic/taskList 聚合（该任务全部批次合计），
 * 行数据在查询时挂载 _stat 字段，插槽据此渲染；未执行任务显示 "-"
 */
export function useColumns(): VxeTableGridColumns<MomentApi.WxMomentTask> {
  return [
    { align: 'center', title: $t('moment.seq'), type: 'seq', width: 55 },
    {
      field: 'taskName',
      minWidth: 160,
      showOverflow: false,
      slots: { default: 'taskName' },
      title: $t('moment.taskName'),
    },
    {
      field: 'visibleType',
      slots: { default: 'visibleType' },
      title: $t('moment.visibleType'),
      width: 110,
    },
    {
      field: 'executeType',
      slots: { default: 'executeType' },
      title: $t('moment.executeType'),
      width: 100,
    },
    {
      field: 'scheduledTime',
      title: $t('moment.scheduledTime'),
      width: 165,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('moment.status'),
      width: 85,
    },
    {
      align: 'right',
      field: 'statTotal',
      slots: { default: 'statTotal' },
      title: $t('moment.statTotal'),
      width: 85,
    },
    {
      align: 'right',
      field: 'statPublished',
      slots: { default: 'statPublished' },
      title: $t('moment.statPublished'),
      width: 85,
    },
    {
      field: 'publishRate',
      slots: { default: 'publishRate' },
      title: $t('moment.publishRate'),
      width: 130,
    },
    {
      align: 'right',
      field: 'statUnpublished',
      slots: { default: 'statUnpublished' },
      title: $t('moment.statUnpublished'),
      width: 85,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('moment.action'),
      width: 210,
    },
  ];
}

/** 发表率 = 已发表 / 应发表（%），无发表记录时为 undefined */
export function publishRateOf(stat?: MomentApi.WxMomentTaskStat) {
  if (!stat || !stat.totalCnt) return undefined;
  return ((stat.publishedCnt ?? 0) / stat.totalCnt) * 100;
}

/**
 * 朋友圈媒体限制（企微文档 96361）：
 * 图片 10MB JPG/PNG（长边≤10800 像素、短边≤1080 像素）；
 * 视频 10MB MP4（时长≤30 秒）；所有文件大于 5 字节。
 * 传给共享 MediaPickerModal 的 mediaLimits。
 */
export const MOMENT_MEDIA_LIMITS = {
  image: { formats: ['jpg', 'jpeg', 'png'], maxBytes: 10 * 1024 * 1024 },
  minBytes: 5,
  video: { formats: ['mp4'], maxBytes: 10 * 1024 * 1024 },
};

/** 朋友圈媒体限制提示文案（按类型） */
export function momentMediaHint(type: 'image' | 'video'): string {
  if (type === 'image') {
    return $t('moment.mediaHintImage');
  }
  return $t('moment.mediaHintVideo');
}
