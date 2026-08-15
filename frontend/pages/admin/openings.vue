<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const api = useApi()
const { money, dateTime } = useFormat()

const { data: cases } = await useAsyncData('admin-cases-filter', () =>
  api<{ cases: any[] }>('/admin/cases'),
)

const caseId = ref('')
const { data, refresh } = await useAsyncData(
  'admin-openings',
  () => api<{ openings: any[] }>(`/admin/openings?limit=200${caseId.value ? `&caseId=${caseId.value}` : ''}`),
  { watch: [caseId] },
)

const totals = computed(() => {
  const list = data.value?.openings ?? []
  const wagered = list.reduce((s, o) => s + o.cost, 0)
  const returned = list.reduce((s, o) => s + o.value, 0)
  return { wagered, returned, margin: wagered ? (wagered - returned) / wagered : 0 }
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-black">Открытия</h1>
      <div class="flex items-center gap-2">
        <select v-model="caseId" class="input w-56">
          <option value="">Все кейсы</option>
          <option v-for="c in cases?.cases" :key="c.id" :value="c.id">{{ c.title }}</option>
        </select>
        <button class="btn-ghost btn-sm" @click="refresh()">Обновить</button>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Оборот (в выборке)</p>
        <p class="mt-1 font-mono text-xl font-bold">{{ money(totals.wagered) }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Выплачено предметами</p>
        <p class="mt-1 font-mono text-xl font-bold text-slate-300">{{ money(totals.returned) }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wide text-slate-500">Фактическая маржа</p>
        <p class="mt-1 font-mono text-xl font-bold text-accent-400">
          {{ (totals.margin * 100).toFixed(1) }}%
        </p>
      </div>
    </div>

    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Время</th>
            <th>Игрок</th>
            <th>Кейс</th>
            <th>Предмет</th>
            <th>Списано</th>
            <th>Выдано</th>
            <th>Билет</th>
            <th>Nonce</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in data?.openings" :key="o.id">
            <td class="whitespace-nowrap text-slate-400">{{ dateTime(o.createdAt) }}</td>
            <td>{{ o.user?.username }}</td>
            <td class="text-slate-400">{{ o.case?.title }}</td>
            <td :style="{ color: rarityColor(o.item.rarity) }">{{ o.item.name }}</td>
            <td class="font-mono text-slate-400">{{ money(o.cost) }}</td>
            <td class="font-mono" :class="o.value >= o.cost ? 'text-red-400' : 'text-green-400'">
              {{ money(o.value) }}
            </td>
            <td class="font-mono text-xs text-slate-500">{{ o.roll }} / {{ o.totalTickets }}</td>
            <td class="font-mono text-xs text-slate-500">{{ o.nonce }}</td>
          </tr>
          <tr v-if="!data?.openings?.length">
            <td colspan="8" class="py-8 text-center text-slate-500">Открытий нет.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
