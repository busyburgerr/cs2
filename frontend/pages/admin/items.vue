<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const api = useApi()
const { money } = useFormat()

const search = ref('')
const { data, refresh } = await useAsyncData('admin-items', () =>
  api<{ items: any[] }>(`/admin/items?q=${encodeURIComponent(search.value)}`),
)

let searchTimer: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => refresh(), 250)
})

const WEARS = ['FN', 'MW', 'FT', 'WW', 'BS']

const editing = ref<string | null>(null)
const showForm = ref(false)
const busy = ref(false)
const error = ref('')

const empty = () => ({
  weapon: '',
  skin: '',
  rarity: 'MILSPEC',
  wear: 'FT',
  statTrak: false,
  price: 100,
  image: '',
})
const form = reactive(empty())

function startCreate() {
  Object.assign(form, empty())
  editing.value = null
  showForm.value = true
  resetLookup()
}

function startEdit(item: any) {
  Object.assign(form, {
    weapon: item.weapon,
    skin: item.skin,
    rarity: item.rarity,
    wear: item.wear,
    statTrak: item.statTrak,
    price: item.price,
    image: item.image ?? '',
  })
  editing.value = item.id
  showForm.value = true
  resetLookup()
}

// --- подбор официальной картинки скина ---
const lookup = reactive({ busy: false, results: [] as any[], error: '', done: false })

async function findImage() {
  const query = `${form.weapon} | ${form.skin}`.trim()
  if (query.length < 3) return
  lookup.busy = true
  lookup.error = ''
  lookup.done = false
  try {
    const res = await api<{ results: any[] }>(`/admin/skin-lookup?q=${encodeURIComponent(query)}`)
    lookup.results = res.results
    lookup.done = true
    // Точное совпадение подставляем сразу.
    if (res.results.length === 1) form.image = res.results[0].image
  } catch (err: any) {
    lookup.error = apiError(err)
  } finally {
    lookup.busy = false
  }
}

function resetLookup() {
  lookup.results = []
  lookup.error = ''
  lookup.done = false
}

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const body = { ...form, price: Math.round(form.price), image: form.image || '' }
    if (editing.value) await api(`/admin/items/${editing.value}`, { method: 'PATCH', body })
    else await api('/admin/items', { method: 'POST', body })
    showForm.value = false
    await refresh()
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    busy.value = false
  }
}

async function remove(item: any) {
  if (!confirm(`Удалить «${item.name}»?`)) return
  try {
    await api(`/admin/items/${item.id}`, { method: 'DELETE' })
    await refresh()
  } catch (err: any) {
    error.value = apiError(err)
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-black">Предметы</h1>
      <div class="flex gap-2">
        <input v-model="search" class="input w-56" placeholder="Поиск..." />
        <button class="btn-primary whitespace-nowrap" @click="startCreate">+ Предмет</button>
      </div>
    </div>

    <p v-if="error" class="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
      {{ error }}
    </p>

    <form v-if="showForm" class="card grid gap-3 p-5 sm:grid-cols-3" @submit.prevent="submit">
      <div class="sm:col-span-3 flex items-center justify-between">
        <h2 class="text-sm font-bold uppercase tracking-wide text-slate-400">
          {{ editing ? 'Изменение предмета' : 'Новый предмет' }}
        </h2>
        <button type="button" class="btn-ghost btn-sm" @click="showForm = false">Закрыть</button>
      </div>
      <div>
        <label class="label">Оружие</label>
        <input v-model="form.weapon" class="input" placeholder="AK-47" required />
      </div>
      <div>
        <label class="label">Скин</label>
        <input v-model="form.skin" class="input" placeholder="Redline" required />
      </div>
      <div>
        <label class="label">Цена, центы</label>
        <input v-model.number="form.price" type="number" min="1" class="input font-mono" required />
        <p class="mt-1 text-xs text-slate-500">{{ money(form.price) }}</p>
      </div>
      <div>
        <label class="label">Редкость</label>
        <select v-model="form.rarity" class="input">
          <option v-for="r in RARITY_ORDER" :key="r" :value="r">{{ RARITY_LABELS[r] }}</option>
        </select>
      </div>
      <div>
        <label class="label">Износ</label>
        <select v-model="form.wear" class="input">
          <option v-for="w in WEARS" :key="w" :value="w">{{ w }} — {{ WEAR_LABELS[w] }}</option>
        </select>
      </div>
      <div class="sm:col-span-3">
        <label class="label">Картинка</label>
        <div class="flex gap-2">
          <input v-model="form.image" class="input" type="url" placeholder="https://... или подберите по названию" />
          <button
            type="button"
            class="btn-ghost whitespace-nowrap"
            :disabled="lookup.busy || !form.weapon || !form.skin"
            @click="findImage"
          >
            {{ lookup.busy ? 'Ищу...' : 'Подобрать' }}
          </button>
          <div
            v-if="form.image"
            class="flex h-[38px] w-16 shrink-0 items-center justify-center rounded-lg border border-ink-700 bg-ink-950"
          >
            <img :src="form.image" alt="" class="max-h-8 max-w-full object-contain" />
          </div>
        </div>

        <p v-if="lookup.error" class="mt-1 text-xs text-red-400">{{ lookup.error }}</p>
        <p v-else-if="lookup.done && !lookup.results.length" class="mt-1 text-xs text-slate-500">
          В каталоге CS2 такого скина нет — оставьте поле пустым, будет векторный силуэт.
        </p>

        <div v-if="lookup.results.length > 1" class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="skin in lookup.results"
            :key="skin.name"
            type="button"
            class="flex items-center gap-2 rounded-lg border px-2 py-1 text-xs transition"
            :class="
              form.image === skin.image
                ? 'border-accent-500 bg-accent-500/10 text-accent-400'
                : 'border-ink-700 bg-ink-950 text-slate-300 hover:border-ink-600'
            "
            @click="form.image = skin.image"
          >
            <img :src="skin.image" alt="" class="h-6 w-10 object-contain" />
            {{ skin.name }}
          </button>
        </div>
      </div>
      <label class="flex items-center gap-2 text-sm sm:col-span-3">
        <input v-model="form.statTrak" type="checkbox" class="h-4 w-4 accent-amber-500" />
        StatTrak™
      </label>
      <div class="sm:col-span-3">
        <button class="btn-primary" :disabled="busy">
          {{ editing ? 'Сохранить' : 'Создать' }}
        </button>
      </div>
    </form>

    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th />
            <th>Название</th>
            <th>Редкость</th>
            <th>Износ</th>
            <th>Цена</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in data?.items" :key="item.id">
            <td class="w-16">
              <SkinImage :item="item" class="h-8 w-12" />
            </td>
            <td class="font-medium">{{ item.name }}</td>
            <td>
              <span class="text-xs font-semibold" :style="{ color: rarityColor(item.rarity) }">
                {{ RARITY_LABELS[item.rarity] }}
              </span>
            </td>
            <td class="text-slate-400">{{ item.wear }}</td>
            <td class="font-mono text-accent-400">{{ money(item.price) }}</td>
            <td class="text-right">
              <button class="btn-ghost btn-sm" @click="startEdit(item)">Изменить</button>
              <button class="btn-ghost btn-sm ml-1 text-red-400" @click="remove(item)">Удалить</button>
            </td>
          </tr>
          <tr v-if="!data?.items?.length">
            <td colspan="6" class="py-8 text-center text-slate-500">Предметов нет.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
