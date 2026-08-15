export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.fetchMe()
  if (!auth.isLoggedIn) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
  if (!auth.isAdmin) {
    return abortNavigation({ statusCode: 403, statusMessage: 'Доступ только для администратора' })
  }
})
