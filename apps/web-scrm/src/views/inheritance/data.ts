import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { InheritanceApi } from '#/api';

import { $t } from '#/locales';

/**
 * 离职继承-待分配客户表格列（本地数据模式 + 勾选列）。
 *
 * 离职成员列同时按成员显示名和企微 userid 匹配筛选，
 * 离职时间列按秒级时间戳排序。
 */
export function useUnassignedColumns(
  nameOf: (userid?: string) => string,
): VxeTableGridOptions<InheritanceApi.UnassignedItem>['columns'] {
  return [
    { type: 'checkbox', width: 50 },
    {
      field: 'handoverUserid',
      filters: [{ data: '' }],
      filterMethod: ({ row, value }) => {
        if (!value) return true;
        const keyword = String(value).toLowerCase();
        return (
          (row.handoverUserid ?? '').toLowerCase().includes(keyword) ||
          nameOf(row.handoverUserid).toLowerCase().includes(keyword)
        );
      },
      filterRender: { name: 'input' },
      minWidth: 140,
      showOverflow: true,
      slots: { default: 'handover' },
      title: $t('inheritance.handoverUserid'),
    },
    {
      field: 'externalUserid',
      filters: [{ data: '' }],
      filterRender: { name: 'input' },
      minWidth: 200,
      showOverflow: true,
      title: $t('inheritance.externalUserid'),
    },
    {
      field: 'dimissionTime',
      slots: { default: 'dimission' },
      sortable: true,
      title: $t('inheritance.dimissionTime'),
      width: 170,
    },
  ];
}
