<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const api = useApi()
const { money, percent } = useFormat()

const { data, refresh } = await useAsyncData('admin-settings', () =>
  api<{ groups: Record<string, string>; schema: any[]; values: Record<string, any>; summary: any }>(
    '/admin/settings',
  ),
)

const draft = reactive<Record<string, any>>({})
const saving = ref(false)
const error = ref('')
const notice = ref('')

watchEffect(() => {
  if (data.value) Object.assign(draft, data.value.values)
})

const grouped = computed(() => {
  const groups: Record<string, any[]> = {}
  for (const field of data.value?.schema ?? []) {
    ;(groups[field.group] ??= []).push(field)
  }
  return groups
})

const dirty = computed(() =>
  Object.keys(draft).filter((key) => draft[key] !== data.value?.values?.[key]),
)

/** Пересчитываем маржу прямо в браузере, до сохранения. */
const preview = computed(() => {
  const total = draft['roulette.redSlots'] + draft['roulette.blackSlots'] + draft['roulette.greenSlots']
  const colorChance = total ? draft['roulette.redSlots'] / total : 0
  const greenChance = total ? draft['roulette.greenSlots'] / total : 0
  return {
    totalSlots: total,
    colorChance,
    greenChance,
    colorRtp: colorChance * draft['roulette.payoutColor'],
    greenRtp: greenChance * draft['roulette.payoutGreen'],
    coinflipRtp: draft['coinflip.winChance'] * draft['coinflip.payout'],
  }
})

function edgeClass(rtp: number) {
  if (rtp > 1) return 'text-red-400'
  if (rtp > 0.98) return 'text-amber-400'
  return 'text-emerald-400'
}

async function save() {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const values: Record<string, any> = {}
    for (const key of dirty.value) values[key] = draft[key]
    await api('/admin/settings', { method: 'PUT', body: { values } })
    notice.value = 'Настройки сохранены и применились сразу'
    await refresh()
  } catch (err: any) {
    error.value = apiError(err)
  } finally {
    saving.value = false
  }
}

function reset() {
  if (data.value) Object.assign(draft, data.value.values)
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-black">Экономика</h1>
        <p class="mt-1 text-sm text-slate-400">
          Настройки применяются мгновенно ко всем играм — перезапуск не нужен.
        </p>
      </div>
      <div class="flex gap-2">
        <button class="btn-ghost" :disabled="!dirty.length" @click="reset">Сбросить</button>
        <button class="btn-primary" :disabled="!dirty.length || saving" @click="save">
          {{ saving ? 'Сохраняю...' : `Сохранить${dirty.length ? ` (${dirty.length})` : ''}` }}
        </button>
      </div>
    </div>

    <p v-if="error" class="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
      {{ error }}
    </p>
    <p v-if="notice" class="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
      {{ notice }}
    </p>

    <!-- сводка по марже -->
    <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="card p-4">
        <p class="eyebrow">Рулетка · красное/чёрное</p>
        <p class="mt-1 font-mono text-2xl font-black" :class="edgeClass(preview.colorRtp)">
          {{ percent(preview.colorRtp, 1) }}
        </p>
        <p class="text-xs text-slate-500">
          шанс {{ percent(preview.colorChance, 2) }} · маржа {{ percent(1 - preview.colorRtp, 2) }}
        </p>
      </div>
      <div class="card p-4">
        <p class="eyebrow">Рулетка · зелёное</p>
        <p class="mt-1 font-mono text-2xl font-black" :class="edgeClass(preview.greenRtp)">
          {{ percent(preview.greenRtp, 1) }}
        </p>
        <p class="text-xs text-slate-500">
          шанс {{ percent(preview.greenChance, 2) }} · маржа {{ percent(1 - preview.greenRtp, 2) }}
        </p>
      </div>
      <div class="card p-4">
        <p class="eyebrow">Коинфлип</p>
        <p class="mt-1 font-mono text-2xl font-black" :class="edgeClass(preview.coinflipRtp)">
          {{ percent(preview.coinflipRtp, 1) }}
        </p>
        <p class="text-xs text-slate-500">маржа {{ percent(1 - preview.coinflipRtp, 2) }}</p>
      </div>
      <div class="card p-4">
        <p class="eyebrow">Секторов колеса</p>
        <p class="mt-1 font-mono text-2xl font-black">{{ preview.totalSlots }}</p>
        <p class="text-xs text-slate-500">
          {{ draft['roulette.redSlots'] }} красных · {{ draft['roulette.blackSlots'] }} чёрных ·
          {{ draft['roulette.greenSlots'] }} зелёных
        </p>
      </div>
    </section>

    <p v-if="preview.colorRtp > 1 || preview.greenRtp > 1 || preview.coinflipRtp > 1"
       class="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      Отдача выше 100% — при таких настройках игра работает в убыток площадке.
    </p>

    <!-- поля -->
    <section v-for="(fields, group) in grouped" :key="group" class="card p-5">
      <h2 class="section-title !text-base">{{ data?.groups?.[group] ?? group }}</h2>

      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="field in fields" :key="field.key">
          <label class="label" :for="field.key">{{ field.label }}</label>

          <label v-if="field.type === 'bool'" class="flex cursor-pointer items-center gap-2 py-1.5">
            <input :id="field.key" v-model="draft[field.key]" type="checkbox" class="h-4 w-4 accent-amber-500" />
            <span class="text-sm text-slate-300">{{ draft[field.key] ? 'включено' : 'выключено' }}</span>
          </label>

          <template v-else-if="field.type === 'money'">
            <div class="flex items-center gap-2">
              <input
                :id="field.key"
                class="input font-mono"
                type="number"
                step="0.01"
                :value="(draft[field.key] / 100).toFixed(2)"
                @input="draft[field.key] = Math.round(Number(($event.target as HTMLInputElement).value) * 100)"
              />
            </div>
            <p class="mt-1 text-xs text-slate-500">{{ money(draft[field.key]) }}</p>
          </template>

          <template v-else-if="field.type === 'ratio'">
            <div class="flex items-center gap-2">
              <input
                :id="field.key"
                v-model.number="draft[field.key]"
                class="input font-mono"
                type="number"
                step="0.01"
                :min="field.min"
                :max="field.max"
              />
              <span class="w-14 shrink-0 text-right font-mono text-sm text-accent-400">
                {{ percent(draft[field.key] ?? 0, 0) }}
              </span>
            </div>
          </template>

          <input
            v-else
            :id="field.key"
            v-model.number="draft[field.key]"
            class="input font-mono"
            type="number"
            :step="field.type === 'int' ? 1 : 0.01"
            :min="field.min"
            :max="field.max"
          />

          <p v-if="field.hint" class="mt-1 text-xs leading-relaxed text-slate-500">{{ field.hint }}</p>
          <p
            v-if="draft[field.key] !== data?.values?.[field.key]"
            class="mt-1 text-xs font-semibold text-accent-400"
          >
            изменено (было
            {{ field.type === 'money' ? money(data?.values?.[field.key]) : data?.values?.[field.key] }})
          </p>
        </div>
      </div>
    </section>

    <p class="text-xs leading-relaxed text-slate-500">
      Отдача кейсов настраивается отдельно — весами предметов на странице каждого кейса.
    </p>
  </div>
</template>
