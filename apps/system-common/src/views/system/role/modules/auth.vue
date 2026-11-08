<script lang="ts" setup>
import type { SystemRole } from '#/api/system/role';

import { ref } from 'vue';

import { Tree, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { $t } from '@vben/locales';

import { Spin } from 'antdv-next';

import { getMenuTree } from '#/api/system/menu';
import { getRoleById, updateRole } from '#/api/system/role';

/**
 * 角色授权抽屉：与基础信息编辑表单分离，从列表“授权”操作进入，
 * 单独维护角色的菜单权限（checked 的菜单 ID 列表）。
 * 确认时基于行数据整体提交、仅覆盖 permissions，
 * 名称/状态/备注/数据权限等字段原值透传，不会被本次操作修改。
 */
const emits = defineEmits(['success']);

const role = ref<SystemRole>();

const menuTree = ref<any[]>([]);
const loadingMenuTree = ref(false);
const checkedMenus = ref<SystemRole['permissions']>([]);

const [Drawer, drawerApi] = useVbenDrawer<SystemRole>({
  async onConfirm() {
    if (!role.value) return;
    drawerApi.lock();
    updateRole({ ...role.value, permissions: checkedMenus.value })
      .then(() => {
        emits('success');
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    if (!data) return;
    checkedMenus.value = [];

    if (menuTree.value.length === 0) {
      await loadMenuTree();
    }
    // 始终拉详情，不依赖分页行数据（permissions 仅详情接口保证回填）
    role.value = { ...data, ...(await getRoleById(data.id)) };
    checkedMenus.value = role.value.permissions;
  },
});

defineExpose({ drawerApi });

async function loadMenuTree() {
  loadingMenuTree.value = true;
  try {
    const res = await getMenuTree();
    menuTree.value = res as unknown as any[];
  } finally {
    loadingMenuTree.value = false;
  }
}
</script>
<template>
  <Drawer :title="$t('systemCommon.system.role.authorizeTitle')">
    <Spin :spinning="loadingMenuTree" :classes="{ root: 'w-full' }">
      <Tree
        v-model="checkedMenus"
        class="auth-tree"
        :tree-data="menuTree"
        multiple
        bordered
        :default-expanded-level="2"
        value-field="id"
        label-field="meta.title"
        icon-field="meta.icon"
        :select-all-label="$t('systemCommon.system.role.selectAll')"
      >
        <template #node="{ value }">
          <IconifyIcon v-if="value.meta?.icon" :icon="value.meta.icon" />
          {{ value.meta?.title ? $t(value.meta.title) : value.name }}
        </template>
      </Tree>
    </Spin>
  </Drawer>
</template>
<style scoped>
/* vben Tree 的 data-[selected]:bg-accent 工具类在本构建中未生成,补选中底色 */
:deep(.auth-tree [data-selected]) {
  background-color: hsl(var(--accent));
}
</style>
