<script setup lang="ts">
const api = useApi()
const auth = useAuthStore()
const toast = useToast()
const { money } = useFormat()

const state = ref<any>(null)
const error = ref('')
const betting = ref<string | null>(null)
const amount = ref(100)
const now = ref(Date.now())
let clockOffset = 0
let poller: ReturnType<typeof setInterval> | undefined
let ticker: ReturnType<typeof setInterval> | undefined
let lastSettledNumber: number | null = null

const COLORS = [
  { key: 'RED', label: 'Красное', klass: 'from-[#f05061] to-[#b4212f]', border: 'border-game-red/50' },
  { key: 'GREEN', label: 'Зелёное', klass: 'from-[#22d17c] to-[#0d8f4c]', border: 'border-game-green/50' },
  { key: 'BLACK', label: 'Чёрное', klass: 'from-[#2a3145] to-[#141822]', border: 'border-white/20' },
]

const config = computed(() => state.value?.config)
const round = computed(() => state.value?.round)
const phase = computed(() => round.value?.phase ?? 'BETTING')

const payoutFor = (color: string) =>
  color === 'GREEN' ? (config.value?.payoutGreen ?? 14) : (config.value?.payoutColor ?? 2)

const secondsLeft = computed(() => {
  if (!round.value) return 0
  const target =
    phase.value === 'BETTING'
      ? new Date(round.value.bettingEndsAt).getTime()
      : new Date(round.value.spinEndsAt).getTime()
  return Math.max(0, (target - (now.value - clockOffset)) / 1000)
})

const bettingProgress = computed(() => {
  if (!round.value || phase.value !== 'BETTING' || !config.value) return 0
  return Math.min(100, (secondsLeft.value / config.value.bettingSeconds) * 100)
})

async function refresh() {
  try {
    const data = await api<any>('/roulette/state')
    clockOffset = Date.now() - new Date(data.serverTime).getTime()

    // Раунд закрылся — показываем итог по своим ставкам.
    const settled = data.history?.[0]
    const previous = state.value
    if (settled && lastSettledNumber !== null && settled.number !== lastSettledNumber) {
      const myBets = previous?.myBets ?? {}
      const staked = Object.values(myBets).reduce((sum: number, v: any) => sum + v, 0) as number
      if (staked > 0) {
        const won = (myBets[settled.color] ?? 0) * payoutFor(settled.color)
        if (won > 0) toast.win(`Выигрыш ${money(Math.round(won))}`, `Раунд #${settled.number}`)
        else toast.lose(`Проигрыш ${money(staked)}`, `Раунд #${settled.number}`)
        await auth.fetchMe()
      }
    }
    if (settled) lastSettledNumber = settled.number

    state.value = data
  } catch (err: any) {
    error.value = apiError(err)
  }
}

async function bet(color: string) {
  if (!auth.isLoggedIn) return navigateTo('/login?redirect=/roulette')
  if (phase.value !== 'BETTING') return
  betting.value = color
  error.value = ''
  try {
    const res = await api<{ balance: number }>('/roulette/bet', {
      method: 'POST',
      body: { color, amount: Math.round(amount.value) },
    })
    auth.setBalance(res.balance)
    await refresh()
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    betting.value = null
  }
}

const quick = [
  { label: '+1', value: 100 },
  { label: '+5', value: 500 },
  { label: '+25', value: 2500 },
  { label: '+100', value: 10000 },
]

function addAmount(value: number) {
  amount.value = Math.min(config.value?.maxBet ?? 50000, amount.value + value)
}
function halve() {
  amount.value = Math.max(config.value?.minBet ?? 100, Math.round(amount.value / 2))
}
function double() {
  amount.value = Math.min(config.value?.maxBet ?? 50000, amount.value * 2)
}
function maxBet() {
  amount.value = Math.max(
    config.value?.minBet ?? 100,
    Math.min(config.value?.maxBet ?? 50000, auth.balance),
  )
}

// Состояние раунда живое (таймер, ставки), поэтому грузим его только в браузере:
// на сервере разметка была бы уже неактуальной и ломала бы гидрацию.
onMounted(async () => {
  await refresh()
  poller = setInterval(refresh, 1000)
  ticker = setInterval(() => (now.value = Date.now()), 100)
})
onUnmounted(() => {
  clearInterval(poller)
  clearInterval(ticker)
})

