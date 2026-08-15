<script setup lang="ts">
/**
 * Демо-режим виден всегда и везде: аккаунт играет на виртуальном балансе,
 * результат может быть задан администратором. Полоса намеренно заметная —
 * если такой экран попадёт в промо-ролик, зритель увидит, что это демо.
 */
const auth = useAuthStore()
</script>

<template>
  <div
    v-if="auth.user?.demo"
    class="relative overflow-hidden border-b border-amber-400/30 bg-amber-500/10"
  >
    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
      <span class="rounded-lg bg-amber-400 px-2 py-0.5 text-[11px] font-black text-ink-950">
        ДЕМО-РЕЖИМ
      </span>
      <span class="text-xs font-semibold text-amber-200">
        Виртуальный баланс, реальные деньги не участвуют
      </span>
      <span class="text-xs text-amber-200/70">
        Результат игры может быть задан администратором
      </span>
    </div>
  </div>
</template>
