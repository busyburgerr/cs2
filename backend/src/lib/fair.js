import crypto from 'node:crypto'

/**
 * Provably fair.
 *
 * Сервер заранее генерирует serverSeed и публикует его SHA-256 хеш.
 * Пользователь задаёт clientSeed. Для каждого открытия:
 *
 *   hmac  = HMAC_SHA256(key = serverSeed, msg = `${clientSeed}:${nonce}`)
 *   roll  = int(hmac[0..13]) % totalWeight
 *
 * Диапазоны тикетов раздаются по кумулятивной сумме весов предметов
 * (целочисленно, без округлений), поэтому результат воспроизводим
 * до байта после раскрытия serverSeed.
 */

export function generateServerSeed() {
  return crypto.randomBytes(32).toString('hex')
}

export function hashServerSeed(serverSeed) {
  return crypto.createHash('sha256').update(serverSeed).digest('hex')
}

export function generateClientSeed() {
  return crypto.randomBytes(8).toString('hex')
}

export function computeRoll(serverSeed, clientSeed, nonce, totalWeight) {
  if (!Number.isInteger(totalWeight) || totalWeight <= 0) {
    throw new Error('totalWeight должен быть положительным целым')
  }
  const hmac = crypto
    .createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest('hex')
  // 13 hex-символов = 52 бита, безопасно помещается в Number.MAX_SAFE_INTEGER
  const num = Number.parseInt(hmac.slice(0, 13), 16)
  return num % totalWeight
}

/**
 * Раздаёт диапазоны тикетов предметам кейса.
 * @param {{id:string, weight:number}[]} caseItems
 * @returns {{totalWeight:number, ranges:{id:string, weight:number, from:number, to:number, chance:number}[]}}
 */
export function buildTicketRanges(caseItems) {
  const ranges = []
  let acc = 0
  for (const ci of caseItems) {
    const weight = Math.max(1, Math.trunc(ci.weight))
    ranges.push({ ...ci, weight, from: acc, to: acc + weight - 1 })
    acc += weight
  }
  const totalWeight = acc
  for (const r of ranges) r.chance = r.weight / totalWeight
  return { totalWeight, ranges }
}

export function pickByRoll(ranges, roll) {
  return ranges.find((r) => roll >= r.from && roll <= r.to) ?? ranges[ranges.length - 1]
}
