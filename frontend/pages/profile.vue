<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const auth = useAuthStore()
const api = useApi()
const token = useAuthToken()
const { money, dateTime } = useFormat()

const form = reactive({ currentPassword: '', newPassword: '', repeat: '' })
const saving = ref(false)
const error = ref('')
const notice = ref('')

const valid = computed(
  () =>
    form.currentPassword.length > 0 &&
    form.newPassword.length >= 8 &&
    form.newPassword === form.repeat,
)

async function changePassword() {
  if (!valid.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const res = await api<{ token: string }>('/auth/change-password', {
      method: 'POST',
      body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
    })
    token.value = res.token
    Object.assign(form, { currentPassword: '', newPassword: '', repeat: '' })
    notice.value = 'Пароль изменён'
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    saving.value = false
  }
}

useHead({ title: 'Профиль — CS2 Cases' })
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-5">
    <h1 class="text-2xl font-black">Профиль</h1>

    <section class="card p-6">
      <dl class="grid gap-4 sm:grid-cols-2">
        <div>
          <dt class="eyebrow">Никнейм</dt>
          <dd class="mt-1 font-semibold">{{ auth.user?.username }}</dd>
        </div>
        <div>
          <dt class="eyebrow">E-mail</dt>
          <dd class="mt-1 font-semibold">{{ auth.user?.email }}</dd>
        </div>
        <div>
          <dt class="eyebrow">Баланс</dt>
          <dd class="mt-1 money text-lg">{{ money(auth.balance) }}</dd>
        </div>
        <div>
          <dt class="eyebrow">Регистрация</dt>
          <dd class="mt-1 font-semibold">
            {{ auth.user?.createdAt ? dateTime(auth.user.createdAt) : '—' }}
          </dd>
        </div>
      </dl>

      <div v-if="auth.user?.demo" class="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
        Это демо-аккаунт: баланс виртуальный, пополнение недоступно.
      </div>
    </section>

    <section class="card p-6">
      <h2 class="section-title !text-base">Смена пароля</h2>

      <form class="mt-4 space-y-4" @submit.prevent="changePassword">
        <div>
          <label class="label" for="current">Текущий пароль</label>
          <input
            id="current"
            v-model="form.currentPassword"
            class="input"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="new">Новый пароль</label>
            <input
              id="new"
              v-model="form.newPassword"
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
              v-model="form.repeat"
              class="input"
              type="password"
              minlength="8"
              autocomplete="new-password"
              required
            />
          </div>
        </div>

        <p v-if="form.repeat && form.newPassword !== form.repeat" class="text-xs text-red-400">
          Пароли не совпадают
        </p>
        <p v-if="error" class="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {{ error }}
        </p>
        <p v-if="notice" class="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {{ notice }}
        </p>

        <button class="btn-primary" :disabled="!valid || saving">
          {{ saving ? 'Сохраняю...' : 'Сменить пароль' }}
        </button>
      </form>
    </section>

    <section class="card p-6">
      <h2 class="section-title !text-base">Честность игры</h2>
      <p class="mt-2 text-sm text-slate-400">
        Клиентский сид, счётчик бросков и раскрытые серверные сиды — на отдельной странице.
      </p>
      <NuxtLink to="/fair" class="btn-ghost mt-4">Открыть проверку честности</NuxtLink>
    </section>
  </div>
</template>
