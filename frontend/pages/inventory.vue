<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const api = useApi()
const auth = useAuthStore()
const { money, percent } = useFormat()

const status = ref<'IN_INVENTORY' | 'SOLD'>('IN_INVENTORY')
const busyId = ref<string | null>(null)
const error = ref('')

const { data, refresh, pending } = await useAsyncData(
  'inventory',
  () => api<{ items: any[]; sellRate: number }>(`/me/inventory?status=${status.value}`),
  { watch: [status] },
)

const items = computed(() => data.value?.items ?? [])
const totalValue = computed(() => items.value.reduce((s, i) => s + i.item.price, 0))

async function sell(inv: any) {
  busyId.value = inv.id
  error.value = ''
  try {
    const res = await api<{ balance: number }>(`/me/inventory/${inv.id}/sell`, { method: 'POST' })
    auth.setBalance(res.balance)
    await refresh()
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    busyId.value = null
  }
}

async function sellAll() {
  for (const inv of [...items.value]) await sell(inv)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-black">Инвентарь</h1>
        <p class="mt-1 text-sm text-slate-400">
          Продажа возвращает {{ percent(data?.sellRate ?? 0.9, 0) }} от рыночной цены предмета.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <div class="card px-4 py-2 text-center">
          <p class="text-[11px] uppercase tracking-wide text-slate-500">Стоимость</p>
          <p class="font-mono text-lg font-bold text-accent-400">{{ money(totalValue) }}</p>
        </div>
        <button
          v-if="status === 'IN_INVENTORY' && items.length"
          class="btn-ghost"
          :disabled="!!busyId"
          @click="sellAll"
        >
          Продать всё
        </button>
      </div>
    </div>

    <div class="flex gap-1">
      <button
        class="btn-sm rounded-lg px-3 py-1.5 text-sm"
        :class="status === 'IN_INVENTORY' ? 'bg-ink-800 text-slate-100' : 'text-slate-400'"
        @click="status = 'IN_INVENTORY'"
      >
        В инвентаре
      </button>
      <button
        class="btn-sm rounded-lg px-3 py-1.5 text-sm"
        :class="status === 'SOLD' ? 'bg-ink-800 text-slate-100' : 'text-slate-400'"
        @click="status = 'SOLD'"
      >
        Проданные
      </button>
    </div>

    <p v-if="error" class="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
      {{ error }}
    </p>

    <div v-if="pending" class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      <div v-for="i in 6" :key="i" class="h-56 animate-pulse rounded-xl bg-ink-900/70" />
    </div>

    <div v-else-if="items.length" class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      <ItemCard v-for="inv in items" :key="inv.id" :item="inv.item" compact>
        <template #footer>
          <button
            v-if="status === 'IN_INVENTORY'"
            class="btn-ghost btn-sm mt-2 w-full"
            :disabled="busyId === inv.id"
            @click="sell(inv)"
          >
            Продать за {{ money(inv.sellPrice) }}
          </button>
          <p v-else class="mt-2 text-center text-[11px] text-slate-500">
            продано за {{ money(inv.soldPrice) }}
          </p>
        </template>
      </ItemCard>
    </div>

    <div v-else class="card p-10 text-center">
      <p class="text-sm text-slate-400">
        {{ status === 'IN_INVENTORY' ? 'Инвентарь пуст.' : 'Вы ещё ничего не продавали.' }}
      </p>
      <NuxtLink to="/" class="btn-primary mt-4">Открыть кейс</NuxtLink>
    </div>
  </div>
</template>
