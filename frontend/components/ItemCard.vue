<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    item: {
      name: string
      weapon: string
      skin: string
      rarity: string
      wear: string
      statTrak?: boolean
      price: number
      image?: string | null
    }
    chance?: number
    compact?: boolean
    highlight?: boolean
  }>(),
  { compact: false, highlight: false },
)

const { money, chance: fmtChance } = useFormat()
const color = computed(() => rarityColor(props.item.rarity))
</script>

<template>
  <div
    class="group relative overflow-hidden rounded-xl border bg-ink-900/90 transition"
    :class="[
      highlight ? 'border-transparent ring-2' : 'border-ink-700/70 hover:border-ink-600',
      compact ? 'p-2' : 'p-3',
    ]"
    :style="highlight ? { '--tw-ring-color': color, boxShadow: `0 0 34px -8px ${color}` } : undefined"
  >
    <!-- полоса редкости -->
    <div class="absolute inset-x-0 top-0 h-[3px]" :style="{ background: color }" />
    <div
      class="pointer-events-none absolute inset-0 opacity-25"
      :style="{ background: `radial-gradient(120% 80% at 50% 115%, ${color}55, transparent 65%)` }"
    />

    <div class="relative">
      <div class="flex items-start justify-between gap-2">
        <span
          v-if="item.statTrak"
          class="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-400"
        >
          StatTrak™
        </span>
        <span v-else class="text-[10px] font-medium uppercase tracking-wide" :style="{ color }">
          {{ RARITY_LABELS[item.rarity] || item.rarity }}
        </span>
        <span class="chip shrink-0">{{ item.wear }}</span>
      </div>

      <SkinImage :item="item" :class="compact ? 'h-16' : 'h-24'" class="my-2" />

      <div class="min-w-0">
        <p class="truncate text-xs text-slate-400">{{ item.weapon }}</p>
        <p class="truncate text-sm font-semibold text-slate-100" :title="item.skin">
          {{ item.skin }}
        </p>
      </div>

      <div class="mt-2 flex items-center justify-between gap-2">
        <span class="font-mono text-sm font-bold text-accent-400">{{ money(item.price) }}</span>
        <span v-if="chance !== undefined" class="chip font-mono">{{ fmtChance(chance) }}</span>
      </div>

      <slot name="footer" />
    </div>
  </div>
</template>
