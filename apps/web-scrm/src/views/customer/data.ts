import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { CustomerApi } from '#/api';

import { $t } from '#/locales';

/**
 * 表格上方搜索表单（后端 WxCustomerQuery 支持 corpId/userId 精确 /
 * name 模糊 / lostFlag / tagId 标签过滤；企业与成员过滤来自左侧通讯录面板，
 * 此处保留客户名称搜索与流失状态、客户标签筛选）
 *
 * @param tagOptions 客户标签下拉选项（按当前企业加载，宿主页面传入 getter）
 */
export function useGridFormSchema(
  tagOptions: () => Array<{ label: string; value: string }>,
): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('customer.namePlaceholder'),
      },
      fieldName: 'name',
      label: $t('customer.name'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('customer.normal'), value: 0 },
          { label: $t('customer.lost'), value: 1 },
        ],
        placeholder: $t('customer.lostFlagPlaceholder'),
      },
      fieldName: 'lostFlag',
      label: $t('customer.lostFlag'),
    },
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        options: tagOptions(),
        placeholder: $t('customer.tagsPlaceholder'),
        showSearch: true,
        optionFilterProp: 'label',
      }),
      fieldName: 'tagId',
      label: $t('customer.tags'),
    },
  ];
}

/**
 * 客户标签名列表：从 extra_data 快照解析
 * （取当前跟进成员的 followed_user，取不到用首条；多个标签按顺序返回）
 */
export function customerTagNames(row: CustomerApi.WxCustomer): string[] {
  const extra = row.extraData as
    | undefined
    | {
        followedUsers?: Array<{
          userId?: string;
          tags?: Array<{ tagName?: string }>;
        }>;
      };
  const followed = extra?.followedUsers ?? [];
  if (followed.length === 0) return [];
  const follow =
    followed.find((f) => f.userId === row.userId) ?? followed[0] ?? {};
  const tags = Array.isArray(follow.tags) ? follow.tags : [];
  return tags.map((tag) => tag.tagName ?? '').filter((name) => !!name);
}

/**
 * 当前跟进成员的备注信息（remark/描述/公司/手机号），从 extra_data 快照解析
 */
export function customerFollowInfo(row: CustomerApi.WxCustomer): {
  description: string;
  remark: string;
  remarkCompany: string;
  remarkMobiles: string[];
} {
  const extra = row.extraData as
    | undefined
    | {
        followedUsers?: Array<{
          userId?: string;
          remark?: null | string;
          description?: null | string;
          remarkCompany?: null | string;
          remarkMobiles?: null | string[];
        }>;
      };
  const followed = extra?.followedUsers ?? [];
  const follow =
    followed.find((f) => f.userId === row.userId) ?? followed[0] ?? {};
  return {
    remark: follow.remark ?? '',
    description: follow.description ?? '',
    remarkCompany: follow.remarkCompany ?? '',
    remarkMobiles: follow.remarkMobiles ?? [],
  };
}

/**
 * 客户标签ID列表：从 extra_data 快照解析（取当前跟进成员的记录，取不到用首条）。
 * 用于标签编辑抽屉回显与 add/remove 差量计算
 */
export function customerTagIds(row: CustomerApi.WxCustomer): string[] {
  const extra = row.extraData as
    | undefined
    | {
        followedUsers?: Array<{
          userId?: string;
          tags?: Array<{ tagId?: string }>;
        }>;
      };
  const followed = extra?.followedUsers ?? [];
  if (followed.length === 0) return [];
  const follow =
    followed.find((f) => f.userId === row.userId) ?? followed[0] ?? {};
  const tags = Array.isArray(follow.tags) ? follow.tags : [];
  return tags.map((tag) => tag.tagId ?? '').filter((id) => !!id);
}

/**
 * 表格列定义。头像 / 类型 / 性别列使用插槽渲染（与通讯录页做法一致）
 */
export function useColumns(): VxeTableGridColumns<CustomerApi.WxCustomer> {
  return [
    { align: 'center', title: $t('customer.seq'), type: 'seq', width: 60 },
    {
      // 头像 + 客户名称 合并展示（头像多为空，独立列意义不大）
      align: 'center',
      field: 'name',
      minWidth: 160,
      slots: { default: 'name' },
      title: $t('customer.name'),
    },
    {
      field: 'type',
      slots: { default: 'type' },
      title: $t('customer.type'),
      width: 120,
    },
    {
      field: 'gender',
      slots: { default: 'gender' },
      title: $t('customer.gender'),
      width: 80,
    },
    {
      field: 'position',
      minWidth: 120,
      title: $t('customer.position'),
    },
    {
      field: 'corpName',
      minWidth: 140,
      title: $t('customer.corpName'),
    },
    {
      field: 'userId',
      minWidth: 130,
      slots: { default: 'followUser' },
      title: $t('customer.followUser'),
    },
    {
      field: 'followCreateTime',
      title: $t('customer.followCreateTime'),
      width: 170,
    },
    {
      field: 'followState',
      minWidth: 100,
      title: $t('customer.followState'),
    },
    {
      // 客户标签：从 extra_data 快照的 followedUsers[0].tags 解析（见下方 helper）
      field: 'extraData',
      minWidth: 200,
      showOverflow: false,
      slots: { default: 'tags' },
      title: $t('customer.tags'),
    },
    {
      field: 'remark',
      minWidth: 140,
      slots: { default: 'remark' },
      title: $t('customer.remark'),
    },
    {
      field: 'remarkMobiles',
      minWidth: 130,
      slots: { default: 'remarkMobiles' },
      title: $t('customer.remarkMobiles'),
    },
    {
      field: 'lostFlag',
      // 单元格为多行内容（标签+原因+时间），关闭全局的单行溢出裁剪
      showOverflow: false,
      slots: { default: 'lostFlag' },
      title: $t('customer.lostFlag'),
      width: 160,
    },
    {
      field: 'createTime',
      title: $t('customer.createTime'),
      width: 170,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: $t('customer.operation'),
      width: 90,
    },
  ];
}
