<script setup lang="ts">
const auth = useAuthStore()
const route = useRoute()

const form = reactive({ email: '', username: '', password: '', ageConfirmed: false })
const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.register({ ...form })
    await navigateTo((route.query.redirect as string) || '/')
  } catch (err: any) {
    error.value = apiError(err, 'Не удалось зарегистрироваться')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md py-8">
    <div class="card p-6">
      <h1 class="text-2xl font-black">Регистрация</h1>
      <p class="mt-1 text-sm text-slate-400">Баланс пополняется отдельно, стартовых бонусов нет.</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div>
          <label class="label" for="email">E-mail</label>
          <input id="email" v-model="form.email" class="input" type="email" autocomplete="email" required />
        </div>
        <div>
          <label class="label" for="username">Никнейм</label>
          <input
            id="username"
            v-model="form.username"
            class="input"
            minlength="3"
            maxlength="20"
            pattern="[a-zA-Z0-9_]+"
            required
          />
          <p class="mt-1 text-xs text-slate-500">Латиница, цифры и подчёркивание.</p>
        </div>
        <div>
          <label class="label" for="password">Пароль</label>
          <input
            id="password"
            v-model="form.password"
            class="input"
            type="password"
            minlength="8"
            autocomplete="new-password"
            required
          />
        </div>

        <label class="flex cursor-pointer items-start gap-2 text-xs text-slate-400">
          <input v-model="form.ageConfirmed" type="checkbox" class="mt-0.5 h-4 w-4 accent-amber-500" required />
          <span>
            Мне исполнилось 18 лет, я понимаю, что открытие кейсов связано с риском потери денег,
            и принимаю условия использования.
          </span>
        </label>

        <p v-if="error" class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {{ error }}
        </p>

        <button class="btn-primary w-full py-2.5" :disabled="loading">
          {{ loading ? 'Создаём аккаунт...' : 'Создать аккаунт' }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-slate-400">
        Уже есть аккаунт?
        <NuxtLink to="/login" class="font-semibold text-accent-400 hover:underline">Войти</NuxtLink>
      </p>
    </div>
  </div>
</template>
