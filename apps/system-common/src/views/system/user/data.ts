import type { VbenFormSchema } from '@vben/common-ui';
import type { VxeTableGridColumns } from '@vben/plugins/vxe-table';

import type { SystemUser } from '#/api/system/user';

import { z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { getDeptTree } from '#/api/system/dept';
import { getRoleList } from '#/api/system/role';

/** 性别取值文案 */
export function genderLabel(gender?: null | number): string {
  if (gender === 1) return $t('systemCommon.system.user.male');
  if (gender === 2) return $t('systemCommon.system.user.female');
  return $t('systemCommon.system.user.unknown');
}

/**
 * 用户编辑抽屉的表单 schema。
 * username 编辑态禁用（登录账号创建后不可改，对齐后端约束提示）；
 * 密码新增必填、编辑留空则不修改（schema 随模式响应式重建，规则跟随切换）；
 * 字段长度上限对齐数据库 sys_user 列定义（varchar(255)）。
 */
export function useFormSchema(
  formData: () => SystemUser | undefined,
): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: () => ({
        autocomplete: 'off',
        disabled: !!formData()?.id,
      }),
      fieldName: 'username',
      label: $t('systemCommon.system.user.username'),
      rules: z
        .string()
        .min(
          2,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.user.username'),
            2,
          ]),
        )
        .max(
          50,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.user.username'),
            50,
          ]),
        ),
    },
    {
      component: 'InputPassword',
      componentProps: () => ({
        autocomplete: 'new-password',
        // 编辑态提示留空不修改；新增态走适配器默认 placeholder
        ...(formData()?.id
          ? {
              placeholder: $t(
                'systemCommon.system.user.passwordEditPlaceholder',
              ),
            }
          : {}),
      }),
      fieldName: 'password',
      label: $t('systemCommon.system.user.password'),
      // 新增态必填（红星 + 行内校验）；编辑态留空表示不修改，不校验
      rules: formData()?.id
        ? undefined
        : z.string().min(1, $t('systemCommon.system.user.passwordRequired')),
    },
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('systemCommon.system.user.name'),
      rules: z
        .string()
        .min(
          2,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.user.name'),
            2,
          ]),
        )
        .max(
          50,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.user.name'),
            50,
          ]),
        ),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 20 },
      fieldName: 'mobile',
      label: $t('systemCommon.system.user.mobile'),
    },
    {
      component: 'Input',
      fieldName: 'email',
      label: $t('systemCommon.system.user.email'),
    },
    {
      component: 'Select',
      componentProps: {
        class: 'w-full',
        options: [
          { label: $t('systemCommon.system.user.unknown'), value: 0 },
          { label: $t('systemCommon.system.user.male'), value: 1 },
          { label: $t('systemCommon.system.user.female'), value: 2 },
        ],
      },
      defaultValue: 0,
      fieldName: 'gender',
      label: $t('systemCommon.system.user.gender'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('systemCommon.system.role.enabled'), value: 1 },
          { label: $t('systemCommon.system.role.disabled'), value: 0 },
        ],
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('systemCommon.system.user.status'),
    },
    {
      // 下拉树多选，父子勾选互不关联（treeCheckStrictly）：
      // 勾选子部门不会自动勾上父部门。注意该模式下组件值变为
      // {value,label,halfChecked} 对象，提交/回显在 form.vue 做归一化
      component: 'ApiTreeSelect',
      componentProps: {
        allowClear: true,
        api: getDeptTree,
        childrenField: 'children',
        class: 'w-full',
        labelField: 'name',
        maxTagCount: 3,
        treeCheckable: true,
        treeCheckStrictly: true,
        treeDefaultExpandAll: true,
        valueField: 'id',
      },
      fieldName: 'deptIds',
      label: $t('systemCommon.system.user.dept'),
    },
    {
      // 角色多选（数据权限按角色 data_scope 确定数据范围）
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getRoleList,
        class: 'w-full',
        labelField: 'name',
        maxTagCount: 3,
        mode: 'multiple',
        optionFilterProp: 'label',
        valueField: 'id',
      },
      fieldName: 'roleIds',
      label: $t('systemCommon.system.user.role'),
    },
  ];
}

/**
 * 表格上方搜索表单的 schema（后端支持 keyword / status 过滤，
 * deptId 由左侧部门树选中态提供，不进搜索表单）
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { allowClear: true },
      fieldName: 'keyword',
      label: $t('common.search'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('systemCommon.system.role.enabled'), value: 1 },
          { label: $t('systemCommon.system.role.disabled'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('systemCommon.system.user.status'),
    },
  ];
}

/**
 * 表格列定义。所属部门列用插槽渲染名称列表；
 * 状态列用插槽渲染开关（宿主的 vxe-table 适配器
 * 未注册 CellSwitch / CellOperation 渲染器，与 menu 页面做法一致）
 */
export function useColumns(): VxeTableGridColumns<SystemUser> {
  return [
    {
      align: 'center',
      title: $t('systemCommon.system.user.seq'),
      type: 'seq',
      width: 55,
    },
    {
      field: 'username',
      title: $t('systemCommon.system.user.username'),
      width: 140,
    },
    {
      field: 'name',
      title: $t('systemCommon.system.user.name'),
      width: 120,
    },
    {
      field: 'mobile',
      title: $t('systemCommon.system.user.mobile'),
      width: 140,
    },
    {
      field: 'deptNames',
      minWidth: 120,
      slots: { default: 'deptNames' },
      title: $t('systemCommon.system.user.dept'),
    },
    {
      field: 'gender',
      formatter: ({ cellValue }) => genderLabel(cellValue as number),
      title: $t('systemCommon.system.user.gender'),
      width: 80,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('systemCommon.system.user.status'),
      width: 90,
    },
    {
      field: 'createTime',
      title: $t('systemCommon.system.user.createTime'),
      width: 180,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('systemCommon.system.user.action'),
      width: 110,
    },
  ];
}
