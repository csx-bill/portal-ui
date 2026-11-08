<script lang="ts" setup>
import type { BaseFormComponentType, VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import type { SystemMenu } from '#/api/system/menu';

import { computed, h, ref } from 'vue';

import { useVbenDrawer, useVbenForm, z } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { $t, $te } from '@vben/locales';
import { getPopupContainer } from '@vben/utils';

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

import {
  createMenu,
  getMenuTree,
  isMenuNameExists,
  isMenuPathExists,
  menuBadgeVariants,
  updateMenu,
} from '#/api/system/menu';

import { getMenuTypeOptions } from '../data';

/**
 * 菜单新增/编辑抽屉。
 * 表单组件（IconPicker / ApiTreeSelect 等）由宿主的组件适配器
 * 通过 globalShareState 注册，这里只声明 schema；
 * 字段名对齐后端 SysMenu 实体（menuType / parentId / meta.*）。
 */
const emit = defineEmits<{
  success: [];
}>();
const formData = ref<SystemMenu>();
const titleSuffix = ref<string>();

type MenuDrawerData = SystemMenu | { parentId?: SystemMenu['parentId'] };
type MenuSubmitValues = Omit<SystemMenu, 'children' | 'id'>;
type MenuFormValues = MenuSubmitValues & { linkSrc?: string };

/**
 * 表单 schema 类型：组件名不做严格联合约束（运行时组件由宿主的
 * 组件适配器注册），仅约束表单值类型
 */
type MenuFormSchema = VbenFormSchema<
  BaseFormComponentType,
  Record<string, any>,
  MenuFormValues
>;

function encodeMenuFormValues(
  values: Readonly<MenuFormValues>,
): MenuSubmitValues {
  const { linkSrc, ...formValues } = values;
  if (values.menuType === 'link') {
    const meta = { ...values.meta, link: linkSrc };
    Reflect.deleteProperty(meta, 'iframeSrc');
    return {
      ...formValues,
      meta,
    };
  }
  if (values.menuType === 'embedded') {
    const meta = { ...values.meta, iframeSrc: linkSrc };
    Reflect.deleteProperty(meta, 'link');
    return {
      ...formValues,
      meta,
    };
  }
  return formValues;
}

function decodeMenuFormValues(
  values: Readonly<MenuSubmitValues>,
): MenuFormValues {
  let linkSrc: string | undefined;
  if (values.menuType === 'link') {
    linkSrc = values.meta?.link;
  } else if (values.menuType === 'embedded') {
    linkSrc = values.meta?.iframeSrc;
  }
  return { ...values, linkSrc };
}

const schema: MenuFormSchema[] = [
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: getMenuTypeOptions(),
      optionType: 'button',
    },
    defaultValue: 'menu',
    fieldName: 'menuType',
    formItemClass: 'col-span-2 md:col-span-2',
    label: $t('systemCommon.system.menu.type'),
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: $t('systemCommon.system.menu.menuName'),
    rules: z
      .string()
      .min(
        2,
        $t('ui.formRules.minLength', [
          $t('systemCommon.system.menu.menuName'),
          2,
        ]),
      )
      .max(
        50,
        $t('ui.formRules.maxLength', [
          $t('systemCommon.system.menu.menuName'),
          50,
        ]),
      )
      .refine(
        async (value: string) => {
          return !(await isMenuNameExists(value, formData.value?.id));
        },
        {
          error: (issue) =>
            $t('ui.formRules.alreadyExists', [
              $t('systemCommon.system.menu.menuName'),
              issue.input,
            ]),
        },
      ),
  },
  {
    component: 'ApiTreeSelect',
    componentProps: {
      api: getMenuTree,
      class: 'w-full',
      filterTreeNode(input: string, node: Recordable<any>) {
        if (!input || input.length === 0) {
          return true;
        }
        const title: string = node.meta?.title ?? '';
        if (!title) return false;
        return title.includes(input) || $t(title).includes(input);
      },
      getPopupContainer,
      labelField: 'meta.title',
      showSearch: true,
      treeDefaultExpandAll: true,
      valueField: 'id',
      childrenField: 'children',
    },
    fieldName: 'parentId',
    label: $t('systemCommon.system.menu.parent'),
    renderComponentContent() {
      return {
        treeTitleRender({
          label,
          meta,
        }: {
          label: string;
          meta: Recordable<any>;
        }) {
          const coms = [];
          if (!label) return '';
          if (meta?.icon) {
            coms.push(h(IconifyIcon, { class: 'size-4', icon: meta.icon }));
          }
          coms.push(h('span', { class: '' }, $t(label || '')));
          return h('div', { class: 'flex items-center gap-1' }, coms);
        },
      };
    },
  },
  {
    component: 'Input',
    componentProps() {
      // 不需要处理多语言时就无需这么做
      return {
        ...(titleSuffix.value && { addonAfter: titleSuffix.value }),
        onChange({ target: { value } }: { target: { value: string } }) {
          titleSuffix.value = value && $te(value) ? $t(value) : undefined;
        },
      };
    },
    fieldName: 'meta.title',
    label: $t('systemCommon.system.menu.menuTitle'),
    rules: 'required',
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => {
        return ['catalog', 'embedded', 'menu'].includes(values.menuType);
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'path',
    label: $t('systemCommon.system.menu.path'),
    rules: z
      .string()
      .min(
        2,
        $t('ui.formRules.minLength', [$t('systemCommon.system.menu.path'), 2]),
      )
      .max(
        255,
        $t('ui.formRules.maxLength', [
          $t('systemCommon.system.menu.path'),
          255,
        ]),
      )
      .refine(
        async (value: string) => {
          return !(await isMenuPathExists(value, formData.value?.id));
        },
        {
          error: (issue) =>
            $t('ui.formRules.alreadyExists', [
              $t('systemCommon.system.menu.path'),
              issue.input,
            ]),
        },
      ),
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => {
        return ['embedded', 'menu'].includes(values.menuType);
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'meta.activePath',
    help: $t('systemCommon.system.menu.activePathHelp'),
    label: $t('systemCommon.system.menu.activePath'),
    rules: z
      .string()
      .min(
        2,
        $t('ui.formRules.minLength', [$t('systemCommon.system.menu.path'), 2]),
      )
      .max(
        100,
        $t('ui.formRules.maxLength', [
          $t('systemCommon.system.menu.path'),
          100,
        ]),
      )
      .refine(async (value: string) => {
        return await isMenuPathExists(value, formData.value?.id);
      }, $t('systemCommon.system.menu.activePathMustExist'))
      .nullish(),
  },
  {
    component: 'IconPicker',
    componentProps: {
      prefix: 'carbon',
    },
    dependencies: {
      show: (values) => {
        return ['catalog', 'embedded', 'link', 'menu'].includes(
          values.menuType,
        );
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'meta.icon',
    label: $t('systemCommon.system.menu.icon'),
  },
  {
    component: 'IconPicker',
    componentProps: {
      prefix: 'carbon',
    },
    dependencies: {
      show: (values) => {
        return ['catalog', 'embedded', 'menu'].includes(values.menuType);
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'meta.activeIcon',
    label: $t('systemCommon.system.menu.activeIcon'),
  },
  {
    component: 'Input',
    // 默认空串：新建未填写时值为 '' 而非 undefined，
    // 让 min(1) 的必填提示触发（undefined 会先命中 zod 类型错误，
    // 显示为原始的 Invalid input 文案）
    defaultValue: '',
    dependencies: {
      // 长度上限对齐数据库 sys_menu.component varchar(255)
      rules: (values) => {
        const max = z
          .string()
          .max(
            255,
            $t('ui.formRules.maxLength', [
              $t('systemCommon.system.menu.component'),
              255,
            ]),
          );
        return values.menuType === 'menu'
          ? max.min(
              1,
              $t('ui.formRules.required', [
                $t('systemCommon.system.menu.component'),
              ]),
            )
          : null;
      },
      show: (values) => {
        return values.menuType === 'menu';
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'component',
    label: $t('systemCommon.system.menu.component'),
  },
  {
    component: 'Input',
    dependencies: {
      show: (values) => {
        return ['embedded', 'link'].includes(values.menuType);
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'linkSrc',
    label: $t('systemCommon.system.menu.linkSrc'),
    rules: z.url($t('ui.formRules.invalidURL')),
  },
  {
    component: 'Input',
    dependencies: {
      // 长度上限对齐数据库 sys_menu.auth_code varchar(128)
      rules: (values) => {
        const max = z
          .string()
          .max(
            128,
            $t('ui.formRules.maxLength', [
              $t('systemCommon.system.menu.authCode'),
              128,
            ]),
          );
        return values.menuType === 'button'
          ? max.min(
              1,
              $t('ui.formRules.required', [
                $t('systemCommon.system.menu.authCode'),
              ]),
            )
          : // 后端实体列可空（回传 null），optional 只放行 undefined，
            // 需用 nullish 兼容编辑回填的 null
            max.nullish();
      },
      show: (values) => {
        return ['button', 'catalog', 'embedded', 'menu'].includes(
          values.menuType,
        );
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'authCode',
    label: $t('systemCommon.system.menu.authCode'),
  },
  {
    component: 'RadioGroup',
    componentProps: {
      buttonStyle: 'solid',
      options: [
        { label: $t('systemCommon.system.menu.enabled'), value: 1 },
        { label: $t('systemCommon.system.menu.disabled'), value: 0 },
      ],
      optionType: 'button',
    },
    defaultValue: 1,
    fieldName: 'status',
    label: $t('systemCommon.system.menu.status'),
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
    label: $t('systemCommon.system.menu.sortOrder'),
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      class: 'w-full',
      options: [
        { label: $t('systemCommon.system.menu.badgeType.dot'), value: 'dot' },
        {
          label: $t('systemCommon.system.menu.badgeType.normal'),
          value: 'normal',
        },
      ],
    },
    dependencies: {
      show: (values) => {
        return values.menuType !== 'button';
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'meta.badgeType',
    label: $t('systemCommon.system.menu.badgeType.title'),
  },
  {
    component: 'Input',
    dependencies: {
      resolve: ({ values }) => {
        return {
          componentProps: {
            allowClear: true,
            class: 'w-full',
            disabled: values.meta?.badgeType !== 'normal',
          },
          show: values.menuType !== 'button',
        };
      },
      triggerFields: ['meta.badgeType', 'menuType'],
    },
    fieldName: 'meta.badge',
    label: $t('systemCommon.system.menu.badge'),
  },
  {
    component: 'Select',
    componentProps: {
      allowClear: true,
      class: 'w-full',
      options: menuBadgeVariants.map((v) => ({
        label: v,
        value: v,
      })),
    },
    dependencies: {
      show: (values) => {
        return values.menuType !== 'button';
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'meta.badgeVariants',
    label: $t('systemCommon.system.menu.badgeVariants'),
  },
  {
    component: 'Divider',
    dependencies: {
      show: (values) => {
        return !['button', 'link'].includes(values.menuType);
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'divider1',
    formItemClass: 'col-span-2 md:col-span-2 pb-0',
    hideLabel: true,
    renderComponentContent() {
      return {
        default: () => $t('systemCommon.system.menu.advancedSettings'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return ['menu'].includes(values.menuType);
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'meta.keepAlive',
    renderComponentContent() {
      return {
        default: () => $t('systemCommon.system.menu.keepAlive'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return ['embedded', 'menu'].includes(values.menuType);
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'meta.affixTab',
    renderComponentContent() {
      return {
        default: () => $t('systemCommon.system.menu.affixTab'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return !['button'].includes(values.menuType);
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'meta.hideInMenu',
    renderComponentContent() {
      return {
        default: () => $t('systemCommon.system.menu.hideInMenu'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return ['catalog', 'menu'].includes(values.menuType);
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'meta.hideChildrenInMenu',
    renderComponentContent() {
      return {
        default: () => $t('systemCommon.system.menu.hideChildrenInMenu'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return !['button', 'link'].includes(values.menuType);
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'meta.hideInBreadcrumb',
    renderComponentContent() {
      return {
        default: () => $t('systemCommon.system.menu.hideInBreadcrumb'),
      };
    },
  },
  {
    component: 'Checkbox',
    dependencies: {
      show: (values) => {
        return !['button', 'link'].includes(values.menuType);
      },
      triggerFields: ['menuType'],
    },
    fieldName: 'meta.hideInTab',
    renderComponentContent() {
      return {
        default: () => $t('systemCommon.system.menu.hideInTab'),
      };
    },
  },
];

const breakpoints = useBreakpoints(breakpointsTailwind);
const isHorizontal = computed(() => breakpoints.greaterOrEqual('md').value);

const [Form, formApi] = useVbenForm<
  MenuFormValues,
  BaseFormComponentType,
  Record<string, any>,
  MenuSubmitValues
>({
  codec: {
    decode: decodeMenuFormValues,
    encode: encodeMenuFormValues,
  },
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-2 md:col-span-1',
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2 gap-x-4',
});
const [Drawer, drawerApi] = useVbenDrawer<MenuDrawerData>({
  onConfirm: onSubmit,
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData();
      if (data && 'id' in data) {
        formData.value = data;
        await formApi.setSubmitValues(data);
        titleSuffix.value = formData.value.meta?.title
          ? $t(formData.value.meta.title)
          : '';
      } else {
        formData.value = undefined;
        formApi.reset();
        await formApi.setValues(data ?? {});
        titleSuffix.value = '';
      }
    }
  },
});

defineExpose({ drawerApi });

async function onSubmit() {
  const { valid } = await formApi.validate();
  if (valid) {
    drawerApi.lock();
    const data = await formApi.getValues();
    try {
      await (formData.value?.id
        ? updateMenu({ ...data, id: formData.value.id })
        : createMenu(data));
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  }
}
const getDrawerTitle = computed(() =>
  formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('systemCommon.system.menu.name')])
    : $t('ui.actionTitle.create', [$t('systemCommon.system.menu.name')]),
);
</script>
<template>
  <Drawer class="w-full max-w-200" :title="getDrawerTitle">
    <Form class="mx-4" :layout="isHorizontal ? 'horizontal' : 'vertical'" />
  </Drawer>
</template>
