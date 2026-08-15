<script setup lang="ts">
const api = useApi()
const auth = useAuthStore()
const toast = useToast()
const { money, percent, timeAgo } = useFormat()

const { data: config } = await useAsyncData('coinflip-config', () =>
  api<{
    enabled: boolean
    winChance: number
    payout: number
    minBet: number
    maxBet: number
  }>('/coinflip/config'),
)

const { data: feed, refresh: refreshFeed } = await useAsyncData('coinflip-feed', () =>
  api<{ games: any[] }>('/coinflip/feed'),
)

const side = ref<'HEADS' | 'TAILS'>('HEADS')
const amount = ref(100)
const flipping = ref(false)
const result = ref<any>(null)
const error = ref('')

const rtp = computed(() => (config.value ? config.value.winChance * config.value.payout : 0))
const potentialWin = computed(() => Math.round(amount.value * (config.value?.payout ?? 1.9)))
const canPlay = computed(
  () =>
    auth.isLoggedIn &&
    amount.value >= (config.value?.minBet ?? 100) &&
    amount.value <= (config.value?.maxBet ?? 50000) &&
    amount.value <= auth.balance,
)

async function play() {
  if (!auth.isLoggedIn) return navigateTo('/login?redirect=/coinflip')
  if (flipping.value || !canPlay.value) return

  flipping.value = true
  error.value = ''
  result.value = null

  try {
    const res = await api<{ balance: number; game: any }>('/coinflip/play', {
      method: 'POST',
      body: { side: side.value, amount: Math.round(amount.value) },
    })

    // Даём монете докрутиться, только потом раскрываем результат.
    await new Promise((resolve) => setTimeout(resolve, 1600))

    result.value = res.game
    auth.setBalance(res.balance)
    if (res.game.win) toast.win(`Выигрыш ${money(res.game.payout)}`, `x${res.game.multiplier}`)
    else toast.lose(`Проигрыш ${money(res.game.amount)}`, 'Повезёт в следующий раз')
    await refreshFeed()
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    flipping.value = false
  }
}

const quick = [
  { label: '+1', value: 100 },
  { label: '+5', value: 500 },
  { label: '+25', value: 2500 },
]
function addAmount(v: number) {
  amount.value = Math.min(config.value?.maxBet ?? 50000, amount.value + v)
}
function maxBet() {
  amount.value = Math.max(
    config.value?.minBet ?? 100,
    Math.min(config.value?.maxBet ?? 50000, auth.balance),
  )
}

