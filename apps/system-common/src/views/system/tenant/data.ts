import type { VbenFormSchema } from '@vben/common-ui';
import type { VxeTableGridColumns } from '@vben/plugins/vxe-table';

import type { TenantRecord } from '#/api/system/tenant';

import { z } from '@vben/common-ui';
import { $t } from '@vben/locales';

/**
 * 租户状态选项（0=禁用, 1=启用，对齐后端 SysTenant.status）
 */
export function getStatusOptions() {
  return [
    { label: $t('systemCommon.system.tenant.enabled'), value: 1 },
    { label: $t('systemCommon.system.tenant.disabled'), value: 0 },
  ];
}

/**
 * 新增/编辑抽屉的表单 schema。
 * 字段对齐后端 SysTenantCreateReq / SysTenantUpdateReq（name / code / status / remark）
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('systemCommon.system.tenant.codePlaceholder'),
      },
      fieldName: 'code',
      label: $t('systemCommon.system.tenant.code'),
      rules: z
        .string()
        .min(
          2,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.tenant.code'),
            2,
          ]),
        )
        .max(
          50,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.tenant.code'),
            50,
          ]),
        ),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('systemCommon.system.tenant.namePlaceholder'),
      },
      fieldName: 'name',
      label: $t('systemCommon.system.tenant.tenantName'),
      rules: z
        .string()
        .min(
          2,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.tenant.tenantName'),
            2,
          ]),
        )
        .max(
          50,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.tenant.tenantName'),
            50,
          ]),
        ),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: getStatusOptions(),
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('systemCommon.system.tenant.status'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('systemCommon.system.tenant.remarkPlaceholder'),
        rows: 3,
      },
      fieldName: 'remark',
      label: $t('systemCommon.system.tenant.remark'),
      rules: z
        .string()
        .max(
          255,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.tenant.remark'),
            255,
          ]),
        )
        .nullish(),
    },
  ];
}

/**
 * 表格上方搜索表单的 schema（后端 SysTenantQuery 仅支持 name 模糊 / status 过滤）
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('systemCommon.system.tenant.tenantName'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: getStatusOptions(),
      },
      fieldName: 'status',
      label: $t('systemCommon.system.tenant.status'),
    },
  ];
}

/**
 * 表格列定义。状态 / 操作列使用插槽渲染：宿主的 vxe-table 适配器
 * 未注册 CellSwitch / CellOperation 渲染器（与 role、menu 页做法一致）
 */
export function useColumns(): VxeTableGridColumns<TenantRecord> {
  return [
    { align: 'center', title: '', type: 'checkbox', width: 50 },
    {
      align: 'center',
      title: $t('systemCommon.system.tenant.seq'),
      type: 'seq',
      width: 60,
    },
    {
      field: 'code',
      minWidth: 160,
      title: $t('systemCommon.system.tenant.code'),
    },
    {
      field: 'name',
      minWidth: 160,
      title: $t('systemCommon.system.tenant.tenantName'),
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('systemCommon.system.tenant.status'),
      width: 100,
    },
    {
      field: 'remark',
      minWidth: 160,
      title: $t('systemCommon.system.tenant.remark'),
    },
    {
      field: 'createTime',
      title: $t('systemCommon.system.tenant.createTime'),
      width: 180,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('systemCommon.system.tenant.action'),
      width: 130,
    },
  ];
}
