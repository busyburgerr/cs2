<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0">
    <template v-if="name === 'cases'">
      <path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5z" />
      <path d="M3 8.5 12 13l9-4.5M12 13v7" />
    </template>
    <template v-else-if="name === 'roulette'">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" />
    </template>
    <template v-else-if="name === 'coinflip'">
      <ellipse cx="12" cy="12" rx="5" ry="8.5" />
      <circle cx="12" cy="12" r="8.5" />
    </template>
    <template v-else-if="name === 'inventory'">
      <rect x="3.5" y="7" width="17" height="13" rx="2" />
      <path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7M3.5 12h17" />
    </template>
    <template v-else-if="name === 'history'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </template>
    <template v-else-if="name === 'fair'">
      <path d="M12 3.5 19 6.5v5c0 4-3 7.4-7 9-4-1.6-7-5-7-9v-5z" />
      <path d="m9 12 2 2 4-4" />
    </template>
    <template v-else-if="name === 'wallet'">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M16.5 14.5h1.5" />
    </template>
  </svg>
</template>
