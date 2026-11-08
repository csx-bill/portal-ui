import type { VbenFormSchema } from '@vben/common-ui';
import type { VxeTableGridColumns } from '@vben/plugins/vxe-table';

import type { SystemRole } from '#/api/system/role';

import { z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { getDeptTree } from '#/api/system/dept';

/** 数据权限取值文案 */
export function dataScopeLabel(scope?: null | number): string {
  const map: Record<number, string> = {
    1: $t('systemCommon.system.role.dataScopeAll'),
    2: $t('systemCommon.system.role.dataScopeCustom'),
    3: $t('systemCommon.system.role.dataScopeDeptAndChild'),
    4: $t('systemCommon.system.role.dataScopeDept'),
    5: $t('systemCommon.system.role.dataScopeSelf'),
  };
  return (scope !== null && scope !== undefined && map[scope]) || '-';
}

/**
 * 编辑抽屉的表单 schema（角色基础信息）。
 * 菜单权限不在此表单维护，由列表“授权”操作单独打开授权抽屉；
 * 字段长度上限对齐数据库列：sys_role.name varchar(50)、remark varchar(255)
 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('systemCommon.system.role.roleName'),
      rules: z
        .string()
        .min(
          2,
          $t('ui.formRules.minLength', [
            $t('systemCommon.system.role.roleName'),
            2,
          ]),
        )
        .max(
          50,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.role.roleName'),
            50,
          ]),
        ),
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
      label: $t('systemCommon.system.role.status'),
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('systemCommon.system.role.remark'),
      rules: z
        .string()
        .max(
          255,
          $t('ui.formRules.maxLength', [
            $t('systemCommon.system.role.remark'),
            255,
          ]),
        )
        // 后端 remark 可空（回传 null），nullish 兼容编辑回填
        .nullish(),
    },
    {
      component: 'Select',
      componentProps: {
        class: 'w-full',
        options: [
          { label: $t('systemCommon.system.role.dataScopeAll'), value: 1 },
          { label: $t('systemCommon.system.role.dataScopeCustom'), value: 2 },
          {
            label: $t('systemCommon.system.role.dataScopeDeptAndChild'),
            value: 3,
          },
          { label: $t('systemCommon.system.role.dataScopeDept'), value: 4 },
          { label: $t('systemCommon.system.role.dataScopeSelf'), value: 5 },
        ],
      },
      defaultValue: 1,
      fieldName: 'dataScope',
      label: $t('systemCommon.system.role.dataScope'),
      rules: 'selectRequired',
    },
    {
      // 自定义数据权限的部门范围：仅 dataScope=自定义 时显示。
      // 父子勾选互不关联（treeCheckStrictly），组件值变为 {value} 对象，
      // 提交/回显在 form.vue 做归一化
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
      dependencies: {
        show: (values) => values.dataScope === 2,
        triggerFields: ['dataScope'],
      },
      fieldName: 'deptIds',
      label: $t('systemCommon.system.role.dataScopeCustomDept'),
    },
  ];
}

/**
 * 表格上方搜索表单的 schema（后端仅支持 name / status 过滤）
 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('systemCommon.system.role.roleName'),
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
      label: $t('systemCommon.system.role.status'),
    },
  ];
}

/**
 * 表格列定义。状态列用插槽渲染开关，操作列用插槽渲染
 * 编辑/授权/删除（宿主的 vxe-table 适配器
 * 未注册 CellSwitch / CellOperation 渲染器，与 menu 页面做法一致）
 */
export function useColumns(): VxeTableGridColumns<SystemRole> {
  return [
    {
      align: 'center',
      title: $t('systemCommon.system.role.seq'),
      type: 'seq',
      width: 55,
    },
    {
      field: 'name',
      title: $t('systemCommon.system.role.roleName'),
      width: 200,
    },
    {
      field: 'status',
      slots: { default: 'status' },
      title: $t('systemCommon.system.role.status'),
      width: 100,
    },
    {
      field: 'dataScope',
      formatter: ({ cellValue }) => dataScopeLabel(cellValue as number),
      title: $t('systemCommon.system.role.dataScope'),
      width: 110,
    },
    {
      field: 'remark',
      minWidth: 100,
      title: $t('systemCommon.system.role.remark'),
    },
    {
      field: 'createTime',
      title: $t('systemCommon.system.role.createTime'),
      width: 200,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('systemCommon.system.role.action'),
      width: 170,
    },
  ];
}
