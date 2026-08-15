<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const api = useApi()
const { money, percent, dateTime } = useFormat()

const { data, refresh } = await useAsyncData('admin-stats', () => api<any>('/admin/stats'))

const chartMax = computed(() =>
  Math.max(1, ...(data.value?.chart ?? []).map((d: any) => Math.max(d.wagered, d.returned))),
)
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-black">Дашборд</h1>
      <button class="btn-ghost btn-sm" @click="refresh()">Обновить</button>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Пользователи</p>
        <p class="mt-1 font-mono text-2xl font-bold">{{ data?.usersCount }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Пополнено</p>
        <p class="mt-1 font-mono text-2xl font-bold text-green-400">{{ money(data?.depositsTotal) }}</p>
        <p class="text-xs text-slate-500">{{ data?.depositsCount }} платежей</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Открытий</p>
        <p class="mt-1 font-mono text-2xl font-bold">{{ data?.openingsCount }}</p>
        <p class="text-xs text-slate-500">оборот {{ money(data?.wagered) }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Маржа (GGR)</p>
        <p class="mt-1 font-mono text-2xl font-bold text-accent-400">{{ money(data?.totalGgr) }}</p>
        <p class="text-xs text-slate-500">кейсы {{ percent(data?.ggrMargin ?? 0, 1) }}</p>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Кейсы</p>
        <p class="mt-1 font-mono text-xl font-bold text-accent-400">{{ money(data?.ggr) }}</p>
        <p class="text-xs text-slate-500">
          оборот {{ money(data?.wagered) }} · маржа {{ percent(data?.ggrMargin ?? 0, 1) }}
        </p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Рулетка</p>
        <p class="mt-1 font-mono text-xl font-bold text-accent-400">{{ money(data?.games?.roulette?.ggr) }}</p>
        <p class="text-xs text-slate-500">
          ставок {{ data?.games?.roulette?.rounds ?? 0 }} · оборот {{ money(data?.games?.roulette?.wagered) }} ·
          маржа {{ percent(data?.games?.roulette?.margin ?? 0, 1) }}
        </p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Коинфлип</p>
        <p class="mt-1 font-mono text-xl font-bold text-accent-400">{{ money(data?.games?.coinflip?.ggr) }}</p>
        <p class="text-xs text-slate-500">
          бросков {{ data?.games?.coinflip?.rounds ?? 0 }} · оборот {{ money(data?.games?.coinflip?.wagered) }} ·
          маржа {{ percent(data?.games?.coinflip?.margin ?? 0, 1) }}
        </p>
      </div>
    </div>

    <section class="card p-5">
      <h2 class="text-sm font-bold uppercase tracking-wide text-slate-400">
        Оборот и выплаты, 14 дней
      </h2>
      <div class="mt-4 flex h-48 items-end gap-1">
        <div v-for="day in data?.chart" :key="day.date" class="group relative flex-1">
          <div class="flex h-40 items-end justify-center gap-[2px]">
            <div
              class="w-1/2 rounded-t bg-accent-500/80"
              :style="{ height: `${(day.wagered / chartMax) * 100}%` }"
            />
            <div
              class="w-1/2 rounded-t bg-slate-600"
              :style="{ height: `${(day.returned / chartMax) * 100}%` }"
            />
          </div>
          <p class="mt-1 text-center text-[9px] text-slate-600">{{ day.date.slice(5) }}</p>

          <div
            class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2
                   whitespace-nowrap rounded border border-ink-700 bg-ink-900 px-2 py-1 text-[11px] group-hover:block"
          >
            <p>{{ day.opens }} открытий</p>
            <p class="text-accent-400">оборот {{ money(day.wagered) }}</p>
            <p class="text-slate-400">выплаты {{ money(day.returned) }}</p>
          </div>
        </div>
      </div>
      <div class="mt-3 flex gap-4 text-xs text-slate-500">
        <span class="flex items-center gap-1"><i class="h-2 w-2 rounded-sm bg-accent-500" /> оборот</span>
        <span class="flex items-center gap-1"><i class="h-2 w-2 rounded-sm bg-slate-600" /> выплаты</span>
      </div>
    </section>

    <section>
      <h2 class="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">Последние дропы</h2>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Время</th>
              <th>Игрок</th>
              <th>Кейс</th>
              <th>Предмет</th>
              <th>Цена кейса</th>
              <th>Стоимость дропа</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in data?.recentOpenings" :key="o.id">
              <td class="whitespace-nowrap text-slate-400">{{ dateTime(o.createdAt) }}</td>
              <td>{{ o.user?.username }}</td>
              <td class="text-slate-400">{{ o.case?.title }}</td>
              <td :style="{ color: rarityColor(o.item.rarity) }">{{ o.item.name }}</td>
              <td class="font-mono text-slate-400">{{ money(o.cost) }}</td>
              <td class="font-mono" :class="o.value >= o.cost ? 'text-red-400' : 'text-green-400'">
                {{ money(o.value) }}
              </td>
            </tr>
            <tr v-if="!data?.recentOpenings?.length">
              <td colspan="6" class="py-8 text-center text-slate-500">Открытий пока нет.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
