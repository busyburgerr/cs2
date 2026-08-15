<script setup lang="ts">
interface Skin {
  id: string
  name: string
  weapon: string
  skin: string
  rarity: string
  wear: string
  price: number
  image?: string | null
}

const props = withDefaults(
  defineProps<{
    /** Пул предметов кейса — из чего собирается лента. */
    pool: Skin[]
    /** Победитель, определённый сервером. */
    winner?: Skin | null
    /** Инкремент этого числа запускает прокрутку. */
    token: number
    duration?: number
  }>(),
  { duration: 6200 },
)

const emit = defineEmits<{ finished: [Skin] }>()

const SLOT_W = 132 // ширина ячейки, px
const GAP = 8
const STEP = SLOT_W + GAP
const STRIP_LEN = 64
const WINNER_INDEX = 56

const wrap = ref<HTMLElement | null>(null)
const strip = ref<Skin[]>([])
const offset = ref(0)
const transition = ref('none')
const spinning = ref(false)

function randomSkin(): Skin {
  return props.pool[Math.floor(Math.random() * props.pool.length)]
}

function buildIdleStrip() {
  if (!props.pool.length) return
  strip.value = Array.from({ length: STRIP_LEN }, randomSkin)
  offset.value = -STEP * 4
}

// Лента набирается случайно, поэтому собираем её только в браузере:
// на сервере состав получился бы другим и сломал гидрацию.
onMounted(() => {
  buildIdleStrip()
  watch(() => props.pool, buildIdleStrip, { deep: false })
})

let fallbackTimer: ReturnType<typeof setTimeout> | undefined

function settle() {
  if (!spinning.value) return
  clearTimeout(fallbackTimer)
  spinning.value = false
  if (props.winner) emit('finished', props.winner)
}

async function spin() {
  if (!props.pool.length || !props.winner) return
  spinning.value = true

  // Лента: случайные предметы, победитель — на фиксированной позиции.
  const next = Array.from({ length: STRIP_LEN }, randomSkin)
  next[WINNER_INDEX] = props.winner
  strip.value = next

  // Сброс без анимации.
  transition.value = 'none'
  offset.value = 0
  await nextTick()
  // Форсируем перерасчёт стилей, иначе браузер склеит два кадра.
  void wrap.value?.offsetHeight

  const viewport = wrap.value?.clientWidth ?? 900
  // Небольшой сдвиг внутри ячейки, чтобы указатель не всегда бил ровно в центр.
  const jitter = (Math.random() - 0.5) * (SLOT_W * 0.6)
  const target = WINNER_INDEX * STEP + SLOT_W / 2 - viewport / 2 + jitter

  transition.value = `transform ${props.duration}ms cubic-bezier(.08,.72,.16,1)`
  offset.value = -target

  // Подстраховка: в фоновой вкладке transitionend может не прийти вовсе.
  clearTimeout(fallbackTimer)
  fallbackTimer = setTimeout(settle, props.duration + 300)
}

function onTransitionEnd(event: TransitionEvent) {
  if (event.propertyName !== 'transform') return
  settle()
}

onUnmounted(() => clearTimeout(fallbackTimer))

watch(
  () => props.token,
  (value) => {
    if (value > 0) spin()
  },
)
</script>

<template>
  <div
    ref="wrap"
    class="relative h-[168px] overflow-hidden rounded-xl border border-ink-700/70 bg-ink-950/80"
  >
    <!-- указатель -->
    <div class="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
      <div class="h-full w-[2px] bg-accent-400 shadow-[0_0_16px_2px_rgba(245,158,11,.8)]" />
      <div
        class="absolute -top-px left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[9px]
               border-x-transparent border-t-accent-400"
      />
      <div
        class="absolute -bottom-px left-1/2 h-0 w-0 -translate-x-1/2 border-x-[7px] border-b-[9px]
               border-x-transparent border-b-accent-400"
      />
    </div>

    <!-- боковые затемнения -->
    <div class="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-ink-950 to-transparent" />
    <div class="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-ink-950 to-transparent" />

    <div
      class="flex h-full items-center py-3"
      :style="{ transform: `translate3d(${offset}px,0,0)`, transition, gap: `${GAP}px` }"
      @transitionend="onTransitionEnd"
    >
      <div
        v-for="(skin, i) in strip"
        :key="`${skin?.id}-${i}`"
        class="relative flex h-full shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg
               border border-ink-800 bg-ink-900"
        :style="{ width: `${SLOT_W}px` }"
      >
        <div class="absolute inset-x-0 top-0 h-[3px]" :style="{ background: rarityColor(skin.rarity) }" />
        <div
          class="absolute inset-0 opacity-30"
          :style="{
            background: `radial-gradient(115% 70% at 50% 110%, ${rarityColor(skin.rarity)}66, transparent 70%)`,
          }"
        />
        <SkinImage :item="skin" class="relative h-14 w-full" />
        <p class="relative mt-1 w-full truncate px-2 text-center text-[11px] text-slate-400">
          {{ skin.weapon }}
        </p>
        <p class="relative w-full truncate px-2 text-center text-xs font-semibold text-slate-200">
          {{ skin.skin }}
        </p>
      </div>
    </div>
  </div>
</template>
