import { requestClient } from '#/api/request';

export namespace DashboardApi {
  /** 指标汇总（本期 + 上期，前端据此计算环比） */
  export interface DashboardSummary {
    customerTotal?: number;
    customerTotalPrev?: number;
    groupTotal?: number;
    groupTotalPrev?: number;
    massDeliveredRate?: null | number;
    massDeliveredRatePrev?: null | number;
    memberTotal?: number;
    memberTotalPrev?: number;
    momentPublishRate?: null | number;
    momentPublishRatePrev?: null | number;
    newCustomer?: number;
    newCustomerPrev?: number;
  }

  /** 按日趋势行（本地实时口径） */
  export interface DashboardTrend {
    date: string;
    newCustomer: number;
    newGroup: number;
    newMember: number;
    quitMember: number;
  }

  /** 成员跟进客户数排行行 */
  export interface MemberRank {
    customerCnt: number;
    name: string;
    userId: string;
  }

  export interface SummaryParams {
    corpId: string;
    days?: number;
  }
}

/** 指标汇总（本期 + 上期） */
export function getDashboardSummary(params: DashboardApi.SummaryParams) {
  return requestClient.get<DashboardApi.DashboardSummary>(
    '/scrm/dashboard/summary',
    { params },
  );
}

/** 按日趋势 */
export function getDashboardTrend(params: DashboardApi.SummaryParams) {
  return requestClient.get<DashboardApi.DashboardTrend[]>(
    '/scrm/dashboard/trend',
    { params },
  );
}

/** 成员跟进客户数排行 */
export function getDashboardMemberRank(
  params: DashboardApi.SummaryParams & { limit?: number },
) {
  return requestClient.get<DashboardApi.MemberRank[]>(
    '/scrm/dashboard/rank/member',
    { params },
  );
}
