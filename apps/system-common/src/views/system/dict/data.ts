import type { VbenFormSchema } from '@vben/common-ui';
import type { VxeTableGridColumns } from '@vben/plugins/vxe-table';

import type { SystemDict, SystemDictItem } from '#/api/system/dict';

import { z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { isDictItemValueExists, isDictTypeExists } from '#/api/system/dict';

/**
 * 字典类型编辑抽屉的表单 schema。
 * 字段顺序与参考设计一致：配置类型 → 字典标识 → 字典名称 → 备注；
 * 字段长度上限对齐数据库 sys_dict 列定义。
 */
export function useTypeFormSchema(
  formData: () => SystemDict | undefined,
): VbenFormSchema[] {
  return [
    {
      component: 'RadioGroup',
      componentProps: () => ({
        buttonStyle: 'solid',
        // 系统类字典不允许改为业务类（后端拒删系统内置字典）
        disabled: formData()?.systemFlag === '1',
        options: [
          {
            label: $t('systemCommon.system.dict.configTypeSystem'),
            value: '1',
          },
          {
            label: $t('systemCommon.system.dict.configTypeBusiness'),
            value: '0',
          },
        ],
        optionType: 'button',
      }),
      defaultValue: '0',
      fieldName: 'systemFlag',
      label: $t('systemCommon.system.dict.configType'),
      rules: 'selectRequired',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('systemCommon.system.dict.dictIdentifierPlaceholder'),
      },
      fieldName: 'dictType',
      label: $t('systemCommon.system.dict.dictIdentifier'),
      rules: z
        .string()
        .min(
          2,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.dict.dictIdentifier'),
            2,
          ]),
        )
        .max(
          100,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.dict.dictIdentifier'),
            100,
          ]),
        )
        .refine(
          async (value: string) => {
            return !(await isDictTypeExists(value, formData()?.id));
          },
          {
            error: (issue) =>
              $t('ui.formRules.alreadyExists', [
                $t('systemCommon.system.dict.dictIdentifier'),
                issue.input,
              ]),
          },
        ),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: $t('systemCommon.system.dict.dictNamePlaceholder'),
      },
      fieldName: 'description',
      label: $t('systemCommon.system.dict.dictName'),
      rules: z
        .string()
        .min(
          1,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.dict.dictName'),
            1,
          ]),
        )
        .max(
          100,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.dict.dictName'),
            100,
          ]),
        ),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('systemCommon.system.dict.remarksPlaceholder'),
        rows: 3,
      },
      fieldName: 'remarks',
      label: $t('systemCommon.system.dict.remarks'),
      rules: z
        .string()
        .max(
          255,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.dict.remarks'),
            255,
          ]),
        )
        // 后端 remarks 可空（回传 null），nullish 兼容编辑回填
        .nullish(),
    },
  ];
}

/**
 * 字典项编辑抽屉的表单 schema。
 * 字段长度上限对齐数据库 sys_dict_item 列定义。
 */
export function useItemFormSchema(
  getDictId: () => number | string | undefined,
  formData: () => SystemDictItem | undefined,
): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'label',
      label: $t('systemCommon.system.dict.itemLabel'),
      rules: z
        .string()
        .min(
          1,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.dict.itemLabel'),
            1,
          ]),
        )
        .max(
          100,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.dict.itemLabel'),
            100,
          ]),
        ),
    },
    {
      component: 'Input',
      fieldName: 'itemValue',
      label: $t('systemCommon.system.dict.itemValue'),
      rules: z
        .string()
        .min(
          1,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.dict.itemValue'),
            1,
          ]),
        )
        .max(
          100,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.dict.itemValue'),
            100,
          ]),
        )
        .refine(
          async (value: string) => {
            const dictId = getDictId();
            if (!dictId) return true;
            return !(await isDictItemValueExists(
              dictId,
              value,
              formData()?.id,
            ));
          },
          {
            error: (issue) =>
              $t('ui.formRules.alreadyExists', [
                $t('systemCommon.system.dict.itemValue'),
                issue.input,
              ]),
          },
        ),
    },
    {
      component: 'InputNumber',
      componentProps: {
        class: 'w-full',
        min: 0,
        precision: 0,
      },
      defaultValue: 0,
      fieldName: 'sortOrder',
      label: $t('systemCommon.system.dict.sortOrder'),
    },
    {
      component: 'Input',
      fieldName: 'description',
      label: $t('systemCommon.system.dict.itemDescription'),
      rules: z
        .string()
        .max(
          100,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.dict.itemDescription'),
            100,
          ]),
        )
        .nullish(),
    },
    {
      component: 'Textarea',
      fieldName: 'remarks',
      label: $t('systemCommon.system.dict.remarks'),
      rules: z
        .string()
        .max(
          255,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.dict.remarks'),
            255,
          ]),
        )
        .nullish(),
    },
  ];
}

/**
 * 字典项表格列（操作列插槽渲染，与 menu/role 页做法一致）
 */
export function useItemColumns(): VxeTableGridColumns<SystemDictItem> {
  return [
    {
      field: 'label',
      title: $t('systemCommon.system.dict.itemLabel'),
      width: 180,
    },
    {
      field: 'itemValue',
      title: $t('systemCommon.system.dict.itemValue'),
      width: 180,
    },
    {
      field: 'sortOrder',
      title: $t('systemCommon.system.dict.sortOrder'),
      width: 100,
    },
    {
      field: 'description',
      formatter: ({ cellValue }) => cellValue || '-',
      minWidth: 160,
      title: $t('systemCommon.system.dict.itemDescription'),
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('systemCommon.system.dict.action'),
      width: 130,
    },
  ];
}
