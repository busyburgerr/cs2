<script setup lang="ts">
const auth = useAuthStore()
const site = useSiteConfig()
const { money } = useFormat()
const route = useRoute()
const menuOpen = ref(false)

watch(() => route.fullPath, () => (menuOpen.value = false))

const nav = computed(() => [
  { to: '/', label: 'Кейсы', icon: 'cases' },
  ...(site.value?.roulette?.enabled !== false
    ? [{ to: '/roulette', label: 'Рулетка', icon: 'roulette' }]
    : []),
  ...(site.value?.coinflip?.enabled !== false
    ? [{ to: '/coinflip', label: 'Коинфлип', icon: 'coinflip' }]
    : []),
  { to: '/inventory', label: 'Инвентарь', icon: 'inventory' },
  { to: '/fair', label: 'Честность', icon: 'fair' },
])
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-40 border-b border-white/[.06] bg-ink-975/80 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <NuxtLink to="/" class="group flex items-center gap-2.5">
          <span
            class="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl text-sm font-black text-ink-950"
            style="background-image: linear-gradient(135deg, #ffd08a, #f59e0b 55%, #d97706)"
          >
            CS
            <span class="absolute inset-0 animate-shine bg-white/30" style="width: 40%" />
          </span>
          <span class="hidden text-lg font-black tracking-tight sm:block">
            CS2<span class="text-accent-400">Cases</span>
          </span>
        </NuxtLink>

        <nav class="ml-3 hidden items-center gap-0.5 lg:flex">
          <NuxtLink
            v-for="link in nav"
            :key="link.to"
            :to="link.to"
            class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-400 transition hover:bg-white/[.05] hover:text-slate-100"
            active-class="!bg-white/[.07] !text-accent-400"
          >
            <NavIcon :name="link.icon" />
            {{ link.label }}
          </NuxtLink>
        </nav>

        <div class="ml-auto flex items-center gap-2">
          <template v-if="auth.isLoggedIn">
            <NuxtLink
              to="/wallet"
              class="group flex items-center gap-2 rounded-xl border py-1.5 pl-3 pr-1.5 transition"
              :class="
                auth.user?.demo
                  ? 'border-amber-400/40 bg-amber-500/10 hover:border-amber-400/70'
                  : 'border-white/[.08] bg-white/[.04] hover:border-accent-500/40'
              "
            >
              <span v-if="auth.user?.demo" class="text-[10px] font-black text-amber-300">ДЕМО</span>
              <span class="money text-sm">{{ money(auth.balance) }}</span>
              <span
                class="grid h-6 w-6 place-items-center rounded-lg text-sm font-black text-ink-950 transition group-hover:scale-105"
                style="background-image: linear-gradient(135deg, #ffd08a, #f59e0b)"
              >
                +
              </span>
            </NuxtLink>

            <div class="relative">
              <button class="btn-ghost" @click="menuOpen = !menuOpen">
                <span class="max-w-[7rem] truncate">{{ auth.user?.username }}</span>
                <span class="text-[10px] text-slate-500">▼</span>
              </button>
              <div v-if="menuOpen" class="card absolute right-0 z-50 mt-2 w-56 overflow-hidden p-1.5">
                <NuxtLink to="/profile" class="block rounded-lg px-3 py-2 text-sm hover:bg-white/[.06]">
                  Профиль
                </NuxtLink>
                <NuxtLink to="/inventory" class="block rounded-lg px-3 py-2 text-sm hover:bg-white/[.06]">
                  Инвентарь
                </NuxtLink>
                <NuxtLink to="/history" class="block rounded-lg px-3 py-2 text-sm hover:bg-white/[.06]">
                  История и транзакции
                </NuxtLink>
                <NuxtLink to="/fair" class="block rounded-lg px-3 py-2 text-sm hover:bg-white/[.06]">
                  Проверка честности
                </NuxtLink>
                <NuxtLink
                  v-if="auth.isAdmin"
                  to="/admin"
                  class="block rounded-lg px-3 py-2 text-sm font-semibold text-accent-400 hover:bg-white/[.06]"
                >
                  Панель администратора
                </NuxtLink>
                <button
                  class="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-white/[.06]"
                  @click="auth.logout()"
                >
                  Выйти
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <NuxtLink to="/login" class="btn-ghost">Вход</NuxtLink>
            <NuxtLink to="/register" class="btn-primary">Регистрация</NuxtLink>
          </template>
        </div>
      </div>

      <nav class="flex gap-1 overflow-x-auto border-t border-white/[.05] px-4 py-2 lg:hidden">
        <NuxtLink
          v-for="link in nav"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400"
          active-class="!bg-white/[.07] !text-accent-400"
        >
          <NavIcon :name="link.icon" />
          {{ link.label }}
        </NuxtLink>
      </nav>
    </header>

    <DemoBanner />

    <main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <slot />
    </main>

    <AppToasts />

    <footer class="mt-10 border-t border-white/[.06] bg-ink-975/60">
      <div class="mx-auto max-w-7xl px-4 py-8 text-xs leading-relaxed text-slate-500">
        <div class="flex flex-wrap items-center gap-3">
          <span class="rounded-lg border border-red-500/40 px-2 py-0.5 font-bold text-red-400">18+</span>
          <NuxtLink to="/fair" class="transition hover:text-slate-300">Provably fair</NuxtLink>
          <span class="text-ink-600">•</span>
          <span>Не связано с Valve Corporation. CS2 и все скины — товарные знаки Valve.</span>
        </div>
        <p class="mt-3 max-w-3xl">
          Открытие кейсов и ставки — развлечение с элементом случайности и риском потерять деньги.
          Играйте только на суммы, которые готовы потерять. Если игра перестала быть развлечением —
          остановитесь и обратитесь за помощью.
        </p>
      </div>
    </footer>
  </div>
</template>
