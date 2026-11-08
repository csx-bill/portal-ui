<script lang="ts" setup>
import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';
import {
  AuthenticationColorToggle,
  AuthenticationLayoutToggle,
  LanguageToggle,
  ThemeToggle,
} from '@vben/layouts';
import { usePreferences } from '@vben/preferences';

import { $t } from '#/locales';

/**
 * 认证页定制布局（登录/验证码登录/找回密码等 auth 子路由共用），
 * 支持 vben 原有的三种表单位置（顶栏布局切换按钮可实时切换）：
 * - 居左/居右：一侧品牌面板 + 一侧表单区
 * - 居中：全屏品牌渐变作背景，表单浮于居中卡片
 * 品牌面板配色由主题变量驱动：切换主题色/明暗模式时整页一起变化；
 * 表单区使用主题变量自适应。
 */
const { authPanelCenter, authPanelLeft, isDark } = usePreferences();

/** 品牌面板卖点（与产品模块对应：客户/运营/敏感词），computed 保证语言切换实时更新 */
const FEATURES = computed(() => [
  {
    description: $t('login.feature1Desc'),
    icon: 'lucide:users-round',
    title: $t('login.feature1Title'),
  },
  {
    description: $t('login.feature2Desc'),
    icon: 'lucide:send',
    title: $t('login.feature2Title'),
  },
  {
    description: $t('login.feature3Desc'),
    icon: 'lucide:shield-check',
    title: $t('login.feature3Title'),
  },
]);
</script>

