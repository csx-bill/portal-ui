import common from './common';
import components from './components';
import system from './system';

/**
 * 语言包根聚合（模块机械拼接）。
 * 新增顶层模块（非 system 下的，如 crm/）：建 {lang}/crm/ 目录
 * （内含 index.ts 聚合）→ 这里两个语言各加一行 import。
 * 聚合逻辑在模块目录内部，本文件不做任何业务文案定义。
 */
export default {
  common,
  components,
  system,
};
