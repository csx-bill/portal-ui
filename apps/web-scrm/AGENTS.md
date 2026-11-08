# web-scrm 页面统一样式布局规范

本文件是本 app 的项目指令,只约束 web-scrm,其他 app(如 system-common)有各自的
AGENTS.md,不要互相套用。下文相对路径均以本 app 根为基准(即 `src/`、
`package.json` 所在目录)。
标准参考实现:**用户管理(system-common)** 的布局规范与本 app 的
`src/views/customer/index.vue`(标准列表页)、`src/views/acquisition/index.vue`(左面板+右列表)。
新建或改版页面时,先打开参考文件对照,再动手。

本 app 是宿主应用:vben 表格/表单适配器在**本 app 内**维护
(`src/adapter/form.ts`、`src/adapter/vxe-table.ts`、`src/adapter/component/index.ts`),
已注册组件与 `required` / `selectRequired` 规则可直接用;页面为普通路由页面
(`src/router/routes/modules/`)。

## 1. Page 骨架:一律无标题/描述

```vue
<template>
  <Page auto-content-height>
    <!-- 页面内容 -->
  </Page>
</template>
```

- 禁止给 `<Page>` 传 `:title` / `:description`——本 app 全部页面已统一移除该头部,
  内容直接从顶部开始,高度由 `auto-content-height` 自动撑满。
- 页面标题来自左侧菜单(`sys_menu.meta.title`),不要在页面内重复。
- 文案键 `<module>.title` 仍被菜单引用,**不要删除**。

## 2. 纯列表页(无左侧面板)

`Page` 下直接放 Grid(客户列表为准):

```vue
<Page auto-content-height>
  <FormDrawer @success="onRefresh" />
  <Grid>
    <template #toolbar-tools> <!-- 新增按钮,见 §5 --> </template>
    <template #operation="{ row }"> <!-- 编辑/删除按钮 --> </template>
  </Grid>
</Page>
```

## 3. 主从布局页(左侧面板 + 右侧列表)

以获客链接 `src/views/acquisition/index.vue` 为准:左右两张**独立卡片**,
中间留缝,不用一张大卡片内嵌 border-r 分隔。

```vue
<Page auto-content-height>
  <div class="flex h-full min-h-0 gap-2">
    <!-- 左侧面板:w-60 固定宽,卡片样式,内边距 p-2 -->
    <div class="flex w-60 shrink-0 flex-col gap-2 rounded-md border bg-card p-2">
      <Input v-model:value="keyword" allow-clear :placeholder="..." />
      <div class="flex items-center gap-1">
        <Button size="small" style="flex: 1" type="primary" @click="onCreate">新增</Button>
        <Button size="small" style="flex: 1" :disabled="!selected" @click="onEdit">修改</Button>
        <Popconfirm ...>
          <Button danger size="small" style="flex: 1" :disabled="!selected">删除</Button>
        </Popconfirm>
      </div>
      <!-- 工具区与列表之间的分割线:-mx-2 抵消 p-2,通到面板两缘 -->
      <div class="-mx-2 border-b border-border"></div>
      <div class="min-h-0 flex-1 overflow-auto">
        <!-- 树(Tree)或列表项;外层滚动,不放整页滚动 -->
      </div>
    </div>
    <!-- 右侧:Grid 直接放,不要包 bg-card(Grid 自带容器样式) -->
    <div class="h-full min-w-0 flex-1">
      <Grid>...</Grid>
    </div>
  </div>
</Page>
```

主从布局交互约定:

- **再次点击已选中项 = 取消选中**。单选树(vben Tree)的点击路径不产生取消事件,
  在页面层自己做 toggle:`selected = selected === id ? undefined : id`,然后重新查询右表。
- **首次自动选中第一项后必须主动触发右表查询**:右表网格挂载时的自动查询发生在
  选中之前,拿到的是空选择,之后不会再查(字典管理踩过此坑)。
- 左侧搜索为前端过滤:数据首次加载后缓存,按键实时过滤;命中节点保留子树,
  仅后代命中时保留祖先路径;有关键字时自动展开树(`gridApi.grid?.setAllTreeExpand?.(true)`);
  增删改后使缓存失效。
- 看板类页面(如工作台)内容若自带 `overflow-auto` 滚动容器,加 `pr-3` 给右侧
  悬浮滚动条留避让空间,避免滚动条压住卡片/按钮边缘。

## 4. 搜索条件区

查询条件放**表格上方的搜索表单**(grid 的 formOptions),
不要塞进工具栏 toolbar-tools:

```ts
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),   // 放在本页 data.ts,导出函数
    submitOnChange: true,          // 输入即查
  },
  gridOptions: { ... },
});

// data.ts 中:
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { allowClear: true, placeholder: $t('...') },
      fieldName: 'keyword',
      label: $t('...'),
    },
  ];
}
```

- 后端支持的字段才进搜索表单;纯前端过滤的左侧面板搜索(§3)不进这里。
- 树形列表搜索时用 `gridEvents.proxyQuery` 钩子在查询后展开全部节点。