<template>
  <div
    class="relative flex min-h-full flex-1 select-none overflow-x-hidden"
    :class="{ dark: isDark }"
  >
    <!-- 居中模式：全屏品牌渐变背景 + 装饰 -->
    <div
      v-if="authPanelCenter"
      class="auth-brand absolute inset-0 overflow-hidden"
    >
      <div
        class="absolute top-[14%] left-[10%] size-24 rotate-12 rounded-3xl rounded-bl-md bg-white/10"
      ></div>
      <div
        class="absolute top-[8%] right-[12%] size-14 -rotate-6 rounded-2xl rounded-br-md bg-white/10"
      ></div>
      <div
        class="absolute bottom-[18%] left-[16%] size-16 -rotate-3 rounded-2xl rounded-bl-md bg-white/10"
      ></div>
      <div
        class="absolute right-[10%] bottom-[10%] size-28 rotate-6 rounded-3xl rounded-br-md bg-white/5"
      ></div>
      <div
        class="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl"
      ></div>
      <div
        class="absolute -bottom-32 -left-20 size-96 rounded-full bg-[#7cb1ff]/30 blur-3xl"
      ></div>
      <div class="auth-dots absolute inset-0"></div>
      <div
        class="absolute bottom-4 left-0 right-0 text-center text-xs text-white/50"
      >
        © 2026 新企通 SCRM · {{ $t('login.copyright') }}
      </div>
    </div>

    <!-- 左/右布局模式：一侧品牌面板 -->
    <div
      v-if="!authPanelCenter"
      class="auth-brand relative hidden overflow-hidden lg:flex lg:w-[46%] xl:w-[52%]"
      :class="authPanelLeft ? 'order-2' : 'order-1'"
    >
      <!-- 装饰：对话气泡 -->
      <div
        class="absolute top-[12%] left-[8%] size-24 rotate-12 rounded-3xl rounded-bl-md bg-white/10"
      ></div>
      <div
        class="absolute top-[6%] right-[14%] size-14 -rotate-6 rounded-2xl rounded-br-md bg-white/10"
      ></div>
      <div
        class="absolute bottom-[16%] left-[14%] size-16 -rotate-3 rounded-2xl rounded-bl-md bg-white/10"
      ></div>
      <div
        class="absolute right-[8%] bottom-[8%] size-28 rotate-6 rounded-3xl rounded-br-md bg-white/5"
      ></div>
      <!-- 装饰：光斑与点阵 -->
      <div
        class="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl"
      ></div>
      <div
        class="absolute -bottom-32 -left-20 size-96 rounded-full bg-[#7cb1ff]/30 blur-3xl"
      ></div>
      <div class="auth-dots absolute inset-0"></div>

      <!-- 品牌内容 -->
      <div
        class="relative z-10 flex flex-1 flex-col px-12 py-10 text-white xl:px-16"
      >
        <!-- 顶部 Logo -->
        <div class="flex items-center gap-3">
          <div
            class="flex-center size-11 rounded-xl bg-white/15 backdrop-blur-sm"
          >
            <IconifyIcon class="size-6" icon="lucide:message-square-more" />
          </div>
          <span class="text-xl font-semibold tracking-wide">新企通 SCRM</span>
        </div>

        <!-- 中部卖点 -->
        <div class="my-auto flex flex-col gap-10 py-12">
          <div>
            <h1 class="text-3xl leading-snug font-bold xl:text-4xl">
              {{ $t('login.panelTitle') }}
            </h1>
            <p class="mt-3 text-base text-white/70">
              {{ $t('login.panelSubtitle') }}
            </p>
          </div>
          <div class="flex flex-col gap-6">
            <div
              v-for="feature in FEATURES"
              :key="feature.title"
              class="flex items-start gap-4"
            >
              <div class="flex-center size-11 shrink-0 rounded-xl bg-white/10">
                <IconifyIcon
                  class="size-5 text-white/90"
                  :icon="feature.icon"
                />
              </div>
              <div>
                <div class="text-base font-medium text-white/95">
                  {{ feature.title }}
                </div>
                <div class="mt-1 text-sm text-white/60">
                  {{ feature.description }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部版权 -->
        <div class="text-xs text-white/50">
          © 2026 新企通 SCRM · {{ $t('login.copyright') }}
        </div>
      </div>
    </div>

    <!-- 表单区 -->
    <div
      class="relative flex min-h-full flex-1 flex-col"
      :class="[
        authPanelLeft ? 'order-1' : 'order-2',
        authPanelCenter ? '' : 'bg-background',
      ]"
    >
      <!-- 顶栏：移动端品牌 + 布局/语言/主题切换 -->
      <div
        class="absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-5 py-4 sm:px-8"
      >
        <div class="flex items-center gap-2 lg:hidden">
          <div
            class="flex-center size-8 rounded-lg"
            :class="authPanelCenter ? 'bg-white/15' : 'bg-primary/10'"
          >
            <IconifyIcon
              class="size-4.5"
              :class="authPanelCenter ? 'text-white' : 'text-primary'"
              icon="lucide:message-square-more"
            />
          </div>
          <span
            class="font-medium"
            :class="authPanelCenter ? 'text-white' : 'text-foreground'"
          >
            新企通 SCRM
          </span>
        </div>
        <div class="ml-auto flex items-center rounded-3xl bg-accent px-3 py-1">
          <AuthenticationColorToggle />
          <AuthenticationLayoutToggle />
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      <!-- 表单区（auth 子路由：登录/验证码登录/忘记密码等） -->
      <main class="flex flex-1 items-center justify-center p-6 pt-20 sm:pt-6">
        <!-- 居中模式：浮动卡片 -->
        <div
          v-if="authPanelCenter"
          class="w-full max-w-md rounded-2xl border bg-card p-8 shadow-2xl sm:p-10"
        >
          <RouterView v-slot="{ Component, route }">
            <Transition appear mode="out-in" name="slide-right">
              <KeepAlive :include="['Login']">
                <component
                  :is="Component"
                  :key="route.fullPath"
                  class="mx-auto w-full"
                />
              </KeepAlive>
            </Transition>
          </RouterView>
        </div>
        <div v-else class="w-full max-w-md">
          <RouterView v-slot="{ Component, route }">
            <Transition appear mode="out-in" name="slide-right">
              <KeepAlive :include="['Login']">
                <component
                  :is="Component"
                  :key="route.fullPath"
                  class="mx-auto w-full"
                />
              </KeepAlive>
            </Transition>
          </RouterView>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/**
 * 品牌面板：以主题变量 --primary 驱动整面配色，
 * 切换主题色/明暗模式时与右侧表单区一起全页变化（对齐 vben 原版行为）。
 * 亮色：主题色渐变叠在深蓝底上（多层背景，上层半透明主题色负责着色）；
 * 暗色：近黑底（#070709，同 vben 暗色介绍面板）+ 主题色光晕。
 */
.auth-brand {
  background:
    radial-gradient(
      120% 90% at 100% 0%,
      rgb(255 255 255 / 16%) 0%,
      transparent 52%
    ),
    radial-gradient(
      110% 80% at 0% 100%,
      rgb(255 255 255 / 6%) 0%,
      transparent 58%
    ),
    linear-gradient(
      158deg,
      hsl(var(--primary) / 92%) 0%,
      hsl(var(--primary) / 78%) 50%,
      hsl(var(--primary) / 62%) 100%
    ),
    linear-gradient(158deg, #123f9e 0%, #0b1c3d 100%);
}

.dark {
  .auth-brand {
    background:
      radial-gradient(
        120% 90% at 100% 0%,
        hsl(var(--primary) / 35%) 0%,
        transparent 55%
      ),
      radial-gradient(
        110% 80% at 0% 100%,
        rgb(0 0 0 / 40%) 0%,
        transparent 58%
      ),
      #070709;
  }
}

/** 装饰点阵 */
.auth-dots {
  background-image: radial-gradient(
    rgb(255 255 255 / 14%) 1px,
    transparent 1px
  );
  background-size: 26px 26px;
  mask-image: linear-gradient(to top, black, transparent 70%);
}

/** 表单进场动画：与 vben 认证页一致的右侧滑入 */
.slide-right-enter-active,
.slide-right-leave-active {
  transition:
    transform 0.35s ease-in-out,
    opacity 0.3s ease-in-out;
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}
</style>
