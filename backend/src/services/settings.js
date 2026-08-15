import { prisma } from '../db.js'
import { badRequest } from '../lib/errors.js'

/**
 * Экономика площадки в одном месте. Значения лежат в таблице Setting
 * (key/value), схема ниже описывает тип, границы и подпись для админки.
 * Всё, что не задано в базе, берётся из default — приложение работает
 * на чистой базе без предварительной настройки.
 *
 * money — целые минимальные единицы (копейки/центы).
 */
export const SETTINGS_SCHEMA = {
  // --- Кейсы ---
  'cases.sellRate': {
    type: 'ratio',
    default: 0.9,
    min: 0,
    max: 1,
    group: 'cases',
    label: 'Возврат при продаже предмета',
    hint: 'Доля рыночной цены, которую игрок получает, продавая дроп обратно.',
  },
  'cases.maxOpenAtOnce': {
    type: 'int',
    default: 5,
    min: 1,
    max: 10,
    group: 'cases',
    label: 'Кейсов за одно открытие',
    hint: 'Сколько рулеток крутится одновременно.',
  },

  // --- Кошелёк ---
  'wallet.minDeposit': {
    type: 'money',
    default: 500,
    min: 1,
    max: 100_000_00,
    group: 'wallet',
    label: 'Минимальное пополнение',
  },
  'wallet.maxDeposit': {
    type: 'money',
    default: 100_000,
    min: 1,
    max: 100_000_00,
    group: 'wallet',
    label: 'Максимальное пополнение',
  },

  // --- Рулетка (колесо против площадки) ---
  'roulette.enabled': {
    type: 'bool',
    default: true,
    group: 'roulette',
    label: 'Рулетка включена',
  },
  'roulette.redSlots': {
    type: 'int',
    default: 7,
    min: 1,
    max: 30,
    group: 'roulette',
    label: 'Красных секторов',
  },
  'roulette.blackSlots': {
    type: 'int',
    default: 7,
    min: 1,
    max: 30,
    group: 'roulette',
    label: 'Чёрных секторов',
  },
  'roulette.greenSlots': {
    type: 'int',
    default: 1,
    min: 1,
    max: 10,
    group: 'roulette',
    label: 'Зелёных секторов',
  },
  'roulette.payoutColor': {
    type: 'number',
    default: 2,
    min: 1.01,
    max: 50,
    group: 'roulette',
    label: 'Множитель красное/чёрное',
  },
  'roulette.payoutGreen': {
    type: 'number',
    default: 14,
    min: 1.01,
    max: 200,
    group: 'roulette',
    label: 'Множитель зелёного',
  },
  'roulette.bettingSeconds': {
    type: 'int',
    default: 20,
    min: 5,
    max: 180,
    group: 'roulette',
    label: 'Приём ставок, секунд',
  },
  'roulette.spinSeconds': {
    type: 'int',
    default: 7,
    min: 3,
    max: 30,
    group: 'roulette',
    label: 'Прокрутка колеса, секунд',
  },
  'roulette.minBet': {
    type: 'money',
    default: 100,
    min: 1,
    max: 100_000_00,
    group: 'roulette',
    label: 'Минимальная ставка',
  },
  'roulette.maxBet': {
    type: 'money',
    default: 50_000,
    min: 1,
    max: 100_000_00,
    group: 'roulette',
    label: 'Максимальная ставка на цвет',
  },

  // --- Коинфлип ---
  'coinflip.enabled': {
    type: 'bool',
    default: true,
    group: 'coinflip',
    label: 'Коинфлип включён',
  },
  'coinflip.winChance': {
    type: 'ratio',
    default: 0.5,
    min: 0.01,
    max: 0.99,
    group: 'coinflip',
    label: 'Шанс победы',
  },
  'coinflip.payout': {
    type: 'number',
    default: 1.9,
    min: 1.01,
    max: 100,
    group: 'coinflip',
    label: 'Множитель выигрыша',
  },
  'coinflip.minBet': {
    type: 'money',
    default: 100,
    min: 1,
    max: 100_000_00,
    group: 'coinflip',
    label: 'Минимальная ставка',
  },
  'coinflip.maxBet': {
    type: 'money',
    default: 50_000,
    min: 1,
    max: 100_000_00,
    group: 'coinflip',
    label: 'Максимальная ставка',
  },
}

