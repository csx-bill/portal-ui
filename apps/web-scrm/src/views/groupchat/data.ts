import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { GroupChatApi } from '#/api';

import { $t } from '#/locales';

/** 企业下拉选项（授权企业列表映射） */
export interface CorpOption {
  label: string;
  value: string;
}

/**
 * 客户群跟进状态选项（对齐后端 WxGroupChat.status）
 */
export function getStatusOptions() {
  return [
    { label: $t('groupchat.statusNormal'), value: 0 },
    { label: $t('groupchat.statusResigned'), value: 1 },
    { label: $t('groupchat.statusInheriting'), value: 2 },
    { label: $t('groupchat.statusInherited'), value: 3 },
  ];
}

/**
 * 表格上方搜索表单（后端 WxGroupChatQuery 支持 corpId/owner 精确 / chatName 模糊；
 * 企业与群主过滤来自左侧通讯录面板，此处仅保留群名称搜索）
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('groupchat.chatNamePlaceholder'),
      },
      fieldName: 'chatName',
      label: $t('groupchat.chatName'),
    },
  ];
}

/**
 * 表格列定义。状态列使用插槽渲染为 Tag
 */
export function useColumns(): VxeTableGridColumns<GroupChatApi.WxGroupChat> {
  return [
    { align: 'center', title: $t('groupchat.seq'), type: 'seq', width: 60 },
    {
      field: 'chatName',
      minWidth: 160,
      title: $t('groupchat.chatName'),
    },
    {
      field: 'owner',
      minWidth: 120,
      slots: { default: 'owner' },
      title: $t('groupchat.owner'),
    },
    {
      field: 'memberNum',
      title: $t('groupchat.memberNum'),
      width: 100,
    },
    {
      field: 'statToday',
      slots: { default: 'statToday' },
      title: $t('groupchat.statTodayCol'),
      width: 120,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('groupchat.status'),
      width: 120,
    },
    {
      field: 'adminList',
      slots: { default: 'adminList' },
      title: $t('groupchat.adminList'),
      minWidth: 140,
    },
    {
      field: 'groupCreateTime',
      title: $t('groupchat.groupCreateTime'),
      width: 170,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('groupchat.operation'),
      width: 90,
    },
  ];
}
