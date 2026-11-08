import type { VbenFormSchema } from '@vben/common-ui';
import type { VxeTableGridColumns } from '@vben/plugins/vxe-table';

import type { SystemOauthClient } from '#/api/system/client';

import { z } from '@vben/common-ui';
import { $t } from '@vben/locales';

/**
 * 客户端状态选项（0=禁用, 1=启用，已与全项目语义统一）
 */
export function getStatusOptions() {
  return [
    { label: $t('systemCommon.system.client.enabled'), value: 1 },
    { label: $t('systemCommon.system.client.disabled'), value: 0 },
  ];
}

/**
 * OAuth2 标准授权类型选项（值即后端存储的枚举串，
 * 后端以逗号分隔字符串持久化，表单内为多选数组）
 */
export function getGrantTypeOptions() {
  return [
    'authorization_code',
    'refresh_token',
    'password',
    'client_credentials',
    'implicit',
  ].map((value) => ({ label: value, value }));
}

/**
 * 新增/编辑抽屉的表单 schema。
 * 字段对齐后端 SysOauthClientCreateReq / SysOauthClientUpdateReq
 * （clientId / clientSecret / contractScopes / allowRedirectUris / allowGrantTypes / status）
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('systemCommon.system.client.clientIdPlaceholder'),
      },
      fieldName: 'clientId',
      label: $t('systemCommon.system.client.clientId'),
      rules: z
        .string()
        .min(
          2,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.client.clientId'),
            2,
          ]),
        )
        .max(
          50,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.client.clientId'),
            50,
          ]),
        ),
    },
    {
      component: 'InputPassword',
      componentProps: {
        autocomplete: 'new-password',
        placeholder: $t('systemCommon.system.client.clientSecretPlaceholder'),
      },
      fieldName: 'clientSecret',
      label: $t('systemCommon.system.client.clientSecret'),
      rules: z
        .string()
        .min(
          6,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.client.clientSecret'),
            6,
          ]),
        )
        .max(
          128,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.client.clientSecret'),
            128,
          ]),
        ),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        mode: 'multiple',
        options: getGrantTypeOptions(),
        placeholder: $t(
          'systemCommon.system.client.allowGrantTypesPlaceholder',
        ),
      },
      fieldName: 'allowGrantTypes',
      label: $t('systemCommon.system.client.allowGrantTypes'),
      // 表单内为字符串数组（与后端逗号串的转换见 modules/form.vue）
      rules: z.array(z.string()).optional(),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('systemCommon.system.client.contractScopesPlaceholder'),
      },
      fieldName: 'contractScopes',
      label: $t('systemCommon.system.client.contractScopes'),
      rules: z
        .string()
        .max(
          255,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.client.contractScopes'),
            255,
          ]),
        )
        .optional(),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t(
          'systemCommon.system.client.allowRedirectUrisPlaceholder',
        ),
        rows: 3,
      },
      fieldName: 'allowRedirectUris',
      label: $t('systemCommon.system.client.allowRedirectUris'),
      rules: z
        .string()
        .max(
          500,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.client.allowRedirectUris'),
            500,
          ]),
        )
        .optional(),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: getStatusOptions(),
        optionType: 'button',
      },
      // 已与全项目语义统一：1=启用, 0=禁用
      defaultValue: 1,
      fieldName: 'status',
      label: $t('systemCommon.system.client.status'),
    },
  ];
}

/**
 * 表格上方搜索表单的 schema（后端 SysOauthClientQuery 仅支持 clientId 精确 / status 过滤）
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'clientId',
      label: $t('systemCommon.system.client.clientId'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: getStatusOptions(),
      },
      fieldName: 'status',
      label: $t('systemCommon.system.client.status'),
    },
  ];
}

/**
 * 表格列定义。秘钥不在列表展示（编辑抽屉内可见），
 * 状态 / 操作列使用插槽渲染：宿主的 vxe-table 适配器
 * 未注册 CellSwitch / CellOperation 渲染器（与 role、menu 页做法一致）
 */
export function useColumns(): VxeTableGridColumns<SystemOauthClient> {
  return [
    { align: 'center', title: '', type: 'checkbox', width: 50 },
    {
      align: 'center',
      title: $t('systemCommon.system.client.seq'),
      type: 'seq',
      width: 60,
    },
    {
      field: 'clientId',
      minWidth: 160,
      title: $t('systemCommon.system.client.clientId'),
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('systemCommon.system.client.status'),
      width: 100,
    },
    {
      field: 'allowGrantTypes',
      minWidth: 180,
      title: $t('systemCommon.system.client.allowGrantTypes'),
    },
    {
      field: 'contractScopes',
      minWidth: 140,
      title: $t('systemCommon.system.client.contractScopes'),
    },
    {
      field: 'allowRedirectUris',
      minWidth: 220,
      title: $t('systemCommon.system.client.allowRedirectUris'),
    },
    {
      field: 'createTime',
      title: $t('systemCommon.system.client.createTime'),
      width: 180,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('systemCommon.system.client.action'),
      width: 130,
    },
  ];
}
