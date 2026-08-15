<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const api = useApi()
const { money, dateTime } = useFormat()

const tab = ref<'openings' | 'transactions'>('openings')

const { data: openings } = await useAsyncData('my-openings', () =>
  api<{ openings: any[] }>('/me/openings'),
)
const { data: transactions } = await useAsyncData('my-transactions', () =>
  api<{ transactions: any[] }>('/me/transactions'),
)

const TX_LABELS: Record<string, string> = {
  DEPOSIT: 'Пополнение',
  CASE_OPEN: 'Открытие кейса',
  ITEM_SELL: 'Продажа предмета',
  ADMIN_ADJUST: 'Корректировка администратором',
  WITHDRAW: 'Вывод',
  ROULETTE_BET: 'Ставка в рулетке',
  ROULETTE_WIN: 'Выигрыш в рулетке',
  COINFLIP_BET: 'Ставка в коинфлипе',
  COINFLIP_WIN: 'Выигрыш в коинфлипе',
}

const profit = computed(() => {
  const list = openings.value?.openings ?? []
  return list.reduce((s, o) => s + (o.value - o.cost), 0)
})
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h1 class="text-2xl font-black">История</h1>
      <div class="card px-4 py-2 text-center">
        <p class="text-[11px] uppercase tracking-wide text-slate-500">Итог по открытиям</p>
        <p class="font-mono text-lg font-bold" :class="profit >= 0 ? 'text-green-400' : 'text-red-400'">
          {{ profit >= 0 ? '+' : '' }}{{ money(profit) }}
        </p>
      </div>
    </div>

    <div class="flex gap-1">
      <button
        class="rounded-lg px-3 py-1.5 text-sm"
        :class="tab === 'openings' ? 'bg-ink-800 text-slate-100' : 'text-slate-400'"
        @click="tab = 'openings'"
      >
        Открытия
      </button>
      <button
        class="rounded-lg px-3 py-1.5 text-sm"
        :class="tab === 'transactions' ? 'bg-ink-800 text-slate-100' : 'text-slate-400'"
        @click="tab = 'transactions'"
      >
        Транзакции
      </button>
    </div>

    <div v-if="tab === 'openings'" class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Кейс</th>
            <th>Предмет</th>
            <th>Потрачено</th>
            <th>Получено</th>
            <th>Ролл</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in openings?.openings" :key="o.id">
            <td class="whitespace-nowrap text-slate-400">{{ dateTime(o.createdAt) }}</td>
            <td>{{ o.case?.title }}</td>
            <td>
              <span class="font-medium" :style="{ color: rarityColor(o.item.rarity) }">
                {{ o.item.name }}
              </span>
              <span class="ml-1 text-xs text-slate-500">({{ o.item.wear }})</span>
            </td>
            <td class="font-mono text-slate-400">{{ money(o.cost) }}</td>
            <td class="font-mono" :class="o.value >= o.cost ? 'text-green-400' : 'text-slate-300'">
              {{ money(o.value) }}
            </td>
            <td class="font-mono text-xs text-slate-500">{{ o.roll }} / {{ o.totalTickets }}</td>
          </tr>
          <tr v-if="!openings?.openings?.length">
            <td colspan="6" class="py-8 text-center text-slate-500">Открытий пока нет.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Операция</th>
            <th>Сумма</th>
            <th>Баланс после</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in transactions?.transactions" :key="t.id">
            <td class="whitespace-nowrap text-slate-400">{{ dateTime(t.createdAt) }}</td>
            <td>{{ TX_LABELS[t.type] || t.type }}</td>
            <td class="font-mono" :class="t.amount >= 0 ? 'text-green-400' : 'text-red-400'">
              {{ t.amount >= 0 ? '+' : '' }}{{ money(t.amount) }}
            </td>
            <td class="font-mono text-slate-400">{{ money(t.balanceAfter) }}</td>
          </tr>
          <tr v-if="!transactions?.transactions?.length">
            <td colspan="4" class="py-8 text-center text-slate-500">Операций пока нет.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
