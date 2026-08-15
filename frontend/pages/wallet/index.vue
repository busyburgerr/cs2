<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const api = useApi()
const auth = useAuthStore()
const route = useRoute()
const { money } = useFormat()

const { data: cfg } = await useAsyncData('pay-config', () =>
  api<{ provider: string; currency: string; minDeposit: number; maxDeposit: number }>('/payments/config'),
)

const presets = [500, 1000, 2500, 5000, 10000, 25000]
const amount = ref(1000)
const loading = ref(false)
const error = ref('')

const valid = computed(
  () =>
    cfg.value &&
    Number.isFinite(amount.value) &&
    amount.value >= cfg.value.minDeposit &&
    amount.value <= cfg.value.maxDeposit,
)

async function deposit() {
  if (!valid.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await api<{ checkoutUrl: string }>('/payments/deposit', {
      method: 'POST',
      body: { amount: Math.round(amount.value) },
    })
    // mock-провайдер возвращает внутренний адрес, stripe — внешний.
    if (res.checkoutUrl.startsWith(window.location.origin)) {
      await navigateTo(res.checkoutUrl.slice(window.location.origin.length))
    } else {
      await navigateTo(res.checkoutUrl, { external: true })
    }
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-5">
    <div class="card p-6">
      <p class="text-xs uppercase tracking-wide text-slate-500">Текущий баланс</p>
      <p class="mt-1 font-mono text-4xl font-black text-accent-400">{{ money(auth.balance) }}</p>
    </div>

    <div v-if="route.query.status === 'success'" class="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">
      Платёж принят. Баланс обновится сразу после подтверждения от платёжной системы.
    </div>
    <div v-else-if="route.query.status === 'cancel'" class="rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-slate-400">
      Оплата отменена.
    </div>

    <div class="card p-6">
      <h1 class="text-xl font-bold">Пополнение баланса</h1>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <button
          v-for="p in presets"
          :key="p"
          class="rounded-lg border py-2 font-mono text-sm font-bold transition"
          :class="
            amount === p
              ? 'border-accent-500 bg-accent-500/15 text-accent-400'
              : 'border-ink-700 bg-ink-850 text-slate-300 hover:border-ink-600'
          "
          @click="amount = p"
        >
          {{ money(p) }}
        </button>
      </div>

      <div class="mt-4">
        <label class="label" for="amount">Своя сумма</label>
        <div class="flex items-center gap-2">
          <input
            id="amount"
            class="input font-mono"
            type="number"
            :min="(cfg?.minDeposit ?? 500) / 100"
            :max="(cfg?.maxDeposit ?? 100000) / 100"
            step="0.01"
            :value="(amount / 100).toFixed(2)"
            @input="amount = Math.round(Number(($event.target as HTMLInputElement).value) * 100)"
          />
          <span class="text-sm text-slate-500">{{ cfg?.currency }}</span>
        </div>
        <p class="mt-1 text-xs text-slate-500">
          От {{ money(cfg?.minDeposit ?? 0) }} до {{ money(cfg?.maxDeposit ?? 0) }} за одну операцию.
        </p>
      </div>

      <p v-if="error" class="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        {{ error }}
      </p>

      <button class="btn-primary mt-5 w-full py-2.5" :disabled="!valid || loading" @click="deposit">
        {{ loading ? 'Создаём платёж...' : `Пополнить на ${money(amount)}` }}
      </button>

      <p class="mt-3 text-center text-xs text-slate-500">
        Платёжный провайдер: <span class="font-mono">{{ cfg?.provider }}</span>
        <span v-if="cfg?.provider === 'mock'" class="text-amber-400">
          — тестовый режим, реальные деньги не списываются
        </span>
      </p>
    </div>

    <div class="card p-5 text-xs leading-relaxed text-slate-500">
      Средства на балансе используются только для открытия кейсов внутри площадки.
      Открытие кейса — необратимая операция: списанные деньги не возвращаются,
      а выпавший предмет можно продать обратно по текущей цене.
    </div>
  </div>
</template>