useHead({ title: 'Рулетка — CS2 Cases' })
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="eyebrow">Игра против площадки</p>
        <h1 class="text-3xl font-black tracking-tight">Рулетка</h1>
      </div>
      <div v-if="round" class="flex items-center gap-2">
        <div class="panel px-4 py-2 text-center">
          <p class="eyebrow">Раунд</p>
          <p class="font-mono text-lg font-black">#{{ round.number }}</p>
        </div>
        <div class="panel px-4 py-2 text-center">
          <p class="eyebrow">{{ phase === 'BETTING' ? 'Ставки до' : 'Результат через' }}</p>
          <p class="font-mono text-lg font-black" :class="phase === 'BETTING' ? 'text-accent-400' : 'text-slate-300'">
            {{ secondsLeft.toFixed(1) }}с
          </p>
        </div>
      </div>
    </div>

    <div v-if="!state" class="space-y-4">
      <div class="h-28 animate-pulse rounded-2xl bg-ink-900/60" />
      <div class="h-20 animate-pulse rounded-2xl bg-ink-900/60" />
      <div class="grid gap-4 md:grid-cols-3">
        <div v-for="i in 3" :key="i" class="h-52 animate-pulse rounded-2xl bg-ink-900/60" />
      </div>
    </div>

    <div v-else-if="!state.enabled" class="card p-10 text-center">
      <p class="text-lg font-bold">Рулетка временно отключена</p>
      <p class="mt-1 text-sm text-slate-400">Загляните позже или попробуйте другие режимы.</p>
      <NuxtLink to="/" class="btn-primary mt-5">К кейсам</NuxtLink>
    </div>

    <template v-else>
      <!-- колесо -->
      <div class="card overflow-hidden p-3">
        <RouletteWheel
          v-if="state?.wheel?.length"
          :wheel="state.wheel"
          :slot="round?.slot ?? null"
          :phase="phase"
          :spin-seconds="config?.spinSeconds ?? 7"
        />

        <div class="mt-3 h-1 overflow-hidden rounded-full bg-white/[.06]">
          <div
            class="h-full rounded-full bg-gradient-to-r from-accent-300 to-accent-600 transition-[width] duration-100 ease-linear"
            :style="{ width: `${bettingProgress}%` }"
          />
        </div>

        <!-- история -->
        <div class="mt-3 flex items-center gap-2 overflow-x-auto">
          <span class="eyebrow shrink-0">Прошлые</span>
          <span
            v-for="h in state?.history"
            :key="h.id"
            class="grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-black"
            :class="{
              'bg-gradient-to-b from-[#f05061] to-[#b4212f] text-white': h.color === 'RED',
              'bg-gradient-to-b from-[#2a3145] to-[#141822] text-slate-300': h.color === 'BLACK',
              'bg-gradient-to-b from-[#22d17c] to-[#0d8f4c] text-white': h.color === 'GREEN',
            }"
            :title="`Раунд #${h.number}`"
          >
            {{ h.slot }}
          </span>
        </div>
      </div>

      <!-- сумма ставки -->
      <div class="card flex flex-wrap items-end gap-3 p-4">
        <div class="min-w-[12rem] flex-1">
          <label class="label">Сумма ставки</label>
          <input
            class="input font-mono text-lg"
            type="number"
            :min="(config?.minBet ?? 100) / 100"
            :max="(config?.maxBet ?? 50000) / 100"
            step="0.01"
            :value="(amount / 100).toFixed(2)"
            @input="amount = Math.round(Number(($event.target as HTMLInputElement).value) * 100)"
          />
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="q in quick" :key="q.label" class="btn-ghost btn-sm" @click="addAmount(q.value)">
            {{ q.label }}
          </button>
          <button class="btn-ghost btn-sm" @click="halve">½</button>
          <button class="btn-ghost btn-sm" @click="double">x2</button>
          <button class="btn-ghost btn-sm" @click="maxBet">Макс</button>
        </div>
        <p class="ml-auto text-xs text-slate-500">
          Лимиты: {{ money(config?.minBet ?? 0) }} — {{ money(config?.maxBet ?? 0) }}
        </p>
      </div>

      <p v-if="error" class="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
        {{ error }}
      </p>

      <!-- ставки по цветам -->
      <div class="grid gap-4 md:grid-cols-3">
        <div
          v-for="col in COLORS"
          :key="col.key"
          class="card overflow-hidden p-4 transition"
          :class="state?.myBets?.[col.key] ? `!border-white/20 ${col.border}` : ''"
        >
          <button
            class="relative w-full overflow-hidden rounded-xl bg-gradient-to-b py-3 text-center font-black text-white transition
                   hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            :class="col.klass"
            :disabled="phase !== 'BETTING' || betting !== null"
            @click="bet(col.key)"
          >
            <span class="text-base">{{ col.label }}</span>
            <span class="ml-2 font-mono text-sm opacity-90">x{{ payoutFor(col.key) }}</span>
          </button>

          <div class="mt-3 flex items-center justify-between text-sm">
            <span class="text-slate-400">В банке</span>
            <span class="money">{{ money(state?.totals?.[col.key] ?? 0) }}</span>
          </div>
          <div class="mt-1 flex items-center justify-between text-sm">
            <span class="text-slate-400">Ваша ставка</span>
            <span :class="state?.myBets?.[col.key] ? 'money-up' : 'font-mono text-slate-500'">
              {{ money(state?.myBets?.[col.key] ?? 0) }}
            </span>
          </div>

          <div class="mt-3 max-h-40 space-y-1 overflow-y-auto pr-1">
            <div
              v-for="b in state?.bets?.filter((x: any) => x.color === col.key)"
              :key="b.id"
              class="flex items-center justify-between rounded-lg bg-white/[.03] px-2 py-1 text-xs"
              :class="b.mine ? 'ring-1 ring-accent-500/40' : ''"
            >
              <span class="truncate text-slate-400">{{ b.username }}</span>
              <span class="font-mono text-slate-300">{{ money(b.amount) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- честность -->
      <div class="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-xs text-slate-500">
        <span class="eyebrow">Честность раунда</span>
        <span class="font-mono">
          хеш сида:
          <span class="text-slate-300">{{ round?.serverHash?.slice(0, 32) }}…</span>
        </span>
        <span class="font-mono">секторов: {{ round?.totalSlots }}</span>
        <NuxtLink to="/fair" class="ml-auto text-accent-400 hover:underline">Как проверить →</NuxtLink>
      </div>
    </template>
  </div>
</template>
