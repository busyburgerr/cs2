import { defineStore } from 'pinia'

export interface User {
  id: string
  email: string
  username: string
  role: 'USER' | 'ADMIN'
  balance: number
  createdAt: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const ready = ref(false)
  const token = useAuthToken()

  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')
  const balance = computed(() => user.value?.balance ?? 0)

  async function fetchMe() {
    if (!token.value) {
      user.value = null
      ready.value = true
      return null
    }
    try {
      const api = useApi()
      const { user: me } = await api<{ user: User }>('/auth/me')
      user.value = me
    } catch {
      token.value = null
      user.value = null
    } finally {
      ready.value = true
    }
    return user.value
  }

  async function login(email: string, password: string) {
    const api = useApi()
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    token.value = res.token
    user.value = res.user
    return res.user
  }

  async function register(payload: {
    email: string
    username: string
    password: string
    ageConfirmed: boolean
  }) {
    const api = useApi()
    const res = await api<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: payload,
    })
    token.value = res.token
    user.value = res.user
    return res.user
  }

  function logout() {
    token.value = null
    user.value = null
    navigateTo('/')
  }

  /** Локально синхронизирует баланс после открытия кейса / продажи / пополнения. */
  function setBalance(value: number) {
    if (user.value) user.value.balance = value
  }

  return { user, ready, isLoggedIn, isAdmin, balance, fetchMe, login, register, logout, setBalance }
})
