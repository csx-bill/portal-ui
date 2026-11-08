<script lang="ts" setup>
import type { CustomerApi } from '#/api';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Input, message, TextArea } from 'antdv-next';

import { updateCustomerRemark } from '#/api';
import { $t } from '#/locales';

/**
 * 客户备注编辑抽屉：对接企微 externalcontact/remark（92694）。
 * 打开时按 extra_data 快照回显当前跟进成员的备注信息，
 * 保存后后端刷新本地快照（列表与详情随之更新）。
 * 企微限制：备注 ≤20、描述 ≤150、备注公司 ≤20。
 */
const emits = defineEmits(['success']);

const row = ref<CustomerApi.WxCustomer>();
const remark = ref('');
const description = ref('');
const remarkCompany = ref('');
const remarkMobiles = ref('');

const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    if (!row.value) return;
    // 企微限制：备注/描述/备注公司/手机号不可同时为空
    if (
      !remark.value.trim() &&
      !description.value.trim() &&
      !remarkCompany.value.trim() &&
      !remarkMobiles.value.trim()
    ) {
      message.warning($t('customer.remarkAllEmpty'));
      return;
    }
    drawerApi.lock();
    updateCustomerRemark({
      corpId: row.value.corpId ?? '',
      userId: row.value.userId ?? '',
      externalUserId: row.value.externalUserId ?? '',
      remark: remark.value.trim() || undefined,
      description: description.value.trim() || undefined,
      remarkCompany: remarkCompany.value.trim() || undefined,
      // 传空数组 = 清除全部备注手机号
      remarkMobiles: remarkMobiles.value.trim()
        ? [remarkMobiles.value.trim()]
        : [],
    })
      .then(() => {
        message.success($t('customer.remarkEditSuccess'));
        emits('success');
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;
    row.value = drawerApi.getData() as CustomerApi.WxCustomer;
    // 按当前跟进成员的 extra_data 快照回显
    const follow = findFollow(row.value);
    remark.value = follow?.remark ?? '';
    description.value = follow?.description ?? '';
    remarkCompany.value = follow?.remarkCompany ?? '';
    remarkMobiles.value = (follow?.remarkMobiles ?? []).join('、');
  },
});

defineExpose({ drawerApi });

function findFollow(row: CustomerApi.WxCustomer) {
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
  return followed.find((f) => f.userId === row.userId) ?? followed[0];
}

const drawerTitle = computed(() =>
  row.value?.name
    ? `${$t('customer.remarkEdit')}：${row.value.name}`
    : $t('customer.remarkEdit'),
);
</script>
<template>
  <Drawer :title="drawerTitle" class="w-[440px]">
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <div class="text-xs text-muted-foreground">
          {{ $t('customer.remarkLabel') }}
        </div>
        <Input
          v-model:value="remark"
          :maxlength="20"
          show-count
          :placeholder="$t('customer.remarkPlaceholder')"
        />
      </div>
      <div class="flex flex-col gap-1">
        <div class="text-xs text-muted-foreground">
          {{ $t('customer.descriptionLabel') }}
        </div>
        <TextArea
          v-model:value="description"
          :maxlength="150"
          :rows="3"
          :placeholder="$t('customer.descriptionPlaceholder')"
        />
      </div>
      <div class="flex flex-col gap-1">
        <div class="text-xs text-muted-foreground">
          {{ $t('customer.remarkCompanyLabel') }}
        </div>
        <Input
          v-model:value="remarkCompany"
          :maxlength="20"
          :placeholder="$t('customer.remarkCompanyPlaceholder')"
        />
      </div>
      <div class="flex flex-col gap-1">
        <div class="text-xs text-muted-foreground">
          {{ $t('customer.remarkMobilesLabel') }}
        </div>
        <Input
          v-model:value="remarkMobiles"
          allow-clear
          :placeholder="$t('customer.remarkMobilesPlaceholder')"
        />
      </div>
    </div>
  </Drawer>
</template>
