<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number; statusMessage?: string; message?: string } }>()

const title = computed(() => {
  if (props.error.statusCode === 404) return 'Страница не найдена'
  if (props.error.statusCode === 403) return 'Доступ закрыт'
  return 'Что-то сломалось'
})

const hint = computed(() => {
  if (props.error.statusCode === 404) return 'Кейс мог быть отключён или адрес набран с опечаткой.'
  if (props.error.statusCode === 403) return props.error.statusMessage || 'У вашего аккаунта нет прав на этот раздел.'
  return 'Мы уже знаем о проблеме. Попробуйте обновить страницу или вернуться на главную.'
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-ink-950 px-4">
    <div class="card w-full max-w-md p-8 text-center">
      <p class="font-mono text-6xl font-black text-accent-500">{{ error.statusCode }}</p>
      <h1 class="mt-3 text-xl font-bold text-slate-100">{{ title }}</h1>
      <p class="mt-2 text-sm text-slate-400">{{ hint }}</p>

      <div class="mt-6 flex justify-center gap-2">
        <button class="btn-primary" @click="clearError({ redirect: '/' })">На главную</button>
        <NuxtLink to="/fair" class="btn-ghost">Проверка честности</NuxtLink>
      </div>
    </div>
  </div>
</template>
