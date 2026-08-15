<script setup lang="ts">
const api = useApi()
const auth = useAuthStore()
const { dateTime } = useFormat()

const seeds = ref<any>(null)
const seedError = ref('')
const newClientSeed = ref('')
const busy = ref(false)

async function loadSeeds() {
  if (!auth.isLoggedIn) return
  try {
    seeds.value = await api<any>('/me/seeds')
    newClientSeed.value = seeds.value.current.clientSeed
  } catch (err: any) {
    seedError.value = apiError(err)
  }
}
onMounted(loadSeeds)
watch(() => auth.isLoggedIn, loadSeeds)

async function saveClientSeed() {
  busy.value = true
  seedError.value = ''
  try {
    await api('/me/seeds/client', { method: 'POST', body: { clientSeed: newClientSeed.value } })
    await loadSeeds()
  } catch (err: any) {
    seedError.value = apiError(err)
  } finally {
    busy.value = false
  }
}

async function rotate() {
  busy.value = true
  seedError.value = ''
  try {
    await api('/me/seeds/rotate', { method: 'POST' })
    await loadSeeds()
  } catch (err: any) {
    seedError.value = apiError(err)
  } finally {
    busy.value = false
  }
}

// --- проверка в браузере ---

const check = reactive({ serverSeed: '', clientSeed: '', nonce: 0, totalTickets: 100000 })
const checkResult = ref<{ hash: string; hmac: string; roll: number } | null>(null)

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function verify() {
  const enc = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(check.serverSeed))
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(check.serverSeed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${check.clientSeed}:${check.nonce}`))
  const hmacHex = toHex(sig)
  const roll = Number.parseInt(hmacHex.slice(0, 13), 16) % check.totalTickets

  checkResult.value = { hash: toHex(digest), hmac: hmacHex, roll }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <h1 class="text-2xl font-black">Проверяемая честность</h1>
      <p class="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        Результат открытия определяется до того, как вы нажали кнопку, и не зависит от того,
        какой предмет вам выгоднее выдать. Проверить это можно самостоятельно.
      </p>
    </div>

    <section class="card p-6">
      <h2 class="font-bold">Как считается дроп</h2>
      <ol class="mt-3 space-y-2 text-sm text-slate-400">
        <li>
          <span class="font-semibold text-slate-200">1.</span> Сервер генерирует случайный
          <span class="font-mono text-accent-400">serverSeed</span> и публикует только его
          SHA-256 хеш. Подменить сид задним числом нельзя — хеш перестанет сходиться.
        </li>
        <li>
          <span class="font-semibold text-slate-200">2.</span> Вы задаёте свой
          <span class="font-mono text-accent-400">clientSeed</span>. Каждое открытие увеличивает
          счётчик <span class="font-mono text-accent-400">nonce</span> на единицу.
        </li>
        <li>
          <span class="font-semibold text-slate-200">3.</span> Билет считается как
          <span class="font-mono text-xs text-slate-300">
            int(HMAC_SHA256(serverSeed, clientSeed + ":" + nonce)[0..13]) % totalTickets
          </span>
        </li>
        <li>
          <span class="font-semibold text-slate-200">4.</span> Предметы кейса занимают непрерывные
          диапазоны билетов пропорционально своим весам — тот, в чей диапазон попал билет, и выпал.
        </li>
        <li>
          <span class="font-semibold text-slate-200">5.</span> После смены серверного сида старый
          раскрывается, и все прошлые открытия можно пересчитать.
        </li>
      </ol>
    </section>

    <section v-if="auth.isLoggedIn" class="card p-6">
      <h2 class="font-bold">Ваши сиды</h2>
      <p v-if="seedError" class="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
        {{ seedError }}
      </p>

      <div v-if="seeds" class="mt-4 space-y-4">
        <div>
          <p class="label">Хеш текущего серверного сида</p>
          <p class="break-all rounded-lg bg-ink-950 px-3 py-2 font-mono text-xs text-slate-300">
            {{ seeds.current.serverSeedHash }}
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="cs">Клиентский сид</label>
            <div class="flex gap-2">
              <input id="cs" v-model="newClientSeed" class="input font-mono text-xs" maxlength="64" />
              <button class="btn-ghost" :disabled="busy" @click="saveClientSeed">Сохранить</button>
            </div>
          </div>
          <div>
            <p class="label">Текущий nonce</p>
            <p class="rounded-lg bg-ink-950 px-3 py-2 font-mono text-sm">{{ seeds.current.nonce }}</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 border-t border-ink-800 pt-4">
          <button class="btn-ghost" :disabled="busy" @click="rotate">Сменить серверный сид</button>
          <p class="text-xs text-slate-500">
            Старый сид будет раскрыт, nonce обнулится. Делайте это до открытия, если сомневаетесь.
          </p>
        </div>

        <div v-if="seeds.history?.length">
          <p class="label mt-2">Раскрытые сиды</p>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Серверный сид</th>
                  <th>Клиентский</th>
                  <th>Бросков</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="pair in seeds.history" :key="pair.id">
                  <td class="whitespace-nowrap text-slate-400">{{ dateTime(pair.revealedAt) }}</td>
                  <td class="max-w-[16rem] truncate font-mono text-xs">
                    <button class="hover:text-accent-400" @click="check.serverSeed = pair.serverSeed">
                      {{ pair.serverSeed }}
                    </button>
                  </td>
                  <td class="font-mono text-xs">{{ pair.clientSeed }}</td>
                  <td class="font-mono">{{ pair.nonceUsed }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section class="card p-6">
      <h2 class="font-bold">Калькулятор проверки</h2>
      <p class="mt-1 text-sm text-slate-400">
        Считается прямо в браузере через Web Crypto — данные никуда не отправляются.
      </p>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="label" for="ss">Серверный сид (раскрытый)</label>
          <input id="ss" v-model="check.serverSeed" class="input font-mono text-xs" />
        </div>
        <div>
          <label class="label" for="cs2">Клиентский сид</label>
          <input id="cs2" v-model="check.clientSeed" class="input font-mono text-xs" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="nn">Nonce</label>
            <input id="nn" v-model.number="check.nonce" type="number" min="0" class="input font-mono" />
          </div>
          <div>
            <label class="label" for="tt">Всего билетов</label>
            <input id="tt" v-model.number="check.totalTickets" type="number" min="1" class="input font-mono" />
          </div>
        </div>
      </div>

      <button class="btn-primary mt-4" @click="verify">Проверить</button>

      <div v-if="checkResult" class="mt-4 space-y-2 rounded-lg border border-ink-700 bg-ink-950 p-4 text-xs">
        <p>
          <span class="text-slate-500">SHA-256 серверного сида:</span>
          <span class="ml-2 break-all font-mono text-slate-300">{{ checkResult.hash }}</span>
        </p>
        <p>
          <span class="text-slate-500">HMAC:</span>
          <span class="ml-2 break-all font-mono text-slate-300">{{ checkResult.hmac }}</span>
        </p>
        <p class="text-sm">
          <span class="text-slate-500">Билет:</span>
          <span class="ml-2 font-mono text-lg font-bold text-accent-400">{{ checkResult.roll }}</span>
        </p>
      </div>
    </section>
  </div>
</template>
