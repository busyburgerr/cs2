<script setup lang="ts">
defineProps<{
  caseData: {
    slug: string
    title: string
    description?: string | null
    image?: string | null
    price: number
    itemsCount?: number
    rtp?: number
  }
}>()

const { money } = useFormat()
</script>

<template>
  <NuxtLink
    :to="`/cases/${caseData.slug}`"
    class="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-700/70 bg-ink-900/70
           p-4 transition hover:-translate-y-1 hover:border-accent-500/60 hover:shadow-[0_18px_40px_-20px_rgba(245,158,11,.55)]"
  >
    <div
      class="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
      style="background: radial-gradient(90% 60% at 50% 0%, rgba(245, 158, 11, 0.14), transparent 70%)"
    />

    <div class="relative mx-auto flex h-32 w-full items-center justify-center">
      <img
        v-if="caseData.image"
        :src="caseData.image"
        :alt="caseData.title"
        class="h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,.6)]"
      />
      <svg v-else viewBox="0 0 200 140" class="h-full">
        <defs>
          <linearGradient id="caseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3a4155" />
            <stop offset="100%" stop-color="#1b1f2c" />
          </linearGradient>
        </defs>
        <path d="M28 46 L100 22 L172 46 L172 108 L100 132 L28 108 Z" fill="url(#caseGrad)" />
        <path d="M28 46 L100 70 L172 46 L100 22 Z" fill="#4b5266" />
        <path d="M100 70 L100 132 L172 108 L172 46 Z" fill="#131722" opacity=".55" />
        <rect x="86" y="58" width="28" height="26" rx="4" fill="#f59e0b" />
        <rect x="94" y="66" width="12" height="12" rx="2" fill="#0a0b0f" />
      </svg>
    </div>

    <h3 class="relative mt-3 truncate text-base font-bold text-slate-100">{{ caseData.title }}</h3>
    <p v-if="caseData.description" class="relative mt-1 line-clamp-2 text-xs text-slate-400">
      {{ caseData.description }}
    </p>

    <div class="relative mt-4 flex items-center justify-between">
      <span class="chip">{{ caseData.itemsCount ?? '—' }} предметов</span>
      <span
        class="rounded-lg bg-accent-500 px-3 py-1.5 font-mono text-sm font-bold text-ink-950
               transition group-hover:bg-accent-400"
      >
        {{ money(caseData.price) }}
      </span>
    </div>
  </NuxtLink>
</template>
