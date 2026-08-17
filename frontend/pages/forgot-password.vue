<script setup lang="ts">
const api = useApi()

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await api('/auth/forgot-password', { method: 'POST', body: { email: email.value } })
    sent.value = true
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    loading.value = false
  }
}

useHead({ title: 'Восстановление пароля — CS2 Cases' })
</script>

<template>
  <div class="mx-auto max-w-md py-8">
    <div class="card p-6">
      <h1 class="text-2xl font-black">Восстановление пароля</h1>

      <template v-if="!sent">
        <p class="mt-1 text-sm text-slate-400">
          Пришлём ссылку для смены пароля на почту аккаунта.
        </p>

        <form class="mt-6 space-y-4" @submit.prevent="submit">
          <div>
            <label class="label" for="email">E-mail</label>
            <input id="email" v-model="email" class="input" type="email" autocomplete="email" required />
          </div>

          <p v-if="error" class="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {{ error }}
          </p>

          <button class="btn-primary w-full py-2.5" :disabled="loading">
            {{ loading ? 'Отправляем...' : 'Отправить ссылку' }}
          </button>
        </form>
      </template>

      <template v-else>
        <p class="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Если такой аккаунт существует, письмо со ссылкой уже отправлено.
          Ссылка действует 30 минут.
        </p>
        <p class="mt-3 text-xs text-slate-500">
          В режиме разработки письмо печатается в консоль сервера API — ссылку
          видно прямо там.
        </p>
      </template>

      <p class="mt-5 text-center text-sm text-slate-400">
        Вспомнили пароль?
        <NuxtLink to="/login" class="font-semibold text-accent-400 hover:underline">Войти</NuxtLink>
      </p>
    </div>
  </div>
</template>
