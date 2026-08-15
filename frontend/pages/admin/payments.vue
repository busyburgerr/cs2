<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const api = useApi()
const { money, dateTime } = useFormat()

const status = ref('')
const { data, refresh } = await useAsyncData(
  'admin-payments',
  () => api<{ payments: any[] }>(`/admin/payments${status.value ? `?status=${status.value}` : ''}`),
  { watch: [status] },
)

const paidTotal = computed(() =>
  (data.value?.payments ?? []).filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0),
)

const STATUS_STYLE: Record<string, string> = {
  PAID: 'border-green-500/40 text-green-400',
  PENDING: 'border-amber-500/40 text-amber-400',
  FAILED: 'border-red-500/40 text-red-400',
  EXPIRED: 'text-slate-500',
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-black">Платежи</h1>
      <div class="flex items-center gap-2">
        <select v-model="status" class="input w-44">
          <option value="">Все статусы</option>
          <option value="PAID">Оплачены</option>
          <option value="PENDING">Ожидают</option>
          <option value="FAILED">Ошибка</option>
          <option value="EXPIRED">Просрочены</option>
        </select>
        <button class="btn-ghost btn-sm" @click="refresh()">Обновить</button>
      </div>
    </div>

    <div class="card p-4">
      <p class="text-xs uppercase tracking-wide text-slate-500">Оплачено в выборке</p>
      <p class="mt-1 font-mono text-2xl font-bold text-green-400">{{ money(paidTotal) }}</p>
    </div>

    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Создан</th>
            <th>Игрок</th>
            <th>Сумма</th>
            <th>Провайдер</th>
            <th>ID у провайдера</th>
            <th>Статус</th>
            <th>Оплачен</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in data?.payments" :key="p.id">
            <td class="whitespace-nowrap text-slate-400">{{ dateTime(p.createdAt) }}</td>
            <td>
              <p>{{ p.user?.username }}</p>
              <p class="text-xs text-slate-500">{{ p.user?.email }}</p>
            </td>
            <td class="font-mono text-accent-400">{{ money(p.amount) }}</td>
            <td class="font-mono text-xs">{{ p.provider }}</td>
            <td class="max-w-[14rem] truncate font-mono text-xs text-slate-500">
              {{ p.providerId || '—' }}
            </td>
            <td>
              <span class="chip" :class="STATUS_STYLE[p.status]">{{ p.status }}</span>
            </td>
            <td class="whitespace-nowrap text-slate-400">{{ p.paidAt ? dateTime(p.paidAt) : '—' }}</td>
          </tr>
          <tr v-if="!data?.payments?.length">
            <td colspan="7" class="py-8 text-center text-slate-500">Платежей нет.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