## 5. 表格工具栏

```ts
gridOptions: {
  toolbarConfig: {
    custom: true,
    export: false,
    refresh: true,
    search: true,   // 蓝色圆形搜索显隐按钮,有搜索条件区的页面必须为 true
    zoom: true,
  },
}
```

- 新增按钮放 `#toolbar-tools` 插槽,`type="primary"`,文案用
  `$t('<module>.create', [实体名词])`——占位符传**实体名词**(用户/角色),
  不是某个字段名(不能出现"新增姓名")。
- 行操作用 `#operation` 插槽:`size="small" type="link"`,删除套 `Popconfirm`;
  状态开关与操作列用插槽渲染。

## 6. 宽度与样式陷阱

- **三个等宽按钮用内联 `style="flex: 1"`**,不要用 Tailwind 的 `flex-1`
  工具类(在本应用构建中不生效);"删除"按钮不要加 `block`(`width:100%` 会抢宽)。
- **表单里的 Select / TreeSelect 加 `class: 'w-full'`**(antd Select 默认不撑满)。
- `<style>` 块**纯 CSS,不用 scss**;穿透子组件用 `:deep()`,但能不穿透就不穿透。

## 7. 编辑抽屉:一律拉详情接口

编辑抽屉打开时**无条件调 `GET /xxx/{id}` 详情接口**回填表单,
不要依赖分页行数据——列表接口不保证回填关联字段。
新建时 `setData(null)`。抽屉标题:编辑用
`$t('ui.actionTitle.edit', [实体名词])`,新增用独立键。

## 8. 树形选择组件(vben Tree / ApiTreeSelect)

- 面板里的单选树:`:collapsible="false"`(去掉顶部"全部展开"行)、
  `:default-expanded-level="2"`、选中态样式(蓝字+对勾)在 `#node` 插槽里
  按选中 id 条件渲染,**不要用 CSS 穿透组件内部 DOM 实现**。
- 表单里的多选树用 `ApiTreeSelect` + `treeCheckable`;需要父子勾选互不关联时加
  `treeCheckStrictly`——注意该模式下组件值是 `{value,label,halfChecked}` 对象,
  **提交前映射回 ID 数组、回显时包装成 `{value}`**,在抽屉的提交/回显处各做一次归一化。
- 表单里的 Select 有占位符默认值机制,无需手写 placeholder,除非有特殊文案。

## 9. 国际化

- 文案:JSON 文件 `src/locales/langs/{zh-CN,en-US}/<module>.json`,两语言同步;
  键名形如 `<module>.title`、`<module>.description`。
- `title` 被菜单引用(`sys_menu.meta.title`)勿删;`description` 暂无展示位,保留。
- 确认弹窗等通用文案优先用 `ui.actionMessage.*` / `common.*` 现成键。

## 10. 按钮权限控制

权限码约定 `<module>:<action>`(裸码),与 `sys_menu.auth_code` 配置值**原样精确匹配**,
不要带 `web-scrm:` 前缀——全量格式仅用于跨客户端公共功能(详见后端
`ClientScopeCheckPermissionHandler` 注释)。本 app 页面是宿主本地页面,用 vben 原生
机制,**不要用 system-common 远程页面的注入式 `hasPermission`**(那是 Remote 侧机制,
远程组件拿不到宿主代码才注入):

```vue
<!-- 单码:无权限时移除元素(bootstrap 已注册指令) -->
<Button v-access:code="'mass:update'" size="small" type="link" @click="onEdit(row)">
<!-- 多码任一命中(OR) -->
<Button v-access:code="['mass:add', 'mass:update']" ...>
```

- 脚本逻辑用 `useAccess().hasAccessByCodes`(参考 customer 页的 `canMarkTag`)。
- 降级不只是藏按钮:可交互单元格等入口要同步去掉点击态与视觉提示,handler 里
  再兜底校验一次(参考 customer 页标签列)。
- 权限码未在 `sys_menu` 配置时按钮全部隐藏(fail-closed),按钮行配置必须先行。
- 现有码清单:acquisition add/update/delete/sync;contact sync;customer
  sync/markTag/remark;groupchat sync;inheritance transfer;intercept
  add/update/delete;mass 与 moment add/update/delete/sync;tag
  add/update/delete/sync;userbinding bind/unbind;welcome add/update/delete。

## 11. 新增页面 checklist

1. `src/views/<module>/` 建 `index.vue`、`data.ts`(列定义+表单 schema+搜索 schema)、
   `modules/` 下的抽屉/弹窗组件。
2. `src/api/` 增加接口封装(基于 `src/api/request.ts`)。
3. `src/locales/langs/{zh-CN,en-US}/<module>.json` 双语文案。
4. `src/router/routes/modules/` 增加路由,后端 `sys_menu` 同步增加菜单行
   (增量脚本放后端仓库 `portal-service/deploy/sql/`)。
5. 按钮权限:前端 `v-access:code` 控制写操作入口显隐,并同步补
   `sys_menu.auth_code` 配置(见 §10)。
6. 本 app 目录下 `pnpm typecheck` 通过。
