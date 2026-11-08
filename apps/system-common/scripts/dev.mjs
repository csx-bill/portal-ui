#!/usr/bin/env node
/**
 * system-common 开发模式（Remote dev server）。
 *
 * @originjs/vite-plugin-federation 的 dev 模式不会在 vite dev server 上
 * 提供 remoteEntry.js（只有 build 产物里有），因此本地开发采用：
 *   1. 监听 src/ 变更 → 全量构建 dist 产物（含 remoteEntry.js）
 *   2. `vite preview` 在 :3200 提供产物服务
 * 宿主通过 VITE_SYSTEM_COMMON_REMOTE_URL=http://localhost:3200/remoteEntry.js
 * 加载远程模块。
 *
 * 为什么不用 `vite build --watch`：
 * federation 插件与 rolldown 的 watch 增量构建不兼容（emitFile 引用 id
 * 在增量重建时丢失，报 "Unable to get file name for unknown file"），
 * 因此这里监听源码变化后执行完整构建。
 *
 * 修改 system-common 源码 → 自动全量重建 → 刷新宿主页面即可看到最新效果
 * （remoteEntry.js 的 URL 不变，浏览器 ESM 缓存按 URL 命中，需要刷新宿主页面）。
 */
import { spawn } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SRC_DIR = resolve(ROOT, 'src');
const REMOTE_ENTRY = resolve(ROOT, 'dist/remoteEntry.js');

const children = [];

function run(args, { waitForExit = false } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn('pnpm', args, {
      cwd: ROOT,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    });
    children.push(child);
    if (waitForExit) {
      child.on('exit', (code) => resolvePromise(code));
    } else {
      resolvePromise(child);
    }
  });
}

function shutdown() {
  if (process.platform === 'win32') {
    // Windows 下 spawn(shell:true) 的子进程无法通过 child.kill() 级联终止，
    // 需要 taskkill /T 按进程树强杀
    for (const child of children) {
      if (child.pid) {
        spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], {
          stdio: 'ignore',
        });
      }
    }
    setTimeout(() => process.exit(0), 500);
  } else {
    for (const child of children) {
      if (!child.killed) {
        child.kill();
      }
    }
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/** 全量构建（串行，构建期间的新变更会再触发一次） */
let building = false;
let dirty = false;

async function buildAll(reason) {
  if (building) {
    dirty = true;
    return;
  }
  building = true;
  // no-console 仅放行 warn/error，dev 进度信息统一走 warn
  console.warn(`\n[dev] ${reason}，开始构建...`);
  const code = await run(['vite', 'build', '--mode', 'development'], {
    waitForExit: true,
  });
  building = false;
  if (code === 0) {
    console.warn('[dev] 构建完成，刷新宿主页面即可看到最新效果');
  } else {
    console.error(`[dev] 构建失败（exit ${code}），保留上一次产物`);
  }
  if (dirty) {
    dirty = false;
    buildAll('检测到构建期间的变更');
  }
}

// 1. 初始构建
await buildAll('初始构建');

// 2. 启动 preview（:3200），产物就绪后服务
if (!existsSync(REMOTE_ENTRY)) {
  console.error('[dev] 初始构建未产出 remoteEntry.js，退出');
  process.exit(1);
}
await run([
  'vite',
  'preview',
  '--mode',
  'development',
  '--port',
  '3200',
  '--strictPort',
]);

// 3. 监听源码变更 → 防抖 → 全量重建
let debounceTimer;
watch(SRC_DIR, { recursive: true }, (_eventType, filename) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    buildAll(`源码变更：${filename}`).catch(console.error);
  }, 1000);
});
