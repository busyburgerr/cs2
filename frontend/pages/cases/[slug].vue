<script setup lang="ts">
const route = useRoute()
const api = useApi()
const auth = useAuthStore()
const { money, percent, chance: fmtChance } = useFormat()

const site = useSiteConfig()
const slug = computed(() => route.params.slug as string)
const maxAtOnce = computed(() => site.value?.cases.maxOpenAtOnce ?? 5)

const { data, error } = await useAsyncData(`case-${slug.value}`, () =>
  api<{ case: any }>(`/cases/${slug.value}`),
)

const caseData = computed(() => data.value?.case)
const pool = computed<any[]>(() => caseData.value?.items?.map((ci: any) => ci.item) ?? [])

const count = ref(1)
const fastMode = ref(false)
const spinning = ref(false)
const token = ref(0)
const winners = ref<any[]>([])
const results = ref<any[]>([])
const showResult = ref(false)
const errorMessage = ref('')
const soldIds = ref<string[]>([])

const totalCost = computed(() => (caseData.value?.price ?? 0) * count.value)
const canAfford = computed(() => auth.balance >= totalCost.value)
const totalWon = computed(() => results.value.reduce((s, r) => s + r.item.price, 0))

let finishedCount = 0

async function openCase() {
  if (!auth.isLoggedIn) return navigateTo(`/login?redirect=/cases/${slug.value}`)
  if (spinning.value) return

  errorMessage.value = ''
  showResult.value = false
  soldIds.value = []
  spinning.value = true

  try {
    const res = await api<{ balance: number; results: any[] }>(`/cases/${slug.value}/open`, {
      method: 'POST',
      body: { count: count.value },
    })

    auth.setBalance(res.balance)
    results.value = res.results
    winners.value = res.results.map((r) => r.item)

    if (fastMode.value) {
      finishSpin()
    } else {
      finishedCount = 0
      token.value++
    }
  } catch (err: any) {
    spinning.value = false
    errorMessage.value = apiError(err)
  }
}

function onRouletteFinished() {
  finishedCount++
  if (finishedCount >= winners.value.length) finishSpin()
}

function finishSpin() {
  spinning.value = false
  showResult.value = true
}

async function sellOne(result: any) {
  try {
    const res = await api<{ payout: number; balance: number }>(
      `/me/inventory/${result.inventoryItemId}/sell`,
      { method: 'POST' },
    )
    auth.setBalance(res.balance)
    soldIds.value.push(result.inventoryItemId)
  } catch (err: any) {
    errorMessage.value = apiError(err)
  }
}

async function sellAll() {
  for (const result of results.value) {
    if (!soldIds.value.includes(result.inventoryItemId)) await sellOne(result)
  }
}

const sortedItems = computed(() =>
  [...(caseData.value?.items ?? [])].sort((a, b) => b.item.price - a.item.price),
)
</script>

