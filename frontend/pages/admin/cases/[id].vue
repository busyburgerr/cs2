<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const api = useApi()
const { money, percent, chance: fmtChance } = useFormat()

const id = route.params.id as string

const { data, refresh } = await useAsyncData(`admin-case-${id}`, () =>
  api<{ case: any }>(`/admin/cases/${id}`),
)
const { data: itemsData } = await useAsyncData('admin-all-items', () =>
  api<{ items: any[] }>('/admin/items'),
)

const error = ref('')
const notice = ref('')
const savingCase = ref(false)
const savingItems = ref(false)

// --- настройки кейса ---
const form = reactive({
  slug: '',
  title: '',
  description: '',
  image: '',
  price: 0,
  active: true,
  sortOrder: 0,
})

// --- состав ---
interface Row {
  itemId: string
  weight: number
  item: any
}
const rows = ref<Row[]>([])
const search = ref('')
const targetRtp = ref(92)

watchEffect(() => {
  const c = data.value?.case
  if (!c) return
  Object.assign(form, {
    slug: c.slug,
    title: c.title,
    description: c.description ?? '',
    image: c.image ?? '',
    price: c.price,
    active: c.active,
    sortOrder: c.sortOrder,
  })
  rows.value = (c.items ?? []).map((ci: any) => ({
    itemId: ci.item.id,
    weight: ci.weight,
    item: ci.item,
  }))
})

const totalWeight = computed(() => rows.value.reduce((s, r) => s + (r.weight || 0), 0))
const expectedValue = computed(() =>
  totalWeight.value
    ? rows.value.reduce((s, r) => s + (r.weight / totalWeight.value) * r.item.price, 0)
    : 0,
)
const rtp = computed(() => (form.price > 0 ? expectedValue.value / form.price : 0))
const suggestedPrice = computed(() => Math.round(expectedValue.value / (targetRtp.value / 100)))

const availableItems = computed(() => {
  const used = new Set(rows.value.map((r) => r.itemId))
  const q = search.value.toLowerCase().trim()
  return (itemsData.value?.items ?? [])
    .filter((i) => !used.has(i.id) && (!q || i.name.toLowerCase().includes(q)))
    .slice(0, 40)
})

function addItem(item: any) {
  rows.value.push({ itemId: item.id, weight: 1000, item })
}
function removeRow(index: number) {
  rows.value.splice(index, 1)
}
/** Раздаёт веса так, чтобы дешёвые предметы падали чаще дорогих. */
function autoBalance() {
  for (const row of rows.value) {
    row.weight = Math.max(1, Math.round(1_000_000 / Math.max(1, row.item.price)))
  }
}

async function saveCase() {
  savingCase.value = true
  error.value = ''
  notice.value = ''
  try {
    await api(`/admin/cases/${id}`, {
      method: 'PATCH',
      body: {
        slug: form.slug,
        title: form.title,
        description: form.description || null,
        image: form.image || '',
        price: Math.round(form.price),
        active: form.active,
        sortOrder: form.sortOrder,
      },
    })
    notice.value = 'Настройки кейса сохранены'
    await refresh()
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    savingCase.value = false
  }
}

