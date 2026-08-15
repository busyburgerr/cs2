/**
 * Стартовая инициализация: профиль игрока и настройки площадки.
 *
 * Профиль подтягиваем и на сервере, и в браузере — токен лежит в cookie,
 * поэтому SSR отдаёт ту же разметку, что рисует клиент, и гидрация не ломается.
 */
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  await Promise.all([auth.fetchMe(), loadSiteConfig()])
})
