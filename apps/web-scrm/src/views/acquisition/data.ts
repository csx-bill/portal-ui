import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { AcquisitionApi } from '#/api';

import { $t } from '#/locales';

/**
 * 表格上方搜索表单（后端按 corpId 精确 / linkName 模糊过滤；
 * 企业筛选来自页面头部，此处仅保留链接名称搜索）
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('acquisition.linkNamePlaceholder'),
      },
      fieldName: 'linkName',
      label: $t('acquisition.linkName'),
    },
  ];
}

/** 获客链接表格列。URL / 使用范围 / 无需验证 / 操作列使用插槽渲染 */
export function useColumns(): VxeTableGridColumns<AcquisitionApi.WxAcquisitionLink> {
  return [
    { align: 'center', title: $t('acquisition.seq'), type: 'seq', width: 55 },
    {
      field: 'linkName',
      minWidth: 140,
      showOverflow: true,
      title: $t('acquisition.linkName'),
    },
    {
      field: 'url',
      minWidth: 260,
      showOverflow: false,
      slots: { default: 'url' },
      title: $t('acquisition.linkAddress'),
    },
    {
      field: 'rangeUserList',
      slots: { default: 'range' },
      title: $t('acquisition.range'),
      width: 150,
    },
    {
      field: 'skipVerify',
      slots: { default: 'skipVerify' },
      title: $t('acquisition.skipVerify'),
      width: 100,
    },
    {
      field: 'customerChannel',
      slots: { default: 'channel' },
      title: $t('acquisition.customerChannel'),
      width: 110,
    },
    {
      field: 'createTime',
      title: $t('acquisition.createTime'),
      width: 165,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('acquisition.action'),
      width: 170,
    },
  ];
}
