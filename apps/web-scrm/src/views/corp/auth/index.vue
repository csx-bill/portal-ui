<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { CorpApi } from '#/api';

import { Page } from '@vben/common-ui';

import { Image, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getCorpList } from '#/api';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';

/**
 * 企微企业授权列表页（后端 WxCorpAuthController /scrm/corp/list，不分页）。
 *
 * 菜单入口由后端决定：sys_menu.component 配成 corp/auth/index 时，
 * 宿主按 pageMap 解析到本文件（accessMode=backend）。
 *
 * 过滤条件：企业ID 精确 / 企业名称 模糊（WxCorpAuthQuery）。
 */
const [Grid] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async (_options, formValues) => getCorpList(formValues),
      },
    },
    rowConfig: {
      keyField: 'id',
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<CorpApi.WxCorpAuth>,
});
</script>
<template>
  <Page auto-content-height>
    <Grid>
      <template #logo="{ row }">
        <Image
          v-if="row.squareLogoUrl"
          :height="32"
          :src="row.squareLogoUrl"
          :width="32"
        />
        <span v-else>-</span>
      </template>
      <template #corpType="{ row }">
        <Tag v-if="row.corpType === 'SELF'" color="blue">
          {{ $t('corp.corpTypeSelf') }}
        </Tag>
        <Tag v-else-if="row.corpType === 'SUITE'" color="purple">
          {{ $t('corp.corpTypeSuite') }}
        </Tag>
        <span v-else>{{ row.corpType }}</span>
      </template>
      <template #authStatus="{ row }">
        <Tag :color="row.authStatus === 1 ? 'success' : 'error'">
          {{
            row.authStatus === 1
              ? $t('corp.authStatusOk')
              : $t('corp.authStatusDisabled')
          }}
        </Tag>
      </template>
    </Grid>
  </Page>
</template>