<template>
  <div v-if="error" class="card p-10 text-center">
    <p class="text-lg font-semibold">Кейс не найден</p>
    <NuxtLink to="/" class="btn-primary mt-4">К списку кейсов</NuxtLink>
  </div>

  <div v-else-if="caseData" class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <NuxtLink to="/" class="text-xs text-slate-500 hover:text-slate-300">← Все кейсы</NuxtLink>
        <h1 class="mt-1 text-2xl font-black sm:text-3xl">{{ caseData.title }}</h1>
        <p v-if="caseData.description" class="mt-1 max-w-xl text-sm text-slate-400">
          {{ caseData.description }}
        </p>
      </div>
      <div class="flex gap-2">
        <div class="card px-4 py-2 text-center">
          <p class="text-[11px] uppercase tracking-wide text-slate-500">Цена</p>
          <p class="font-mono text-lg font-bold text-accent-400">{{ money(caseData.price) }}</p>
        </div>
        <div class="card px-4 py-2 text-center">
          <p class="text-[11px] uppercase tracking-wide text-slate-500">Отдача</p>
          <p class="font-mono text-lg font-bold">{{ percent(caseData.rtp, 1) }}</p>
        </div>
      </div>
    </div>

    <!-- рулетки -->
    <div class="space-y-2">
      <CaseRoulette
        v-for="i in count"
        :key="i"
        :pool="pool"
        :winner="winners[i - 1] ?? null"
        :token="token"
        @finished="onRouletteFinished"
      />
    </div>

    <!-- управление -->
    <div class="card flex flex-wrap items-center gap-4 p-4">
      <div class="flex items-center gap-1">
        <span class="mr-2 text-xs uppercase tracking-wide text-slate-500">Кейсов</span>
        <button
          v-for="n in maxAtOnce"
          :key="n"
          class="h-9 w-9 rounded-lg border text-sm font-bold transition"
          :class="
            count === n
              ? 'border-accent-500 bg-accent-500 text-ink-950'
              : 'border-ink-700 bg-ink-850 text-slate-300 hover:border-ink-600'
          "
          :disabled="spinning"
          @click="count = n"
        >
          {{ n }}
        </button>
      </div>

      <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
        <input v-model="fastMode" type="checkbox" class="h-4 w-4 accent-amber-500" />
        Быстрое открытие
      </label>

      <div class="ml-auto flex items-center gap-3">
        <span v-if="auth.isLoggedIn && !canAfford" class="text-xs text-red-400">
          Не хватает {{ money(totalCost - auth.balance) }}
        </span>
        <NuxtLink v-if="auth.isLoggedIn && !canAfford" to="/wallet" class="btn-ghost">
          Пополнить
        </NuxtLink>
        <button
          class="btn-primary min-w-[13rem] py-2.5 text-base"
          :disabled="spinning || (auth.isLoggedIn && !canAfford)"
          @click="openCase"
        >
          <span v-if="spinning">Крутим...</span>
          <span v-else-if="!auth.isLoggedIn">Войти и открыть</span>
          <span v-else>Открыть за {{ money(totalCost) }}</span>
        </button>
      </div>
    </div>

    <p v-if="errorMessage" class="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
      {{ errorMessage }}
    </p>

    <!-- содержимое -->
    <section>
      <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 class="text-lg font-bold">Содержимое кейса</h2>
        <p class="text-xs text-slate-500">
          Всего тикетов: <span class="font-mono">{{ caseData.totalWeight?.toLocaleString('ru-RU') }}</span>
          · ожидаемая ценность дропа {{ money(caseData.expectedValue) }}
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <ItemCard v-for="ci in sortedItems" :key="ci.id" :item="ci.item" :chance="ci.chance" />
      </div>
    </section>

    <!-- результат -->
    <Teleport to="body">
      <div
        v-if="showResult"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        @click.self="showResult = false"
      >
        <div class="card w-full max-w-3xl animate-pop-in p-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 class="text-xl font-black">
                {{ results.length > 1 ? `Выпало ${results.length} предметов` : 'Ваш дроп' }}
              </h3>
              <p class="mt-1 text-sm text-slate-400">
                Общая стоимость <span class="font-mono font-bold text-accent-400">{{ money(totalWon) }}</span>
                при затратах {{ money(totalCost) }}
              </p>
            </div>
            <button class="btn-ghost btn-sm" @click="showResult = false">✕</button>
          </div>

          <div class="mt-5 grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
            <ItemCard
              v-for="r in results"
              :key="r.id"
              :item="r.item"
              :chance="r.chance"
              highlight
              :class="soldIds.includes(r.inventoryItemId) ? 'opacity-40' : ''"
            >
              <template #footer>
                <button
                  class="btn-ghost btn-sm mt-2 w-full"
                  :disabled="soldIds.includes(r.inventoryItemId)"
                  @click="sellOne(r)"
                >
                  {{ soldIds.includes(r.inventoryItemId) ? 'Продано' : 'Продать' }}
                </button>
              </template>
            </ItemCard>
          </div>

          <div class="mt-5 flex flex-wrap gap-3">
            <button class="btn-primary flex-1" @click="showResult = false">Оставить в инвентаре</button>
            <button class="btn-ghost flex-1" @click="sellAll">Продать всё</button>
            <button
              class="btn-ghost"
              :disabled="!canAfford"
              @click="
                () => {
                  showResult = false
                  openCase()
                }
              "
            >
              Ещё раз
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
