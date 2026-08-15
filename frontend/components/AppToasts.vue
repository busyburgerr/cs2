<script setup lang="ts">
const toasts = useToasts()
const { dismiss } = useToast()

const TONE = {
  win: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  lose: 'border-red-400/35 bg-red-500/10 text-red-300',
  info: 'border-white/10 bg-ink-900/90 text-slate-200',
  error: 'border-red-400/50 bg-red-500/15 text-red-200',
}
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto w-full max-w-sm animate-slide-in rounded-xl border px-4 py-3 shadow-card backdrop-blur"
        :class="TONE[toast.tone]"
        @click="dismiss(toast.id)"
      >
        <p class="text-sm font-bold">{{ toast.title }}</p>
        <p v-if="toast.text" class="mt-0.5 text-xs opacity-80">{{ toast.text }}</p>
      </div>
    </div>
  </Teleport>
</template>
