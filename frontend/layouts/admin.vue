<script setup lang="ts">
const auth = useAuthStore()

const nav = [
  { to: '/admin', label: 'Дашборд', exact: true },
  { to: '/admin/economy', label: 'Экономика' },
  { to: '/admin/cases', label: 'Кейсы' },
  { to: '/admin/items', label: 'Предметы' },
  { to: '/admin/users', label: 'Пользователи' },
  { to: '/admin/openings', label: 'Открытия' },
  { to: '/admin/payments', label: 'Платежи' },
]
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b border-ink-800 bg-ink-950/90 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-[1500px] items-center gap-3 px-4">
        <NuxtLink to="/admin" class="flex items-center gap-2 font-black">
          <span class="grid h-7 w-7 place-items-center rounded-md bg-red-500 text-xs text-ink-950">AD</span>
          <span>Админ-панель</span>
        </NuxtLink>
        <span class="chip ml-2 hidden sm:inline-flex">{{ auth.user?.username }}</span>
        <div class="ml-auto flex items-center gap-2">
          <NuxtLink to="/" class="btn-ghost btn-sm">На сайт</NuxtLink>
          <button class="btn-ghost btn-sm text-red-400" @click="auth.logout()">Выйти</button>
        </div>
      </div>
    </header>

    <div class="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-4 px-4 py-5 lg:flex-row">
      <aside class="lg:w-52 lg:shrink-0">
        <nav class="flex gap-1 overflow-x-auto lg:flex-col">
          <NuxtLink
            v-for="link in nav"
            :key="link.to"
            :to="link.to"
            class="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-ink-850 hover:text-slate-100"
            :exact-active-class="link.exact ? '!bg-ink-800 !text-accent-400' : undefined"
            :active-class="link.exact ? undefined : '!bg-ink-800 !text-accent-400'"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </aside>

      <main class="min-w-0 flex-1">
        <slot />
      </main>
    </div>
  </div>
</template>
