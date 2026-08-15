/**
 * Клиент API: подставляет базовый URL и Bearer-токен из cookie.
 */
export function useAuthToken() {
  return useCookie<string | null>('token', {
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
    path: '/',
  })
}

export function useApi() {
  const config = useRuntimeConfig()
  const token = useAuthToken()

  return $fetch.create({
    baseURL: config.public.apiBase,
    onRequest({ options }) {
      if (token.value) {
        const headers = new Headers(options.headers as HeadersInit)
        headers.set('Authorization', `Bearer ${token.value}`)
        options.headers = headers
      }
    },
  })
}

/** Достаёт текст ошибки из ответа API. */
export function apiError(err: any, fallback = 'Что-то пошло не так'): string {
  return err?.data?.error || err?.message || fallback
}
