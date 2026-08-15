<script setup lang="ts">
const api = useApi()
const auth = useAuthStore()
const site = useSiteConfig()
const { money, percent } = useFormat()

const { data, pending } = await useAsyncData('cases', () => api<{ cases: any[] }>('/cases'))

const modes = computed(() => [
  {
    to: '/roulette',
    icon: 'roulette',
    title: 'Рулетка',
    text: `Красное и чёрное — x${site.value?.roulette.payoutColor ?? 2}, зелёное — x${site.value?.roulette.payoutGreen ?? 14}.`,
    accent: 'from-game-red/25 via-transparent',
    ring: 'group-hover:border-game-red/50',
    enabled: site.value?.roulette.enabled !== false,
  },
  {
    to: '/coinflip',
    icon: 'coinflip',
    title: 'Коинфлип',
    text: `Шанс ${((site.value?.coinflip.winChance ?? 0.5) * 100).toFixed(0)}%, выплата x${site.value?.coinflip.payout ?? 1.9}. Результат мгновенно.`,
    accent: 'from-accent-500/25 via-transparent',
    ring: 'group-hover:border-accent-500/50',
    enabled: site.value?.coinflip.enabled !== false,
  },
  {
    to: '/fair',
    icon: 'fair',
    title: 'Честность',
    text: 'Хеш публикуется до ставки. Любой результат пересчитывается вручную.',
    accent: 'from-game-cyan/20 via-transparent',
    ring: 'group-hover:border-game-cyan/50',
    enabled: true,
  },
])
</script>

<template>
  <div class="space-y-10">
    <!-- герой -->
    <section class="relative overflow-hidden rounded-3xl border border-white/[.07] bg-ink-900/50 px-6 py-12 sm:px-10 sm:py-14">
      <div
        class="pointer-events-none absolute inset-0 opacity-70"
        style="background: radial-gradient(75% 130% at 8% 0%, rgba(245,158,11,.2), transparent 58%), radial-gradient(60% 120% at 95% 20%, rgba(168,85,247,.16), transparent 60%)"
      />
      <div class="pointer-events-none absolute inset-0 bg-grid-fade opacity-[.35]" style="background-size: 44px 44px" />

      <div class="relative max-w-2xl">
        <span class="chip border-accent-500/30 bg-accent-500/10 text-accent-300">
          Provably fair · SHA-256
        </span>
        <h1 class="mt-4 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl">
          Открывай кейсы CS2
          <span class="block bg-gradient-to-r from-accent-300 via-accent-400 to-accent-600 bg-clip-text text-transparent">
            и проверяй каждый ролл
          </span>
        </h1>
        <p class="mt-4 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Кейсы, рулетка и коинфлип с публичными шансами. Хеш серверного сида известен
          до ставки — результат нельзя подкрутить задним числом, и вы можете это доказать.
        </p>

        <div class="mt-7 flex flex-wrap gap-3">
          <NuxtLink v-if="!auth.isLoggedIn" to="/register" class="btn-primary px-6 py-2.5 text-base">
            Начать играть
          </NuxtLink>
          <NuxtLink v-else to="/wallet" class="btn-primary px-6 py-2.5 text-base">
            Пополнить баланс
          </NuxtLink>
          <NuxtLink to="/fair" class="btn-ghost px-5 py-2.5 text-base">Как это работает</NuxtLink>
        </div>

        <dl class="mt-9 flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <dt class="eyebrow">Кейсов</dt>
            <dd class="font-mono text-xl font-black text-white">{{ data?.cases?.length ?? 0 }}</dd>
          </div>
          <div>
            <dt class="eyebrow">Открытий</dt>
            <dd class="font-mono text-xl font-black text-white">
              {{ (site?.stats.openingsCount ?? 0).toLocaleString('ru-RU') }}
            </dd>
          </div>
          <div>
            <dt class="eyebrow">Возврат при продаже</dt>
            <dd class="font-mono text-xl font-black text-white">
              {{ percent(site?.cases.sellRate ?? 0.9, 0) }}
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <LiveDrops />

    <!-- режимы -->
    <section>
      <div class="mb-4 flex items-end justify-between">
        <h2 class="section-title">Режимы игры</h2>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <NuxtLink
          v-for="mode in modes.filter((m) => m.enabled)"
          :key="mode.to"
          :to="mode.to"
          class="group relative overflow-hidden rounded-2xl border border-white/[.07] bg-ink-900/60 p-5 transition duration-200 hover:-translate-y-1"
          :class="mode.ring"
        >
          <div class="pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition group-hover:opacity-100" :class="mode.accent" />
          <div class="relative flex items-center gap-3">
            <span class="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-accent-400">
              <NavIcon :name="mode.icon" class="!h-5 !w-5" />
            </span>
            <h3 class="text-base font-bold text-white">{{ mode.title }}</h3>
          </div>
          <p class="relative mt-3 text-sm leading-relaxed text-slate-400">{{ mode.text }}</p>
          <span class="relative mt-4 inline-flex text-xs font-bold text-accent-400 opacity-0 transition group-hover:opacity-100">
            Играть →
          </span>
        </NuxtLink>
      </div>
    </section>

    <!-- кейсы -->
    <section>
      <div class="mb-4 flex items-end justify-between">
        <h2 class="section-title">Кейсы</h2>
        <span class="text-xs text-slate-500">{{ data?.cases?.length ?? 0 }} доступно</span>
      </div>

      <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="h-72 animate-pulse rounded-2xl bg-ink-900/60" />
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CaseCard v-for="c in data?.cases" :key="c.id" :case-data="c" />
      </div>

      <div v-if="!pending && !data?.cases?.length" class="card p-10 text-center text-sm text-slate-400">
        Кейсы пока не добавлены. Загляните в панель администратора.
      </div>
    </section>

    <!-- преимущества -->
    <section class="grid gap-4 sm:grid-cols-3">
      <div class="card card-hover p-5">
        <h3 class="font-bold text-white">Честность на стороне игрока</h3>
        <p class="mt-2 text-sm leading-relaxed text-slate-400">
          Результат = HMAC-SHA256(серверный сид, клиентский сид + номер броска). Сид раскрывается
          по вашему запросу — и все прошлые игры можно пересчитать.
        </p>
      </div>
      <div class="card card-hover p-5">
        <h3 class="font-bold text-white">Шансы без звёздочек</h3>
        <p class="mt-2 text-sm leading-relaxed text-slate-400">
          Вероятность каждого предмета, отдача кейса и множители игр указаны прямо в интерфейсе.
        </p>
      </div>
      <div class="card card-hover p-5">
        <h3 class="font-bold text-white">Продажа в один клик</h3>
        <p class="mt-2 text-sm leading-relaxed text-slate-400">
          Ненужный дроп продаётся обратно площадке за
          {{ percent(site?.cases.sellRate ?? 0.9, 0) }} цены — деньги сразу на балансе.
        </p>
      </div>
    </section>
  </div>
</template>