useHead({ title: 'Коинфлип — CS2 Cases' })
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="eyebrow">Игра против площадки</p>
        <h1 class="text-3xl font-black tracking-tight">Коинфлип</h1>
      </div>
      <div class="flex gap-2">
        <div class="panel px-4 py-2 text-center">
          <p class="eyebrow">Шанс</p>
          <p class="font-mono text-lg font-black">{{ percent(config?.winChance ?? 0.5, 0) }}</p>
        </div>
        <div class="panel px-4 py-2 text-center">
          <p class="eyebrow">Выплата</p>
          <p class="font-mono text-lg font-black text-accent-400">x{{ config?.payout ?? 1.9 }}</p>
        </div>
        <div class="panel px-4 py-2 text-center">
          <p class="eyebrow">Отдача</p>
          <p class="font-mono text-lg font-black">{{ percent(rtp, 1) }}</p>
        </div>
      </div>
    </div>

    <div v-if="config && !config.enabled" class="card p-10 text-center">
      <p class="text-lg font-bold">Коинфлип временно отключён</p>
      <NuxtLink to="/" class="btn-primary mt-5">К кейсам</NuxtLink>
    </div>

    <template v-else>
      <div class="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <!-- монета и ставка -->
        <div class="card relative overflow-hidden p-6">
          <div
            class="pointer-events-none absolute inset-0 opacity-60"
            style="background: radial-gradient(60% 70% at 50% 0%, rgba(245,158,11,.14), transparent 65%)"
          />

          <div class="relative flex flex-col items-center">
            <!-- монета -->
            <div class="grid h-40 w-40 place-items-center" style="perspective: 800px">
              <div
                class="grid h-32 w-32 place-items-center rounded-full border-4 text-3xl font-black shadow-[0_18px_50px_-18px_rgba(0,0,0,.9)]"
                :class="[
                  flipping ? 'animate-[coin-flip_1.6s_cubic-bezier(.2,.7,.3,1)_forwards]' : '',
                  result
                    ? result.win
                      ? 'border-emerald-300/60 text-emerald-950'
                      : 'border-red-300/50 text-red-950'
                    : 'border-accent-300/60 text-ink-950',
                ]"
                :style="{
                  backgroundImage: result
                    ? result.win
                      ? 'linear-gradient(135deg,#6ee7b7,#059669)'
                      : 'linear-gradient(135deg,#fca5a5,#b91c1c)'
                    : 'linear-gradient(135deg,#ffd08a,#d97706)',
                }"
              >
                {{ result ? (result.result === 'HEADS' ? 'О' : 'Р') : side === 'HEADS' ? 'О' : 'Р' }}
              </div>
            </div>

            <p v-if="result" class="mt-2 text-center animate-pop-in">
              <span class="text-lg font-black" :class="result.win ? 'text-emerald-400' : 'text-red-400'">
                {{ result.win ? `Выигрыш ${money(result.payout)}` : `Проигрыш ${money(result.amount)}` }}
              </span>
              <span class="mt-0.5 block font-mono text-[11px] text-slate-500">
                билет {{ result.roll }} / {{ result.totalTickets }} · nonce {{ result.nonce }}
              </span>
            </p>
            <p v-else-if="flipping" class="mt-2 text-sm text-slate-400">Монета в воздухе...</p>
            <p v-else class="mt-2 text-sm text-slate-500">Выберите сторону и сделайте ставку</p>

            <!-- выбор стороны -->
            <div class="mt-6 grid w-full max-w-md grid-cols-2 gap-3">
              <button
                v-for="opt in [
                  { key: 'HEADS', label: 'Орёл', short: 'О' },
                  { key: 'TAILS', label: 'Решка', short: 'Р' },
                ]"
                :key="opt.key"
                class="flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-bold transition"
                :class="
                  side === opt.key
                    ? 'border-accent-500 bg-accent-500/15 text-accent-300'
                    : 'border-white/[.08] bg-white/[.03] text-slate-400 hover:border-white/20'
                "
                :disabled="flipping"
                @click="side = opt.key as any"
              >
                <span class="grid h-7 w-7 place-items-center rounded-full bg-white/10 font-black">
                  {{ opt.short }}
                </span>
                {{ opt.label }}
              </button>
            </div>

            <!-- сумма -->
            <div class="mt-4 w-full max-w-md">
              <label class="label">Ставка</label>
              <div class="flex gap-2">
                <input
                  class="input font-mono text-lg"
                  type="number"
                  step="0.01"
                  :value="(amount / 100).toFixed(2)"
                  :disabled="flipping"
                  @input="amount = Math.round(Number(($event.target as HTMLInputElement).value) * 100)"
                />
                <button v-for="q in quick" :key="q.label" class="btn-ghost btn-sm" :disabled="flipping" @click="addAmount(q.value)">
                  {{ q.label }}
                </button>
                <button class="btn-ghost btn-sm" :disabled="flipping" @click="maxBet">Макс</button>
              </div>
              <p class="mt-1.5 text-xs text-slate-500">
                Лимиты {{ money(config?.minBet ?? 0) }} — {{ money(config?.maxBet ?? 0) }} ·
                возможный выигрыш <span class="money">{{ money(potentialWin) }}</span>
              </p>
            </div>

            <p v-if="error" class="mt-3 w-full max-w-md rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {{ error }}
            </p>

            <button class="btn-primary mt-5 w-full max-w-md py-3 text-base" :disabled="flipping || (auth.isLoggedIn && !canPlay)" @click="play">
              <span v-if="flipping">Бросаем...</span>
              <span v-else-if="!auth.isLoggedIn">Войти и играть</span>
              <span v-else-if="amount > auth.balance">Недостаточно средств</span>
              <span v-else>Бросить монету на {{ money(amount) }}</span>
            </button>
          </div>
        </div>

        <!-- лента -->
        <div class="card p-4">
          <h2 class="section-title mb-3 !text-base">Последние броски</h2>
          <div class="space-y-1.5">
            <div
              v-for="game in feed?.games"
              :key="game.id"
              class="flex items-center gap-2 rounded-xl bg-white/[.03] px-3 py-2 text-sm"
            >
              <span
                class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black"
                :class="game.win ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/15 text-red-300'"
              >
                {{ game.result === 'HEADS' ? 'О' : 'Р' }}
              </span>
              <span class="min-w-0 flex-1 truncate text-slate-400">{{ game.username }}</span>
              <span class="font-mono text-xs" :class="game.win ? 'money-up' : 'money-down'">
                {{ game.win ? '+' + money(game.payout - game.amount) : '−' + money(game.amount) }}
              </span>
              <span class="w-16 shrink-0 text-right text-[10px] text-slate-600">
                {{ timeAgo(game.createdAt) }}
              </span>
            </div>
            <p v-if="!feed?.games?.length" class="py-8 text-center text-sm text-slate-500">
              Бросков ещё не было — будьте первым.
            </p>
          </div>
        </div>
      </div>

      <div class="card p-4 text-xs leading-relaxed text-slate-500">
        Результат броска определяется вашей парой сидов: билет =
        <span class="font-mono text-slate-400">HMAC-SHA256(серверный сид, клиентский сид : nonce) % 10000</span>,
        победа при билете меньше {{ Math.round((config?.winChance ?? 0.5) * 10000) }}.
        Проверить любой бросок можно на странице
        <NuxtLink to="/fair" class="text-accent-400 hover:underline">честности</NuxtLink>.
      </div>
    </template>
  </div>
</template>
