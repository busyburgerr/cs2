<script setup lang="ts">
const api = useApi()
const route = useRoute()
const token = useAuthToken()
const auth = useAuthStore()

const resetToken = computed(() => (route.query.token as string) || '')
const password = ref('')
const repeat = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)

const valid = computed(() => password.value.length >= 8 && password.value === repeat.value)

async function submit() {
  if (!valid.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await api<{ token: string; user: any }>('/auth/reset-password', {
      method: 'POST',
      body: { token: resetToken.value, password: password.value },
    })
    // Пользователя берём из ответа: запись cookie асинхронная, и повторный
    // запрос профиля ушёл бы ещё со старым токеном.
    token.value = res.token
    auth.user = res.user
    done.value = true
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    loading.value = false
  }
}

useHead({ title: 'Новый пароль — CS2 Cases' })
</script>

<template>
  <div class="mx-auto max-w-md py-8">
    <div class="card p-6">
      <h1 class="text-2xl font-black">Новый пароль</h1>

      <p v-if="!resetToken" class="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        В ссылке нет токена. Запросите восстановление заново.
      </p>

      <template v-else-if="!done">
        <p class="mt-1 text-sm text-slate-400">Придумайте новый пароль — минимум 8 символов.</p>

        <form class="mt-6 space-y-4" @submit.prevent="submit">
          <div>
            <label class="label" for="password">Новый пароль</label>
            <input
              id="password"
              v-model="password"
              class="input"
              type="password"
              minlength="8"
              autocomplete="new-password"
              required
            />
          </div>
          <div>
            <label class="label" for="repeat">Ещё раз</label>
            <input
              id="repeat"
              v-model="repeat"
              class="input"
              type="password"
              minlength="8"
              autocomplete="new-password"
              required
            />
          </div>

          <p v-if="repeat && password !== repeat" class="text-xs text-red-400">Пароли не совпадают</p>
          <p v-if="error" class="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {{ error }}
          </p>

          <button class="btn-primary w-full py-2.5" :disabled="!valid || loading">
            {{ loading ? 'Сохраняем...' : 'Сохранить пароль' }}
          </button>
        </form>
      </template>

      <template v-else>
        <p class="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Пароль изменён, вы вошли в аккаунт.
        </p>
        <NuxtLink to="/" class="btn-primary mt-4 w-full">К кейсам</NuxtLink>
      </template>

      <p v-if="!done" class="mt-5 text-center text-sm text-slate-400">
        <NuxtLink to="/login" class="font-semibold text-accent-400 hover:underline">Вернуться ко входу</NuxtLink>
      </p>
    </div>
  </div>
</template>
