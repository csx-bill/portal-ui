import type { VbenFormSchema } from '@vben/common-ui';
import type { VxeTableGridColumns } from '@vben/plugins/vxe-table';

import type { SystemI18n } from '#/api/system/i18n';

import { z } from '@vben/common-ui';
import { $t } from '@vben/locales';

/**
 * 编辑抽屉的表单 schema（键名 + 中英文案）。
 * 字段长度上限对齐数据库列：sys_i18n.name varchar(50)、zh/en varchar(255)
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('systemCommon.system.i18n.key'),
      rules: z
        .string()
        .min(
          2,
          $t('ui.formRules.minLength', [$t('systemCommon.system.i18n.key'), 2]),
        )
        .max(
          50,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.i18n.key'),
            50,
          ]),
        ),
    },
    {
      component: 'Textarea',
      componentProps: {
        rows: 2,
      },
      fieldName: 'zh',
      label: $t('systemCommon.system.i18n.zh'),
      rules: z
        .string()
        .max(
          255,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.i18n.zh'),
            255,
          ]),
        )
        .nullish(),
    },
    {
      component: 'Textarea',
      componentProps: {
        rows: 2,
      },
      fieldName: 'en',
      label: $t('systemCommon.system.i18n.en'),
      rules: z
        .string()
        .max(
          255,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.i18n.en'),
            255,
          ]),
        )
        .nullish(),
    },
  ];
}

/**
 * 表格上方搜索表单的 schema（后端仅支持 name 模糊过滤）
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('systemCommon.system.i18n.key'),
    },
  ];
}

/**
 * 表格列定义。操作列用插槽渲染（宿主的 vxe-table 适配器
 * 未注册 CellOperation 渲染器，与 menu / role 页面做法一致）
 */
export function useColumns(): VxeTableGridColumns<SystemI18n> {
  return [
    {
      align: 'center',
      title: $t('systemCommon.system.i18n.seq'),
      type: 'seq',
      width: 55,
    },
    {
      field: 'name',
      title: $t('systemCommon.system.i18n.key'),
      width: 280,
    },
    {
      field: 'zh',
      minWidth: 200,
      title: $t('systemCommon.system.i18n.zh'),
    },
    {
      field: 'en',
      minWidth: 200,
      title: $t('systemCommon.system.i18n.en'),
    },
    {
      field: 'createTime',
      title: $t('systemCommon.system.i18n.createTime'),
      width: 200,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('systemCommon.system.i18n.action'),
      width: 130,
    },
  ];
}
