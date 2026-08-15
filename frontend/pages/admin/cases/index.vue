<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const api = useApi()
const { money, percent } = useFormat()

const { data, refresh } = await useAsyncData('admin-cases', () => api<{ cases: any[] }>('/admin/cases'))

const creating = ref(false)
const busy = ref(false)
const error = ref('')
const form = reactive({
  slug: '',
  title: '',
  description: '',
  price: 100,
  sortOrder: 0,
  active: true,
})

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-я\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}
watch(() => form.title, (title) => { if (creating.value) form.slug = slugify(title) })

async function create() {
  busy.value = true
  error.value = ''
  try {
    const res = await api<{ case: any }>('/admin/cases', {
      method: 'POST',
      body: {
        slug: form.slug,
        title: form.title,
        description: form.description || null,
        price: Math.round(form.price),
        sortOrder: form.sortOrder,
        active: form.active,
      },
    })
    creating.value = false
    await navigateTo(`/admin/cases/${res.case.id}`)
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    busy.value = false
  }
}

async function toggleActive(row: any) {
  await api(`/admin/cases/${row.id}`, { method: 'PATCH', body: { active: !row.active } })
  await refresh()
}

async function remove(row: any) {
  if (!confirm(`Удалить кейс «${row.title}»? Действие необратимо.`)) return
  try {
    await api(`/admin/cases/${row.id}`, { method: 'DELETE' })
    await refresh()
  } catch (err: any) {
    error.value = apiError(err)
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-black">Кейсы</h1>
      <button class="btn-primary" @click="creating = !creating">
        {{ creating ? 'Отмена' : '+ Новый кейс' }}
      </button>
    </div>

    <p v-if="error" class="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
      {{ error }}
    </p>

    <form v-if="creating" class="card grid gap-3 p-5 sm:grid-cols-2" @submit.prevent="create">
      <div>
        <label class="label">Название</label>
        <input v-model="form.title" class="input" required />
      </div>
      <div>
        <label class="label">Slug (адрес)</label>
        <input v-model="form.slug" class="input font-mono" pattern="[a-z0-9-]+" required />
      </div>
      <div class="sm:col-span-2">
        <label class="label">Описание</label>
        <input v-model="form.description" class="input" maxlength="400" />
      </div>
      <div>
        <label class="label">Цена, в центах</label>
        <input v-model.number="form.price" type="number" min="1" class="input font-mono" required />
        <p class="mt-1 text-xs text-slate-500">{{ money(form.price) }}</p>
      </div>
      <div>
        <label class="label">Порядок сортировки</label>
        <input v-model.number="form.sortOrder" type="number" class="input font-mono" />
      </div>
      <div class="sm:col-span-2 flex items-center gap-3">
        <button class="btn-primary" :disabled="busy">Создать и добавить предметы</button>
        <span class="text-xs text-slate-500">Состав кейса настраивается на следующем шаге.</span>
      </div>
    </form>

    <div class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Кейс</th>
            <th>Цена</th>
            <th>Предметов</th>
            <th>EV дропа</th>
            <th>RTP</th>
            <th>Открытий</th>
            <th>Статус</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data?.cases" :key="row.id">
            <td>
              <NuxtLink :to="`/admin/cases/${row.id}`" class="font-semibold hover:text-accent-400">
                {{ row.title }}
              </NuxtLink>
              <p class="font-mono text-xs text-slate-500">{{ row.slug }}</p>
            </td>
            <td class="font-mono text-accent-400">{{ money(row.price) }}</td>
            <td class="font-mono">{{ row.itemsCount ?? 0 }}</td>
            <td class="font-mono text-slate-400">{{ money(row.expectedValue) }}</td>
            <td class="font-mono" :class="(row.rtp ?? 0) > 1 ? 'text-red-400' : 'text-green-400'">
              {{ percent(row.rtp ?? 0, 1) }}
            </td>
            <td class="font-mono text-slate-400">{{ row.openingsCount }}</td>
            <td>
              <button
                class="chip"
                :class="row.active ? 'border-green-500/40 text-green-400' : 'text-slate-500'"
                @click="toggleActive(row)"
              >
                {{ row.active ? 'активен' : 'выключен' }}
              </button>
            </td>
            <td class="text-right">
              <NuxtLink :to="`/admin/cases/${row.id}`" class="btn-ghost btn-sm">Изменить</NuxtLink>
              <button class="btn-ghost btn-sm ml-1 text-red-400" @click="remove(row)">Удалить</button>
            </td>
          </tr>
          <tr v-if="!data?.cases?.length">
            <td colspan="8" class="py-8 text-center text-slate-500">Кейсов пока нет.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
