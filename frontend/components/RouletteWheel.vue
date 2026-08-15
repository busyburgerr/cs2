<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Раскладка секторов колеса, приходит с сервера. */
    wheel: string[]
    /** Выпавший сектор — известен только когда колесо крутится. */
    slot: number | null
    phase: string
    spinSeconds: number
  }>(),
  { spinSeconds: 7 },
)

const SLOT_W = 78
const GAP = 6
const STEP = SLOT_W + GAP
const LOOPS = 6

const wrap = ref<HTMLElement | null>(null)
const offset = ref(0)
const transition = ref('none')
const landed = ref(false)

const strip = computed(() => {
  const out: { color: string; index: number }[] = []
  if (!props.wheel.length) return out
  for (let loop = 0; loop < LOOPS; loop++) {
    props.wheel.forEach((color, index) => out.push({ color, index }))
  }
  return out
})

const COLOR_CLASS: Record<string, string> = {
  RED: 'bg-gradient-to-b from-[#f05061] to-[#b4212f] text-white',
  BLACK: 'bg-gradient-to-b from-[#2a3145] to-[#141822] text-slate-300',
  GREEN: 'bg-gradient-to-b from-[#22d17c] to-[#0d8f4c] text-white',
}

async function spinTo(slot: number) {
  if (!props.wheel.length) return
  landed.value = false

  // Стартовая позиция — тот же сектор на первом витке, чтобы лента
  // всегда ехала слева направо на одинаковое расстояние.
  const startIndex = props.wheel.length + slot
  const targetIndex = (LOOPS - 2) * props.wheel.length + slot
  const viewport = wrap.value?.clientWidth ?? 900
  const center = (index: number) => index * STEP + SLOT_W / 2 - viewport / 2

  transition.value = 'none'
  offset.value = -center(startIndex)
  await nextTick()
  void wrap.value?.offsetHeight

  const jitter = (Math.random() - 0.5) * (SLOT_W * 0.5)
  transition.value = `transform ${props.spinSeconds * 1000}ms cubic-bezier(.07,.72,.16,1)`
  offset.value = -(center(targetIndex) + jitter)

  setTimeout(() => (landed.value = true), props.spinSeconds * 1000)
}

function resetToIdle() {
  if (!props.wheel.length) return
  landed.value = false
  const viewport = wrap.value?.clientWidth ?? 900
  const index = props.wheel.length
  transition.value = 'transform 600ms ease-out'
  offset.value = -(index * STEP + SLOT_W / 2 - viewport / 2)
}

watch(
  () => [props.phase, props.slot] as const,
  ([phase, slot], old) => {
    if (phase === 'SPINNING' && slot !== null && old?.[1] !== slot) spinTo(slot)
    if (phase === 'BETTING' && old?.[0] === 'SPINNING') resetToIdle()
  },
)

onMounted(() => {
  if (props.phase === 'SPINNING' && props.slot !== null) spinTo(props.slot)
  else resetToIdle()
})
</script>

<template>
  <div
    ref="wrap"
    class="relative h-28 overflow-hidden rounded-2xl border border-white/[.07] bg-ink-975/80"
  >
    <!-- указатель -->
    <div class="pointer-events-none absolute inset-y-0 left-1/2 z-20 -translate-x-1/2">
      <div class="h-full w-[3px] bg-accent-400 shadow-[0_0_18px_3px_rgba(245,158,11,.85)]" />
      <div class="absolute -top-px left-1/2 h-0 w-0 -translate-x-1/2 border-x-[8px] border-t-[10px] border-x-transparent border-t-accent-400" />
      <div class="absolute -bottom-px left-1/2 h-0 w-0 -translate-x-1/2 border-x-[8px] border-b-[10px] border-x-transparent border-b-accent-400" />
    </div>

    <div class="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-ink-975 to-transparent" />
    <div class="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-ink-975 to-transparent" />

    <div
      class="flex h-full items-center py-4"
      :style="{ transform: `translate3d(${offset}px,0,0)`, transition, gap: `${GAP}px` }"
    >
      <div
        v-for="(cell, i) in strip"
        :key="i"
        class="grid h-full shrink-0 place-items-center rounded-xl border border-black/30 font-mono text-lg font-black shadow-inner transition"
        :class="[
          COLOR_CLASS[cell.color],
          landed && slot === cell.index ? 'scale-105 ring-2 ring-accent-400' : '',
        ]"
        :style="{ width: `${SLOT_W}px` }"
      >
        {{ cell.index }}
      </div>
    </div>
  </div>
</template>
