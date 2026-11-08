# system-common 页面统一样式布局规范

本文件是本 app 的项目指令,只约束 system-common,其他项目有自己的规范,不要套用。
下文相对路径均以本 app 根为基准(即 `src/`、`package.json` 所在目录)。
标准参考实现:**用户管理** `src/views/system/user/index.vue`(左面板+右列表)与
**角色管理** `src/views/system/role/index.vue`(纯列表)。
新建或改版页面时,先打开这两个文件对照,再动手。

本 app 的页面是模块联邦远程页面(在 `src/pages.ts` 注册),运行在宿主的
vben 表格/表单适配器之下——适配器已注册的组件与规则可直接用,见文末清单。

## 1. Page 骨架:一律无标题/描述

```vue
<template>
  <Page auto-content-height>
    <!-- 页面内容 -->
  </Page>
</template>
```

- 禁止给 `<Page>` 传 `:title` / `:description`——所有系统页面已统一移除该头部,
  内容直接从顶部开始,高度由 `auto-content-height` 自动撑满。
- 页面标题来自左侧菜单(`sys_menu.meta.title`),不要在页面内重复。
- 文案键 `systemCommon.system.<module>.title` 仍被菜单引用,**不要删除**。

## 2. 纯列表页(无左侧面板)

`Page` 下直接放 Grid(角色管理为准):

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

以用户管理为准:左右两张**独立卡片**,中间留缝,不用一张大卡片内嵌 border-r 分隔。

```vue
<Page auto-content-height>
  <FormDrawer @success="onRefresh" />
  <DeptFormDrawer @success="loadTree" />
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
  取消选中后右表回到"全部"语义(部门树)或清空(字典项按类型查询)。
- **首次自动选中第一项后必须主动触发右表查询**:右表网格挂载时的自动查询发生在
  选中之前,拿到的是空选择,之后不会再查(字典管理踩过此坑)。
- 左侧搜索为前端过滤:数据首次加载后缓存,按键实时过滤;命中节点保留子树,
  仅后代命中时保留祖先路径;有关键字时自动展开树(`gridApi.grid?.setAllTreeExpand?.(true)`);
  增删改后使缓存失效。

## 4. 搜索条件区(与用户管理一致)

查询条件放**表格上方的搜索表单**(vben grid 的 formOptions),
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
- 树形列表(菜单管理)搜索时用 `gridEvents.proxyQuery` 钩子在查询后展开全部节点。

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
  `$t('ui.actionTitle.create', [$t('systemCommon.system.<m>.<实体名>')])`——
  占位符传**实体名词**(用户/角色),不是某个字段名(不能出现"新增姓名")。
- 行操作用 `#operation` 插槽:`size="small" type="link"`,删除套 `Popconfirm`;
  宿主适配器未注册 CellSwitch/CellOperation 渲染器,状态开关与操作列都用插槽。

## 6. 宽度与样式陷阱

- **三个等宽按钮用内联 `style="flex: 1"`**,不要用 Tailwind 的 `flex-1`
  工具类(在本应用构建中不生效);"删除"按钮不要加 `block`(`width:100%` 会抢宽)。
- **表单里的 Select / TreeSelect 加 `class: 'w-full'`**(antd Select 默认不撑满)。
- `<style>` 块必须**纯 CSS,不用 scss**(system-common 未依赖 @vben/styles,
  scss 会被构建注入导致解析失败);穿透子组件用 `:deep()`,但能不穿透就不穿透。

## 7. 编辑抽屉:一律拉详情接口

编辑抽屉打开时**无条件调 `GET /xxx/{id}` 详情接口**回填表单,
不要依赖分页行数据——列表接口不保证回填关联字段(角色页的 permissions/deptIds 曾因此不回显)。
新建时 `setData(null)`。抽屉标题:编辑用
`$t('ui.actionTitle.edit', [实体名词])`,新增用独立键 `createTitle`。

## 8. 树形选择组件(vben Tree / ApiTreeSelect)

- 面板里的单选树:`:collapsible="false"`(去掉顶部"全部展开"行)、
  `:default-expanded-level="2"`、选中态样式(蓝字+对勾)在 `#node` 插槽里
  按选中 id 条件渲染,**不要用 CSS 穿透组件内部 DOM 实现**。
- 表单里的多选部门树用 `ApiTreeSelect` + `treeCheckable` + `treeCheckStrictly`
  (父子勾选互不关联)。注意:strict 模式下组件值是 `{value,label,halfChecked}` 对象,
  **提交前映射回 ID 数组、回显时包装成 `{value}`**,在抽屉的提交/回显处各做一次归一化。
- 表单里的 Select 加过占位符默认值机制,无需手写 placeholder,除非有特殊文案。

## 9. 国际化

- 文案键:`systemCommon.system.<module>.<key>`,文件
  `src/locales/zh-CN/system/<module>.ts` 与 `en-US/system/<module>.ts` 同步添加,
  并在 `src/locales/{zh-CN,en-US}/system/index.ts` 各注册一行。
- 必备键:`title`(菜单引用,勿删)、`description`(暂无展示位,保留)、
  实体名词、字段标签、`seq`/`action`/`createTime`、状态两态文案、
  `switchStatus`/`switchStatusContent`(状态开关确认弹窗)。

## 10. 新增页面 checklist

1. `src/views/system/<module>/` 建 `index.vue`、`data.ts`(列定义+表单 schema+搜索 schema)、
   `modules/form.vue`(编辑抽屉);主从布局再加左面板与详情查询。
2. `src/api/system/<module>.ts`:接口封装,`getRequestClient()` 由宿主注入。
3. `src/pages.ts` 注册 `XxxManagePage`。
4. 双语文案 + index.ts 聚合注册(§9)。
5. 后端菜单 `sys_menu` 增加行(component 指向 `/system_common/XxxManagePage`),
   增量脚本放后端仓库的 `portal-service/deploy/sql/`(本 app 之外的兄弟项目)。
6. 本 app 目录下 `pnpm typecheck` 通过。