export const SETTINGS_GROUPS = {
  cases: 'Кейсы',
  wallet: 'Кошелёк',
  roulette: 'Рулетка',
  coinflip: 'Коинфлип',
}

let cache = null

function decode(key, raw) {
  const spec = SETTINGS_SCHEMA[key]
  if (!spec) return raw
  if (spec.type === 'bool') return raw === 'true'
  if (spec.type === 'int' || spec.type === 'money') return Number.parseInt(raw, 10)
  return Number.parseFloat(raw)
}

function encode(value) {
  return String(value)
}

/** Проверяет значение по схеме и приводит к нужному типу. */
export function validateSetting(key, value) {
  const spec = SETTINGS_SCHEMA[key]
  if (!spec) throw badRequest(`Неизвестная настройка: ${key}`)

  if (spec.type === 'bool') {
    if (typeof value !== 'boolean') throw badRequest(`${spec.label}: ожидается true/false`)
    return value
  }

  const num = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(num)) throw badRequest(`${spec.label}: ожидается число`)
  if (spec.type === 'int' || spec.type === 'money') {
    if (!Number.isInteger(num)) throw badRequest(`${spec.label}: ожидается целое число`)
  }
  if (spec.min !== undefined && num < spec.min) {
    throw badRequest(`${spec.label}: минимум ${spec.min}`)
  }
  if (spec.max !== undefined && num > spec.max) {
    throw badRequest(`${spec.label}: максимум ${spec.max}`)
  }
  return num
}

/** Все настройки: значения из базы поверх значений по умолчанию. */
export async function getSettings() {
  if (cache) return cache

  const rows = await prisma.setting.findMany()
  const stored = new Map(rows.map((row) => [row.key, row.value]))

  const result = {}
  for (const [key, spec] of Object.entries(SETTINGS_SCHEMA)) {
    const raw = stored.get(key)
    const value = raw === undefined ? spec.default : decode(key, raw)
    result[key] = Number.isNaN(value) ? spec.default : value
  }

  cache = result
  return result
}

export async function getSetting(key) {
  const all = await getSettings()
  return all[key]
}

export function invalidateSettingsCache() {
  cache = null
}

export async function updateSettings(patch) {
  const entries = Object.entries(patch)
  if (!entries.length) throw badRequest('Нечего сохранять')

  const validated = entries.map(([key, value]) => [key, validateSetting(key, value)])

  // Кросс-проверки: настройки не должны противоречить друг другу.
  const next = { ...(await getSettings()), ...Object.fromEntries(validated) }
  if (next['wallet.minDeposit'] > next['wallet.maxDeposit']) {
    throw badRequest('Минимальное пополнение больше максимального')
  }
  if (next['roulette.minBet'] > next['roulette.maxBet']) {
    throw badRequest('Минимальная ставка рулетки больше максимальной')
  }
  if (next['coinflip.minBet'] > next['coinflip.maxBet']) {
    throw badRequest('Минимальная ставка коинфлипа больше максимальной')
  }

  await prisma.$transaction(
    validated.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: encode(value) },
        create: { key, value: encode(value) },
      }),
    ),
  )

  invalidateSettingsCache()
  return getSettings()
}

/**
 * Сводка по марже: во что превращаются настройки для игрока.
 * RTP > 1 означает, что игра работает в убыток площадке.
 */
export function economySummary(settings) {
  const red = settings['roulette.redSlots']
  const black = settings['roulette.blackSlots']
  const green = settings['roulette.greenSlots']
  const total = red + black + green

  const colorChance = red / total
  const greenChance = green / total
  const colorRtp = colorChance * settings['roulette.payoutColor']
  const greenRtp = greenChance * settings['roulette.payoutGreen']
  const coinflipRtp = settings['coinflip.winChance'] * settings['coinflip.payout']

  return {
    roulette: {
      totalSlots: total,
      colorChance,
      greenChance,
      colorRtp,
      colorEdge: 1 - colorRtp,
      greenRtp,
      greenEdge: 1 - greenRtp,
    },
    coinflip: {
      chance: settings['coinflip.winChance'],
      payout: settings['coinflip.payout'],
      rtp: coinflipRtp,
      edge: 1 - coinflipRtp,
    },
    cases: {
      sellRate: settings['cases.sellRate'],
    },
  }
}
