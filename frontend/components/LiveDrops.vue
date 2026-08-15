<script setup lang="ts">
const api = useApi()
const { money, timeAgo } = useFormat()

const { data, refresh } = await useAsyncData('live-drops', () =>
  api<{ openings: any[] }>('/openings/live?limit=16'),
)

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(refresh, 8000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <section v-if="data?.openings?.length" class="card overflow-hidden p-3">
    <div class="mb-2 flex items-center gap-2">
      <span class="relative flex h-2 w-2">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span class="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Последние дропы</h2>
    </div>

    <div class="flex gap-2 overflow-x-auto pb-1">
      <div
        v-for="drop in data.openings"
        :key="drop.id"
        class="relative w-32 shrink-0 overflow-hidden rounded-lg border border-ink-800 bg-ink-900 p-2 animate-fade-up"
      >
        <div class="absolute inset-x-0 top-0 h-[3px]" :style="{ background: rarityColor(drop.item.rarity) }" />
        <SkinImage :item="drop.item" class="h-12 w-full" />
        <p class="mt-1 truncate text-[11px] text-slate-400">{{ drop.item.weapon }}</p>
        <p class="truncate text-xs font-semibold text-slate-200">{{ drop.item.skin }}</p>
        <div class="mt-1 flex items-center justify-between">
          <span class="truncate text-[10px] text-slate-500">{{ drop.user?.username }}</span>
          <span class="font-mono text-[11px] font-bold text-accent-400">{{ money(drop.value) }}</span>
        </div>
        <p class="mt-0.5 text-[10px] text-slate-600">{{ timeAgo(drop.createdAt) }}</p>
      </div>
    </div>
  </section>
</template>
