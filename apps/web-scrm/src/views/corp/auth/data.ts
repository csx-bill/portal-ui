import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { CorpApi } from '#/api';

import { $t } from '#/locales';

/**
 * 表格上方搜索表单（后端 WxCorpAuthQuery 支持 corpId 精确 / corpName 模糊）
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('corp.corpIdPlaceholder'),
      },
      fieldName: 'corpId',
      label: $t('corp.corpId'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('corp.corpNamePlaceholder'),
      },
      fieldName: 'corpName',
      label: $t('corp.corpName'),
    },
  ];
}

/**
 * 表格列定义。头像 / 应用类型 / 授权状态列使用插槽渲染：
 * 头像列需处理空值，类型与状态列展示为 Tag（宿主 vxe-table 适配器
 * 未注册 CellSwitch / CellTag 等渲染器，与租户页做法一致）
 */
export function useColumns(): VxeTableGridColumns<CorpApi.WxCorpAuth> {
  return [
    { align: 'center', title: $t('corp.seq'), type: 'seq', width: 60 },
    {
      field: 'squareLogoUrl',
      slots: { default: 'logo' },
      title: $t('corp.logo'),
      width: 80,
    },
    {
      field: 'corpName',
      minWidth: 160,
      title: $t('corp.corpName'),
    },
    {
      field: 'corpId',
      minWidth: 180,
      title: $t('corp.corpId'),
    },
    {
      field: 'corpType',
      slots: { default: 'corpType' },
      title: $t('corp.corpType'),
      width: 100,
    },
    {
      field: 'agentName',
      minWidth: 140,
      title: $t('corp.agentName'),
    },
    {
      field: 'agentId',
      title: $t('corp.agentId'),
      width: 120,
    },
    {
      field: 'app',
      minWidth: 100,
      title: $t('corp.app'),
    },
    {
      field: 'authStatus',
      slots: { default: 'authStatus' },
      title: $t('corp.authStatus'),
      width: 110,
    },
    {
      field: 'createTime',
      title: $t('corp.createTime'),
      width: 180,
    },
  ];
}
