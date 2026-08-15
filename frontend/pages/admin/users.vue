<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const api = useApi()
const auth = useAuthStore()
const { money, dateTime } = useFormat()

const search = ref('')
const { data, refresh } = await useAsyncData('admin-users', () =>
  api<{ users: any[] }>(`/admin/users?q=${encodeURIComponent(search.value)}`),
)

let timer: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(() => refresh(), 250)
})

const error = ref('')
const adjusting = ref<any>(null)
const adjustAmount = ref(0)
const adjustNote = ref('')

async function toggleBan(user: any) {
  try {
    await api(`/admin/users/${user.id}`, { method: 'PATCH', body: { banned: !user.banned } })
    await refresh()
  } catch (err: any) {
    error.value = apiError(err)
  }
}

async function toggleRole(user: any) {
  try {
    await api(`/admin/users/${user.id}`, {
      method: 'PATCH',
      body: { role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' },
    })
    await refresh()
  } catch (err: any) {
    error.value = apiError(err)
  }
}

async function applyAdjust() {
  try {
    await api(`/admin/users/${adjusting.value.id}/balance`, {
      method: 'POST',
      body: { amount: Math.round(adjustAmount.value), note: adjustNote.value || undefined },
    })
    adjusting.value = null
    adjustAmount.value = 0
    adjustNote.value = ''
    await refresh()
    await auth.fetchMe()
  } catch (err: any) {
    error.value = apiError(err)
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-black">Пользователи</h1>
      <input v-model="search" class="input w-64" placeholder="E-mail или никнейм..." />
    </div>

    <p v-if="error" class="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
      {{ error }}
    </p>

    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Игрок</th>
            <th>Баланс</th>
            <th>Открытий</th>
            <th>Регистрация</th>
            <th>Роль</th>
            <th>Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in data?.users" :key="user.id">
            <td>
              <p class="font-semibold">{{ user.username }}</p>
              <p class="text-xs text-slate-500">{{ user.email }}</p>
            </td>
            <td class="font-mono text-accent-400">{{ money(user.balance) }}</td>
            <td class="font-mono text-slate-400">{{ user.openingsCount }}</td>
            <td class="whitespace-nowrap text-slate-400">{{ dateTime(user.createdAt) }}</td>
            <td>
              <button
                class="chip"
                :class="user.role === 'ADMIN' ? 'border-accent-500/50 text-accent-400' : ''"
                @click="toggleRole(user)"
              >
                {{ user.role }}
              </button>
            </td>
            <td>
              <button
                class="chip"
                :class="user.banned ? 'border-red-500/50 text-red-400' : 'border-green-500/40 text-green-400'"
                @click="toggleBan(user)"
              >
                {{ user.banned ? 'заблокирован' : 'активен' }}
              </button>
            </td>
            <td class="text-right">
              <button class="btn-ghost btn-sm" @click="adjusting = user">Баланс</button>
            </td>
          </tr>
          <tr v-if="!data?.users?.length">
            <td colspan="7" class="py-8 text-center text-slate-500">Никого не найдено.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div
        v-if="adjusting"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        @click.self="adjusting = null"
      >
        <div class="card w-full max-w-md p-6">
          <h2 class="text-lg font-bold">Корректировка баланса</h2>
          <p class="mt-1 text-sm text-slate-400">
            {{ adjusting.username }} · текущий баланс
            <span class="font-mono text-accent-400">{{ money(adjusting.balance) }}</span>
          </p>

          <div class="mt-4">
            <label class="label">Сумма в центах (отрицательная — списание)</label>
            <input v-model.number="adjustAmount" type="number" class="input font-mono" />
            <p class="mt-1 text-xs text-slate-500">{{ money(adjustAmount) }}</p>
          </div>
          <div class="mt-3">
            <label class="label">Комментарий</label>
            <input v-model="adjustNote" class="input" maxlength="200" placeholder="компенсация, бонус..." />
          </div>

          <div class="mt-5 flex gap-2">
            <button class="btn-primary flex-1" :disabled="!adjustAmount" @click="applyAdjust">
              Применить
            </button>
            <button class="btn-ghost" @click="adjusting = null">Отмена</button>
          </div>
          <p class="mt-3 text-xs text-slate-500">
            Операция попадёт в историю транзакций игрока как ADMIN_ADJUST.
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>
