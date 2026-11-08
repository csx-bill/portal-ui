import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { MassApi } from '#/api';

import { $t } from '#/locales';

/**
 * 表格上方搜索表单（后端 WxMassTaskQuery 支持 corpId/chatType/status 精确 /
 * taskName 模糊 / sender 精确；企业与发送成员过滤来自左侧通讯录面板，
 * 此处保留任务名称搜索与任务状态筛选）
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('mass.taskNamePlaceholder'),
      },
      fieldName: 'taskName',
      label: $t('mass.taskName'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('mass.statusDisabled'), value: 0 },
          { label: $t('mass.statusEnabled'), value: 1 },
          { label: $t('mass.statusRunning'), value: 2 },
          { label: $t('mass.statusDone'), value: 3 },
        ],
        placeholder: $t('mass.status'),
      },
      fieldName: 'status',
      label: $t('mass.status'),
    },
  ];
}

/**
 * 表格列定义。报表列（应发送/已送达/送达率/失败）来自
 * /scrm/mass/statistic/taskList 聚合（该任务全部批次合计），
 * 行数据在查询时挂载 _stat 字段，插槽据此渲染；未执行任务显示 "-"
 */
export function useColumns(): VxeTableGridColumns<MassApi.WxMassTask> {
  return [
    { align: 'center', title: $t('mass.seq'), type: 'seq', width: 55 },
    {
      field: 'taskName',
      minWidth: 160,
      showOverflow: false,
      slots: { default: 'taskName' },
      title: $t('mass.taskName'),
    },
    {
      field: 'chatType',
      slots: { default: 'chatType' },
      title: $t('mass.chatType'),
      width: 95,
    },
    {
      field: 'executeType',
      slots: { default: 'executeType' },
      title: $t('mass.executeType'),
      width: 100,
    },
    {
      field: 'scheduledTime',
      title: $t('mass.scheduledTime'),
      width: 165,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('mass.status'),
      width: 85,
    },
    {
      align: 'right',
      field: 'statTotal',
      slots: { default: 'statTotal' },
      title: $t('mass.statTotal'),
      width: 85,
    },
    {
      align: 'right',
      field: 'statDelivered',
      slots: { default: 'statDelivered' },
      title: $t('mass.statDelivered'),
      width: 85,
    },
    {
      field: 'deliveryRate',
      slots: { default: 'deliveryRate' },
      title: $t('mass.deliveryRate'),
      width: 130,
    },
    {
      align: 'right',
      field: 'statFail',
      slots: { default: 'statFail' },
      title: $t('mass.statFail'),
      width: 80,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('mass.action'),
      width: 200,
    },
  ];
}

/** 失败数 = 客户非好友 + 已收到其他群发（未发送不计入失败） */
export function failOf(stat?: MassApi.WxMassTaskStat) {
  if (!stat) return undefined;
  return (stat.failFriendCnt ?? 0) + (stat.failOtherCnt ?? 0);
}

/** 送达率 = 已送达 / 应发送（%），无发送记录时为 undefined */
export function rateOf(stat?: MassApi.WxMassTaskStat) {
  if (!stat || !stat.totalCnt) return undefined;
  return ((stat.deliveredCnt ?? 0) / stat.totalCnt) * 100;
}