async function saveItems() {
  savingItems.value = true
  error.value = ''
  notice.value = ''
  try {
    await api(`/admin/cases/${id}/items`, {
      method: 'PUT',
      body: { items: rows.value.map((r) => ({ itemId: r.itemId, weight: Math.round(r.weight) })) },
    })
    notice.value = 'Состав кейса сохранён'
    await refresh()
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    savingItems.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <NuxtLink to="/admin/cases" class="text-xs text-slate-500 hover:text-slate-300">← Все кейсы</NuxtLink>
        <h1 class="text-xl font-black">{{ form.title || 'Кейс' }}</h1>
      </div>
      <NuxtLink :to="`/cases/${form.slug}`" target="_blank" class="btn-ghost btn-sm">
        Открыть на сайте ↗
      </NuxtLink>
    </div>

    <p v-if="error" class="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
      {{ error }}
    </p>
    <p v-if="notice" class="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-300">
      {{ notice }}
    </p>

    <div class="grid gap-4 lg:grid-cols-3">
      <!-- настройки -->
      <form class="card space-y-3 p-5" @submit.prevent="saveCase">
        <h2 class="text-sm font-bold uppercase tracking-wide text-slate-400">Настройки</h2>
        <div>
          <label class="label">Название</label>
          <input v-model="form.title" class="input" required />
        </div>
        <div>
          <label class="label">Slug</label>
          <input v-model="form.slug" class="input font-mono" pattern="[a-z0-9-]+" required />
        </div>
        <div>
          <label class="label">Описание</label>
          <textarea v-model="form.description" class="input" rows="3" maxlength="400" />
        </div>
        <div>
          <label class="label">Картинка (URL)</label>
          <input v-model="form.image" class="input" type="url" placeholder="https://..." />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Цена, центы</label>
            <input v-model.number="form.price" type="number" min="1" class="input font-mono" required />
            <p class="mt-1 text-xs text-slate-500">{{ money(form.price) }}</p>
          </div>
          <div>
            <label class="label">Сортировка</label>
            <input v-model.number="form.sortOrder" type="number" class="input font-mono" />
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="form.active" type="checkbox" class="h-4 w-4 accent-amber-500" />
          Кейс активен и виден игрокам
        </label>
        <button class="btn-primary w-full" :disabled="savingCase">Сохранить настройки</button>
      </form>

      <!-- экономика -->
      <div class="card space-y-3 p-5">
        <h2 class="text-sm font-bold uppercase tracking-wide text-slate-400">Экономика</h2>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg bg-ink-950 p-3">
            <p class="text-xs text-slate-500">Ожидаемый дроп</p>
            <p class="font-mono text-lg font-bold">{{ money(Math.round(expectedValue)) }}</p>
          </div>
          <div class="rounded-lg bg-ink-950 p-3">
            <p class="text-xs text-slate-500">RTP при цене</p>
            <p class="font-mono text-lg font-bold" :class="rtp > 1 ? 'text-red-400' : 'text-green-400'">
              {{ percent(rtp, 1) }}
            </p>
          </div>
          <div class="rounded-lg bg-ink-950 p-3">
            <p class="text-xs text-slate-500">Маржа на открытие</p>
            <p class="font-mono text-lg font-bold text-accent-400">
              {{ money(Math.round(form.price - expectedValue)) }}
            </p>
          </div>
          <div class="rounded-lg bg-ink-950 p-3">
            <p class="text-xs text-slate-500">Всего билетов</p>
            <p class="font-mono text-lg font-bold">{{ totalWeight.toLocaleString('ru-RU') }}</p>
          </div>
        </div>

        <div class="border-t border-ink-800 pt-3">
          <label class="label">Целевой RTP, %</label>
          <div class="flex items-center gap-2">
            <input v-model.number="targetRtp" type="number" min="1" max="200" class="input font-mono" />
            <button class="btn-ghost whitespace-nowrap" @click="form.price = suggestedPrice">
              Цена {{ money(suggestedPrice) }}
            </button>
          </div>
          <p class="mt-2 text-xs text-slate-500">
            RTP выше 100% означает, что кейс работает в убыток площадке.
          </p>
        </div>

        <button class="btn-ghost w-full" @click="autoBalance">
          Автовеса (обратно пропорционально цене)
        </button>
      </div>

      <!-- добавление предметов -->
      <div class="card flex flex-col p-5">
        <h2 class="text-sm font-bold uppercase tracking-wide text-slate-400">Добавить предмет</h2>
        <input v-model="search" class="input mt-3" placeholder="Поиск по названию..." />
        <div class="mt-3 max-h-[22rem] space-y-1 overflow-y-auto pr-1">
          <button
            v-for="item in availableItems"
            :key="item.id"
            class="flex w-full items-center gap-2 rounded-lg border border-ink-800 bg-ink-950/60 p-2 text-left hover:border-ink-600"
            @click="addItem(item)"
          >
            <span class="h-1.5 w-1.5 shrink-0 rounded-full" :style="{ background: rarityColor(item.rarity) }" />
            <span class="min-w-0 flex-1 truncate text-sm">{{ item.name }}</span>
            <span class="chip">{{ item.wear }}</span>
            <span class="font-mono text-xs text-accent-400">{{ money(item.price) }}</span>
          </button>
          <p v-if="!availableItems.length" class="py-6 text-center text-sm text-slate-500">
            Ничего не найдено.
            <NuxtLink to="/admin/items" class="text-accent-400 hover:underline">Создать предмет</NuxtLink>
          </p>
        </div>
      </div>
    </div>

    <!-- состав -->
    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-sm font-bold uppercase tracking-wide text-slate-400">
          Состав кейса ({{ rows.length }})
        </h2>
        <button class="btn-primary" :disabled="savingItems || !rows.length" @click="saveItems">
          Сохранить состав
        </button>
      </div>

      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Предмет</th>
              <th>Редкость</th>
              <th>Цена</th>
              <th class="w-40">Вес (билетов)</th>
              <th>Шанс</th>
              <th>Вклад в EV</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="row.itemId">
              <td class="font-medium">{{ row.item.name }} <span class="text-xs text-slate-500">({{ row.item.wear }})</span></td>
              <td>
                <span class="text-xs font-semibold" :style="{ color: rarityColor(row.item.rarity) }">
                  {{ RARITY_LABELS[row.item.rarity] }}
                </span>
              </td>
              <td class="font-mono text-accent-400">{{ money(row.item.price) }}</td>
              <td>
                <input v-model.number="row.weight" type="number" min="1" class="input py-1 font-mono text-xs" />
              </td>
              <td class="font-mono text-slate-300">
                {{ totalWeight ? fmtChance(row.weight / totalWeight) : '—' }}
              </td>
              <td class="font-mono text-slate-400">
                {{ totalWeight ? money(Math.round((row.weight / totalWeight) * row.item.price)) : '—' }}
              </td>
              <td class="text-right">
                <button class="btn-ghost btn-sm text-red-400" @click="removeRow(index)">Убрать</button>
              </td>
            </tr>
            <tr v-if="!rows.length">
              <td colspan="7" class="py-8 text-center text-slate-500">
                Добавьте предметы из списка справа.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
