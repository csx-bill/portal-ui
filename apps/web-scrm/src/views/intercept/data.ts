import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { InterceptRuleApi } from '#/api';

import { $t } from '#/locales';

/**
 * 敏感词规则表格列（企微列表接口仅返回
 * ruleId/ruleName/createTime，完整配置在编辑抽屉内按详情加载）
 */
export function useInterceptColumns(): VxeTableGridColumns<InterceptRuleApi.WxInterceptRule> {
  return [
    { align: 'center', title: $t('intercept.seq'), type: 'seq', width: 60 },
    {
      field: 'ruleName',
      minWidth: 160,
      showOverflow: true,
      title: $t('intercept.ruleName'),
    },
    {
      field: 'createTime',
      title: $t('intercept.createTime'),
      width: 180,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      showOverflow: false,
      slots: { default: 'operation' },
      title: $t('intercept.action'),
      width: 140,
    },
  ];
}
