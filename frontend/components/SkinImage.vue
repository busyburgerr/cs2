<script setup lang="ts">
/**
 * Картинка скина. Если у предмета задан image — показываем его,
 * иначе рисуем векторный силуэт по типу оружия, подкрашенный редкостью.
 * Так витрина не зависит от внешнего CDN.
 */
const props = defineProps<{
  item: { name: string; weapon: string; rarity: string; image?: string | null }
  size?: 'sm' | 'md' | 'lg'
}>()

const failed = ref(false)
watch(() => props.item?.image, () => (failed.value = false))

const color = computed(() => rarityColor(props.item.rarity))

const kind = computed(() => {
  const w = props.item.weapon.toLowerCase()
  if (w.includes('glove')) return 'glove'
  if (w.includes('★') || w.includes('knife') || w.includes('bayonet') || w.includes('karambit'))
    return 'knife'
  if (
    ['glock', 'usp', 'p250', 'deagle', 'desert eagle', 'five-seven', 'tec-9', 'p2000', 'r8'].some(
      (p) => w.includes(p),
    )
  )
    return 'pistol'
  return 'rifle'
})

const uid = useId()
</script>

<template>
  <div class="relative flex items-center justify-center">
    <img
      v-if="item.image && !failed"
      :src="item.image"
      :alt="item.name"
      class="h-full w-full object-contain"
      loading="lazy"
      @error="failed = true"
    />
    <svg v-else viewBox="0 0 240 120" class="h-full w-full" role="img" :aria-label="item.name">
      <defs>
        <linearGradient :id="`g-${uid}`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.95" />
          <stop offset="100%" :stop-color="color" stop-opacity="0.45" />
        </linearGradient>
        <filter :id="`f-${uid}`" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g :fill="`url(#g-${uid})`" :filter="`url(#f-${uid})`">
        <template v-if="kind === 'rifle'">
          <rect x="150" y="49" width="82" height="7" rx="3" />
          <rect x="62" y="43" width="96" height="21" rx="4" />
          <polygon points="62,44 20,51 14,67 58,65" />
          <polygon points="96,64 114,64 107,93 88,93" />
          <path d="M120 64 h24 l-5 32 h-22 z" />
          <rect x="104" y="33" width="42" height="7" rx="3" />
        </template>

        <template v-else-if="kind === 'pistol'">
          <rect x="68" y="44" width="106" height="18" rx="4" />
          <rect x="170" y="49" width="16" height="8" rx="2" />
          <polygon points="96,62 126,62 118,102 86,102" />
          <path d="M126 62 h14 v10 a22 22 0 0 1 -22 12 v-8 a14 14 0 0 0 8 -14 z" />
        </template>

        <template v-else-if="kind === 'knife'">
          <polygon points="34,76 128,38 152,54 62,86" />
          <polygon points="148,48 208,62 205,78 145,68" />
          <circle cx="196" cy="70" r="5" fill="#0a0b0f" opacity="0.6" />
        </template>

        <template v-else>
          <path
            d="M70 44 h58 a16 16 0 0 1 16 16 v20 a18 18 0 0 1 -18 18 H74 a18 18 0 0 1 -18 -18 V62 a18 18 0 0 1 14 -18 z"
          />
          <rect x="74" y="26" width="13" height="24" rx="6" />
          <rect x="92" y="20" width="13" height="30" rx="6" />
          <rect x="110" y="24" width="13" height="26" rx="6" />
          <rect x="128" y="32" width="13" height="20" rx="6" />
        </template>
      </g>
    </svg>
  </div>
</template>
