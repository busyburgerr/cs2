/**
 * Валюта приходит с бэкенда (`/payments/config`) и живёт в общем состоянии,
 * чтобы фронтенд не приходилось настраивать отдельно. Значение из
 * NUXT_PUBLIC_CURRENCY используется как запасное.
 */
export function useCurrency() {
  const { public: pub } = useRuntimeConfig()
  return useState<string>('currency', () => pub.currency || 'USD')
}

export function useFormat() {
  const currency = useCurrency()
  const code = currency.value || 'USD'

  const formatter = new Intl.NumberFormat(code === 'RUB' ? 'ru-RU' : 'en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
  })

  /** Суммы во всём проекте хранятся в минимальных единицах (центах). */
  const money = (cents: number | null | undefined) => formatter.format((cents ?? 0) / 100)

  const percent = (value: number, digits = 2) => `${(value * 100).toFixed(digits)}%`

  const chance = (value: number) => {
    if (value >= 0.01) return `${(value * 100).toFixed(2)}%`
    if (value >= 0.0001) return `${(value * 100).toFixed(4)}%`
    return `1 : ${Math.round(1 / value).toLocaleString('ru-RU')}`
  }

  const dateTime = (value: string | Date) =>
    new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  const timeAgo = (value: string | Date) => {
    const diff = (Date.now() - new Date(value).getTime()) / 1000
    if (diff < 60) return 'только что'
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
    return `${Math.floor(diff / 86400)} дн назад`
  }

  return { money, percent, chance, dateTime, timeAgo }
}

export const RARITY_LABELS: Record<string, string> = {
  CONSUMER: 'Ширпотреб',
  INDUSTRIAL: 'Промышленное',
  MILSPEC: 'Армейское',
  RESTRICTED: 'Запрещённое',
  CLASSIFIED: 'Засекреченное',
  COVERT: 'Тайное',
  CONTRABAND: 'Контрабанда',
}

export const RARITY_COLORS: Record<string, string> = {
  CONSUMER: '#b0c3d9',
  INDUSTRIAL: '#5e98d9',
  MILSPEC: '#4b69ff',
  RESTRICTED: '#8847ff',
  CLASSIFIED: '#d32ce6',
  COVERT: '#eb4b4b',
  CONTRABAND: '#e4ae39',
}

export const RARITY_ORDER = [
  'CONSUMER',
  'INDUSTRIAL',
  'MILSPEC',
  'RESTRICTED',
  'CLASSIFIED',
  'COVERT',
  'CONTRABAND',
]

export const WEAR_LABELS: Record<string, string> = {
  FN: 'Прямо с завода',
  MW: 'Немного поношенное',
  FT: 'После полевых',
  WW: 'Поношенное',
  BS: 'Закалённое в боях',
}

export const rarityColor = (rarity: string) => RARITY_COLORS[rarity] ?? '#94a3b8'
