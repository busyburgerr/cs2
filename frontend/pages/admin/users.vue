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

// --- демо-режим ---
const demoUser = ref<any>(null)
const demoForm = reactive({ demo: false, demoBalance: 0, demoForceCoinflip: '' })
const demoError = ref('')
const demoNotice = ref('')
const demoSaving = ref(false)

// выбор предмета для заданного дропа
const itemSearch = ref('')
const itemResults = ref<any[]>([])
const forcedItem = ref<any>(null)
const itemLoading = ref(false)

function openDemo(user: any) {
  demoUser.value = user
  demoError.value = ''
  demoNotice.value = ''
  itemSearch.value = ''
  itemResults.value = []
  forcedItem.value = null
  Object.assign(demoForm, {
    demo: user.demo,
    demoBalance: user.demoBalance ?? 0,
    demoForceCoinflip: user.demoForceCoinflip ?? '',
  })
  if (user.demoForceItemId) loadForcedItem(user.demoForceItemId)
}

async function loadForcedItem(id: string) {
  try {
    const res = await api<{ items: any[] }>('/admin/items')
    forcedItem.value = res.items.find((i) => i.id === id) ?? null
  } catch {
    forcedItem.value = null
  }
}

let itemTimer: ReturnType<typeof setTimeout>
watch(itemSearch, (q) => {
  clearTimeout(itemTimer)
  if (q.trim().length < 2) {
    itemResults.value = []
    return
  }
  itemTimer = setTimeout(async () => {
    itemLoading.value = true
    try {
      const res = await api<{ items: any[] }>(`/admin/items?q=${encodeURIComponent(q)}`)
      itemResults.value = res.items.slice(0, 12)
    } finally {
      itemLoading.value = false
    }
  }, 250)
})

async function saveDemo(patch: Record<string, any>) {
  demoSaving.value = true
  demoError.value = ''
  demoNotice.value = ''
  try {
    const res = await api<{ user: any }>(`/admin/users/${demoUser.value.id}/demo`, {
      method: 'PUT',
      body: patch,
    })
    demoUser.value = { ...demoUser.value, ...res.user }
    Object.assign(demoForm, {
      demo: res.user.demo,
      demoBalance: res.user.demoBalance ?? 0,
      demoForceCoinflip: res.user.demoForceCoinflip ?? '',
    })
    demoNotice.value = 'Сохранено'
    await refresh()
  } catch (err: any) {
    demoError.value = apiError(err)
  } finally {
    demoSaving.value = false
  }
}

async function pickForcedItem(item: any) {
  forcedItem.value = item
  itemResults.value = []
  itemSearch.value = ''
  await saveDemo({ demoForceItemId: item.id })
}

