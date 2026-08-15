<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

/**
 * Страница тестовой оплаты (PAYMENT_PROVIDER=mock).
 * Имитирует возврат с платёжной формы: подтверждение зачисляет баланс.
 */
const api = useApi()
const auth = useAuthStore()
const route = useRoute()
const { money } = useFormat()

const paymentId = computed(() => route.query.payment as string)
const loading = ref(false)
const error = ref('')
const done = ref(false)

const { data } = await useAsyncData(`payment-${paymentId.value}`, () =>
  api<{ payment: any }>(`/payments/${paymentId.value}`),
)

async function pay() {
  loading.value = true
  error.value = ''
  try {
    const res = await api<{ balance: number }>(`/payments/${paymentId.value}/mock-confirm`, {
      method: 'POST',
    })
    if (typeof res.balance === 'number') auth.setBalance(res.balance)
    else await auth.fetchMe()
    done.value = true
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md py-8">
    <div class="card p-6">
      <div class="mb-4 flex items-center gap-2">
        <span class="chip border-amber-500/40 text-amber-400">ТЕСТОВАЯ ОПЛАТА</span>
      </div>

      <template v-if="!done">
        <h1 class="text-xl font-bold">Подтверждение платежа</h1>
        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between border-b border-ink-800 pb-2">
            <dt class="text-slate-400">Сумма</dt>
            <dd class="font-mono font-bold text-accent-400">{{ money(data?.payment?.amount) }}</dd>
          </div>
          <div class="flex justify-between border-b border-ink-800 pb-2">
            <dt class="text-slate-400">Статус</dt>
            <dd class="font-mono">{{ data?.payment?.status }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-slate-400">ID платежа</dt>
            <dd class="truncate font-mono text-xs text-slate-500">{{ data?.payment?.id }}</dd>
          </div>
        </dl>

        <p v-if="error" class="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {{ error }}
        </p>

        <button
          class="btn-primary mt-5 w-full py-2.5"
          :disabled="loading || data?.payment?.status !== 'PENDING'"
          @click="pay"
        >
          {{ data?.payment?.status !== 'PENDING' ? 'Платёж уже обработан' : 'Оплатить' }}
        </button>
        <NuxtLink to="/wallet" class="btn-ghost mt-2 w-full">Отмена</NuxtLink>

        <p class="mt-4 text-xs text-slate-500">
          В production этот экран заменяется формой платёжного провайдера,
          а баланс зачисляется только по подписанному webhook.
        </p>
      </template>

      <template v-else>
        <h1 class="text-xl font-bold text-green-400">Баланс пополнен</h1>
        <p class="mt-2 text-sm text-slate-400">
          Текущий баланс: <span class="font-mono font-bold text-accent-400">{{ money(auth.balance) }}</span>
        </p>
        <NuxtLink to="/" class="btn-primary mt-5 w-full">К кейсам</NuxtLink>
      </template>
    </div>
  </div>
</template>
