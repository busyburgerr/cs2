import { AppError } from '../lib/errors.js'

/**
 * Каталог официальных скинов CS2 (открытый датасет ByMykel/CSGO-API).
 * Нужен только админке — чтобы подставлять картинку предмета по названию.
 * Держим в памяти: 2000+ записей вида { name, image }, обновляем раз в 6 часов.
 */

const SOURCE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json'
const TTL_MS = 6 * 60 * 60 * 1000

let cache = { items: [], loadedAt: 0 }
let inflight = null

async function load() {
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new AppError(502, `Каталог скинов ответил ${res.status}`)
  const raw = await res.json()

  const items = []
  for (const skin of raw) {
    if (!skin?.name || !skin?.image) continue
    items.push({ name: skin.name, image: skin.image, rarity: skin.rarity?.name ?? null })
  }
  cache = { items, loadedAt: Date.now() }
  return items
}

async function getCatalog() {
  if (cache.items.length && Date.now() - cache.loadedAt < TTL_MS) return cache.items
  if (!inflight) {
    inflight = load().finally(() => {
      inflight = null
    })
  }
  try {
    return await inflight
  } catch (err) {
    // Если сеть недоступна, отдаём то, что успели загрузить раньше.
    if (cache.items.length) return cache.items
    throw err instanceof AppError
      ? err
      : new AppError(502, 'Каталог скинов недоступен — проверьте соединение с интернетом')
  }
}

const normalize = (value) =>
  value
    .replace(/^StatTrak™\s*/i, '')
    .replace(/★/g, '')
    .replace(/[^a-z0-9|]/gi, '')
    .toLowerCase()

/** Поиск по названию: сначала точное совпадение, затем вхождение подстроки. */
export async function searchSkins(query, limit = 10) {
  const catalog = await getCatalog()
  const q = normalize(query)
  if (!q) return []

  const exact = []
  const partial = []
  for (const skin of catalog) {
    const name = normalize(skin.name)
    if (name === q) exact.push(skin)
    else if (name.includes(q)) partial.push(skin)
    if (exact.length + partial.length >= limit * 4) break
  }
  return [...exact, ...partial].slice(0, limit)
}