async function clearForcedItem() {
  forcedItem.value = null
  await saveDemo({ demoForceItemId: null })
}

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
              <p class="flex items-center gap-2 font-semibold">
                {{ user.username }}
                <span
                  v-if="user.demo"
                  class="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300"
                >
                  ДЕМО
                </span>
              </p>
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
              <button
                class="btn-ghost btn-sm ml-1"
                :class="user.demo ? 'border-amber-400/50 text-amber-300' : ''"
                @click="openDemo(user)"
              >
                {{ user.demo ? 'Демо ✓' : 'Демо' }}
              </button>
            </td>
          </tr>
          <tr v-if="!data?.users?.length">
            <td colspan="7" class="py-8 text-center text-slate-500">Никого не найдено.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- демо-режим -->
    <Teleport to="body">
      <div
        v-if="demoUser"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4"
        @click.self="demoUser = null"
      >
        <div class="card my-8 w-full max-w-lg p-6">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-bold">Демо-режим</h2>
              <p class="mt-1 text-sm text-slate-400">{{ demoUser.username }} · {{ demoUser.email }}</p>
            </div>
            <button class="btn-ghost btn-sm" @click="demoUser = null">✕</button>
          </div>

          <div class="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
            Демо-аккаунт играет на виртуальном балансе: пополнение недоступно, игры
            не попадают в публичные ленты и в статистику, а в интерфейсе игрока
            постоянно висит полоса «ДЕМО-РЕЖИМ». Задавать исход игры можно только здесь.
          </div>

          <p v-if="demoError" class="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {{ demoError }}
          </p>
          <p v-if="demoNotice" class="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {{ demoNotice }}
          </p>

          <!-- включение -->
          <div class="mt-4 flex items-center justify-between rounded-xl bg-white/[.03] px-4 py-3">
            <div>
              <p class="text-sm font-semibold">Демо-аккаунт</p>
              <p class="text-xs text-slate-500">
                Реальный баланс: {{ money(demoUser.balance ?? 0) }} ·
                виртуальный: {{ money(demoUser.demoBalance ?? 0) }}
              </p>
            </div>
            <button
              class="btn"
              :class="demoForm.demo ? 'bg-amber-400 text-ink-950' : 'btn-ghost'"
              :disabled="demoSaving"
              @click="saveDemo({ demo: !demoForm.demo })"
            >
              {{ demoForm.demo ? 'Включён' : 'Включить' }}
            </button>
          </div>

          <template v-if="demoForm.demo">
            <!-- виртуальный баланс -->
            <div class="mt-4">
              <label class="label">Виртуальный баланс</label>
              <div class="flex gap-2">
                <input
                  class="input font-mono"
                  type="number"
                  step="0.01"
                  min="0"
                  :value="(demoForm.demoBalance / 100).toFixed(2)"
                  @input="demoForm.demoBalance = Math.round(Number(($event.target as HTMLInputElement).value) * 100)"
                />
                <button class="btn-ghost whitespace-nowrap" :disabled="demoSaving" @click="saveDemo({ demoBalance: demoForm.demoBalance })">
                  Выдать
                </button>
              </div>
            </div>

            <!-- заданный дроп -->
            <div class="mt-5">
              <label class="label">Следующий дроп из кейса</label>
              <div v-if="forcedItem" class="flex items-center gap-2 rounded-xl border border-accent-500/40 bg-accent-500/10 p-2">
                <SkinImage :item="forcedItem" class="h-8 w-12" />
                <span class="min-w-0 flex-1 truncate text-sm">{{ forcedItem.name }}</span>
                <span class="money text-xs">{{ money(forcedItem.price) }}</span>
                <button class="btn-ghost btn-sm" :disabled="demoSaving" @click="clearForcedItem">Убрать</button>
              </div>

              <template v-else>
                <input v-model="itemSearch" class="input" placeholder="Поиск предмета по названию..." />
                <p v-if="itemLoading" class="mt-1 text-xs text-slate-500">Ищу...</p>
                <div v-if="itemResults.length" class="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                  <button
                    v-for="item in itemResults"
                    :key="item.id"
                    class="flex w-full items-center gap-2 rounded-lg border border-white/[.06] bg-ink-950/60 p-2 text-left hover:border-white/20"
                    @click="pickForcedItem(item)"
                  >
                    <SkinImage :item="item" class="h-7 w-10" />
                    <span class="min-w-0 flex-1 truncate text-sm">{{ item.name }}</span>
                    <span class="chip">{{ item.wear }}</span>
                    <span class="money text-xs">{{ money(item.price) }}</span>
                  </button>
                </div>
              </template>
              <p class="mt-1.5 text-xs text-slate-500">
                Сработает один раз при следующем открытии — и только если предмет
                есть в этом кейсе.
              </p>
            </div>

            <!-- исход коинфлипа -->
            <div class="mt-5">
              <label class="label">Следующий бросок монеты</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="opt in [
                    { value: '', label: 'Как выпадет' },
                    { value: 'WIN', label: 'Выигрыш' },
                    { value: 'LOSE', label: 'Проигрыш' },
                  ]"
                  :key="opt.value"
                  class="rounded-xl border py-2 text-sm font-semibold transition"
                  :class="
                    demoForm.demoForceCoinflip === opt.value
                      ? 'border-accent-500 bg-accent-500/15 text-accent-300'
                      : 'border-white/[.08] bg-white/[.03] text-slate-400 hover:border-white/20'
                  "
                  :disabled="demoSaving"
                  @click="saveDemo({ demoForceCoinflip: opt.value || null })"
                >
                  {{ opt.label }}
                </button>
              </div>
              <p class="mt-1.5 text-xs text-slate-500">
                Тоже одноразово: после броска сбрасывается.
              </p>
            </div>
          </template>

          <p class="mt-5 text-xs leading-relaxed text-slate-500">
            Рулетка не подкручивается: раунд общий для всех игроков, и подмена
            результата изменила бы исход у остальных.
          </p>
        </div>
      </div>
    </Teleport>

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
