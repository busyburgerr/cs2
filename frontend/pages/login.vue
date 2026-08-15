<script setup lang="ts">
const auth = useAuthStore()
const route = useRoute()

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(form.email, form.password)
    await navigateTo((route.query.redirect as string) || '/')
  } catch (err: any) {
    error.value = apiError(err, 'Не удалось войти')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md py-8">
    <div class="card p-6">
      <h1 class="text-2xl font-black">Вход</h1>
      <p class="mt-1 text-sm text-slate-400">Продолжите открывать кейсы.</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div>
          <label class="label" for="email">E-mail</label>
          <input id="email" v-model="form.email" class="input" type="email" autocomplete="email" required />
        </div>
        <div>
          <label class="label" for="password">Пароль</label>
          <input
            id="password"
            v-model="form.password"
            class="input"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>

        <p v-if="error" class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {{ error }}
        </p>

        <button class="btn-primary w-full py-2.5" :disabled="loading">
          {{ loading ? 'Входим...' : 'Войти' }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-slate-400">
        Нет аккаунта?
        <NuxtLink to="/register" class="font-semibold text-accent-400 hover:underline">Зарегистрироваться</NuxtLink>
      </p>

      <div class="mt-6 rounded-lg border border-ink-700 bg-ink-950/60 p-3 text-xs text-slate-500">
        <p class="font-semibold text-slate-400">Демо-доступы (после сидирования БД):</p>
        <p class="mt-1 font-mono">player@cs2cases.local / player12345</p>
        <p class="font-mono">admin@cs2cases.local / admin12345</p>
      </div>
    </div>
  </div>
</template>
