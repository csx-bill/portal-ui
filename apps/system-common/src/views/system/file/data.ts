import type { VbenFormSchema } from '@vben/common-ui';

import type { SystemFileGroup } from '#/api/system/file';

import { z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { getFileGroupTree } from '#/api/system/file';

/**
 * 文件分组编辑抽屉的表单 schema。
 * 字段长度上限对齐数据库 sys_file_group 列定义（name varchar(32)）。
 */
export function useGroupFormSchema(
  formData: () => SystemFileGroup | undefined,
): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('systemCommon.system.file.groupName'),
      rules: z
        .string()
        .min(
          1,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.file.groupName'),
            1,
          ]),
        )
        .max(
          32,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.file.groupName'),
            32,
          ]),
        ),
    },
    {
      component: 'ApiTreeSelect',
      componentProps: {
        allowClear: true,
        api: getFileGroupTree,
        class: 'w-full',
        labelField: 'name',
        valueField: 'id',
        childrenField: 'children',
        treeDefaultExpandAll: true,
      },
      dependencies: {
        // 编辑时禁止把自己设为上级（后端树构建会漏环，前端先拦）
        componentProps: () => {
          return formData()?.id ? { disabled: true } : {};
        },
        triggerFields: [],
      },
      fieldName: 'parentId',
      label: $t('systemCommon.system.file.parentGroup'),
    },
  ];
}
