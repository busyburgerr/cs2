export interface SiteConfig {
  currency: string
  wallet: { minDeposit: number; maxDeposit: number }
  cases: { sellRate: number; maxOpenAtOnce: number; count: number }
  roulette: {
    enabled: boolean
    minBet: number
    maxBet: number
    payoutColor: number
    payoutGreen: number
  }
  coinflip: {
    enabled: boolean
    winChance: number
    payout: number
    minBet: number
    maxBet: number
  }
  stats: { openingsCount: number }
}

/**
 * Настройки площадки приходят с бэкенда (`/api/config`) — лимиты ставок,
 * множители и включённые игры задаются в админке, фронтенд их только читает.
 */
export function useSiteConfig() {
  return useState<SiteConfig | null>('site-config', () => null)
}

export async function loadSiteConfig() {
  const state = useSiteConfig()
  const currency = useCurrency()
  const api = useApi()
  try {
    const config = await api<SiteConfig>('/config')
    state.value = config
    if (config.currency) currency.value = config.currency
  } catch {
    // Бэкенд недоступен — интерфейс работает на значениях по умолчанию.
  }
  return state.value
}
