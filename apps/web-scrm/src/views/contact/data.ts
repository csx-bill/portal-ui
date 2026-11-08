import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { ContactApi } from '#/api';

import { $t } from '#/locales';

/**
 * 成员激活状态选项（对齐后端 WxUser.status）
 */
export function getStatusOptions() {
  return [
    { label: $t('contact.statusActive'), value: 1 },
    { label: $t('contact.statusDisabled'), value: 2 },
    { label: $t('contact.statusInactive'), value: 4 },
    { label: $t('contact.statusQuit'), value: 5 },
  ];
}

/**
 * 表格上方搜索表单（后端 WxUser 过滤对象支持 name 模糊 / status 精确）
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('contact.name'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: getStatusOptions(),
      },
      fieldName: 'status',
      label: $t('contact.status'),
    },
  ];
}

/**
 * 表格列定义。头像 / 性别 / 部门 / 状态列使用插槽渲染：
 * 头像列需处理空值，部门列要把主部门ID转为名称（映射表由页面注入），
 * 状态列展示为 Tag（与租户页做法一致）
 */
export function useColumns(): VxeTableGridColumns<ContactApi.WxUser> {
  return [
    { align: 'center', title: $t('contact.seq'), type: 'seq', width: 60 },
    {
      field: 'avatar',
      slots: { default: 'avatar' },
      title: $t('contact.avatar'),
      width: 70,
    },
    {
      field: 'name',
      minWidth: 120,
      title: $t('contact.name'),
    },
    {
      field: 'gender',
      slots: { default: 'gender' },
      title: $t('contact.gender'),
      width: 80,
    },
    {
      field: 'mobile',
      minWidth: 130,
      title: $t('contact.mobile'),
    },
    {
      field: 'position',
      minWidth: 120,
      title: $t('contact.position'),
    },
    {
      field: 'mainDepartment',
      slots: { default: 'mainDept' },
      title: $t('contact.department'),
      minWidth: 140,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('contact.status'),
      width: 100,
    },
    {
      field: 'createTime',
      title: $t('contact.createTime'),
      width: 170,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('contact.action'),
      width: 150,
    },
  ];
}
