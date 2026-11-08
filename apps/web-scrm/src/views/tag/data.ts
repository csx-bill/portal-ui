import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { CorpTagApi } from '#/api';

import { $t } from '#/locales';

/**
 * 右侧标签表格列定义（组下标签一次全量返回，不分页）
 */
export function useTagColumns(): VxeTableGridColumns<CorpTagApi.WxCorpTag> {
  return [
    { align: 'center', title: $t('tag.seq'), type: 'seq', width: 60 },
    {
      field: 'tagName',
      minWidth: 140,
      title: $t('tag.tagName'),
    },
    {
      field: 'order',
      title: $t('tag.order'),
      width: 100,
    },
    {
      field: 'createTime',
      title: $t('tag.createTime'),
      width: 170,
    },
  ];
}
