import type { VbenFormSchema } from '@vben/common-ui';
import type { VxeTableGridColumns } from '@vben/plugins/vxe-table';

import type { SystemMenu } from '#/api/system/menu';

import { $t } from '@vben/locales';

/**
 * 表格上方搜索表单的 schema（名称过滤在前端完成，见 index.vue）。
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('systemCommon.system.menu.nameSearch'),
      },
      fieldName: 'name',
      label: $t('systemCommon.system.menu.menuName'),
    },
  ];
}

/**
 * 菜单类型选项（Tag 颜色 + 文案）。
 * 宿主的 vxe-table 适配器未注册 CellTag 渲染器，
 * 类型列通过插槽渲染（见 index.vue 的 #menuType 模板）。
 */
export function getMenuTypeOptions() {
  return [
    {
      color: 'processing',
      label: $t('systemCommon.system.menu.typeCatalog'),
      value: 'catalog',
    },
    {
      color: 'default',
      label: $t('systemCommon.system.menu.typeMenu'),
      value: 'menu',
    },
    {
      color: 'error',
      label: $t('systemCommon.system.menu.typeButton'),
      value: 'button',
    },
    {
      color: 'success',
      label: $t('systemCommon.system.menu.typeEmbedded'),
      value: 'embedded',
    },
    {
      color: 'warning',
      label: $t('systemCommon.system.menu.typeLink'),
      value: 'link',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<SystemMenu> {
  return [
    {
      align: 'left',
      field: 'meta.title',
      fixed: 'left',
      minWidth: 250,
      slots: { default: 'title' },
      title: $t('systemCommon.system.menu.menuTitle'),
      treeNode: true,
    },
    {
      align: 'center',
      field: 'menuType',
      slots: { default: 'menuType' },
      title: $t('systemCommon.system.menu.type'),
      width: 100,
    },
    {
      field: 'authCode',
      title: $t('systemCommon.system.menu.authCode'),
      width: 200,
    },
    {
      align: 'left',
      field: 'path',
      title: $t('systemCommon.system.menu.path'),
      width: 200,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('systemCommon.system.menu.status'),
      width: 100,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('systemCommon.system.menu.operation'),
      width: 220,
    },
  ];
}
