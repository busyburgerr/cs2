/**
 * Импорт всех официальных кейсов CS2 с ценами торговой площадки Steam.
 *
 *   npm run import:cases                  — импорт с ценами в долларовых центах
 *   npm run import:cases -- --rate=90     — пересчёт цен в другую валюту
 *   npm run import:cases -- --rtp=0.9     — целевая отдача кейса (по умолчанию 0.92)
 *   npm run import:cases -- --keep-demo   — не отключать демо-кейсы из сидирования
 *
 * Источники (открытые датасеты, обновляются автоматически):
 *   ByMykel/CSGO-API                    — состав кейсов и картинки
 *   ByMykel/counter-strike-price-tracker — цены Steam Community Market
 *
 * Шансы выставляются как в игре:
 *   Mil-Spec 79.92% · Restricted 15.98% · Classified 3.2% · Covert 0.64% · нож/перчатки 0.26%
 */
import { PrismaClient } from '@prisma/client'
import { config } from '../src/config.js'

const CRATES_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/crates.json'
const PRICES_URL =
  'https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/latest.json'

const prisma = new PrismaClient()

const arg = (name, fallback) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`))
  return found ? Number.parseFloat(found.split('=')[1]) : fallback
}
const RATE = arg('rate', 1)
const TARGET_RTP = arg('rtp', 0.92)
const KEEP_DEMO = process.argv.includes('--keep-demo')
const DEMO_SLUGS = ['starter', 'clutch', 'prime', 'dragon', 'knife']

// Доля тикетов на тир — реальные шансы CS2, база 1 000 000 билетов.
const TIER_TICKETS = {
  MILSPEC: 799_200,
  RESTRICTED: 159_800,
  CLASSIFIED: 32_000,
  COVERT: 6_400,
  CONTRABAND: 2_600,
}

const RARITY_MAP = {
  'Consumer Grade': 'CONSUMER',
  'Industrial Grade': 'INDUSTRIAL',
  'Mil-Spec Grade': 'MILSPEC',
  Restricted: 'RESTRICTED',
  Classified: 'CLASSIFIED',
  Covert: 'COVERT',
  Extraordinary: 'CONTRABAND',
  Contraband: 'CONTRABAND',
}

// Порядок предпочтения износа: берём первый, для которого есть цена на Steam.
const WEARS = [
  ['Field-Tested', 'FT'],
  ['Minimal Wear', 'MW'],
  ['Factory New', 'FN'],
  ['Well-Worn', 'WW'],
  ['Battle-Scarred', 'BS'],
]

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

async function fetchJson(url, label) {
  process.stdout.write(`  ${label}... `)
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`)
  const data = await res.json()
  console.log('готово')
  return data
}

/** Подбирает износ с ценой и возвращает цену в минимальных единицах. */
function resolvePrice(prices, skinName) {
  for (const [full, short] of WEARS) {
    const price = prices[`${skinName} (${full})`]
    if (typeof price === 'number' && price > 0) {
      return { wear: short, price: Math.max(1, Math.round(price * RATE)) }
    }
  }
  // Предметы без износа (например, некоторые ножи-«ванильки»).
  const plain = prices[skinName]
  if (typeof plain === 'number' && plain > 0) {
    return { wear: 'FN', price: Math.max(1, Math.round(plain * RATE)) }
  }
  return null
}

/** Раздаёт билеты внутри тира поровну, остаток отдаёт первому предмету. */
function splitTickets(total, count) {
  if (count === 0) return []
  const base = Math.floor(total / count)
  const shares = Array.from({ length: count }, () => base)
  shares[0] += total - base * count
  return shares
}

async function main() {
  console.log('Загружаю датасеты...')
  const [crates, priceFile] = await Promise.all([
    fetchJson(CRATES_URL, 'состав кейсов'),
    fetchJson(PRICES_URL, 'цены Steam'),
  ])

  const prices = priceFile.prices ?? priceFile
  console.log(
    `  цен: ${Object.keys(prices).length}, обновлены ${priceFile.metadata?.updated_at?.slice(0, 10) ?? '—'} ` +
      `(${priceFile.metadata?.currency ?? 'USD'})`,
  )
  if (RATE !== 1) console.log(`  курс пересчёта: ×${RATE}`)

  const cases = crates
    .filter((crate) => crate.type === 'Case' && crate.contains?.length)
    .sort((a, b) => (b.first_sale_date ?? '').localeCompare(a.first_sale_date ?? ''))

  console.log(`\nКейсов к импорту: ${cases.length}\n`)

  // Кэш предметов в рамках запуска: ножи повторяются в десятках кейсов.
  const itemCache = new Map()

  async function upsertItem(skin, forceRare) {
    const cacheKey = skin.name
    if (itemCache.has(cacheKey)) return itemCache.get(cacheKey)

    const resolved = resolvePrice(prices, skin.name)
    if (!resolved) {
      itemCache.set(cacheKey, null)
      return null
    }

    const [weapon, paint] = skin.name.split(' | ')
    const rarity = forceRare ? 'CONTRABAND' : (RARITY_MAP[skin.rarity?.name] ?? 'MILSPEC')

    const existing = await prisma.item.findFirst({
      where: { name: skin.name, wear: resolved.wear },
    })
    const data = {
      name: skin.name,
      weapon: weapon ?? skin.name,
      skin: paint ?? '—',
      rarity,
      wear: resolved.wear,
      price: resolved.price,
      image: skin.image ?? null,
    }

    const item = existing
      ? await prisma.item.update({ where: { id: existing.id }, data })
      : await prisma.item.create({ data })

    itemCache.set(cacheKey, item)
    return item
  }

  let created = 0
  let updated = 0
  let skipped = 0

  for (const [index, crate] of cases.entries()) {
    // Один и тот же предмет может встретиться в составе дважды —
    // в кейсе он должен быть ровно один раз.
    const seen = new Set()
    const entries = []

    const add = async (skin, forceRare) => {
      const item = await upsertItem(skin, forceRare)
      if (!item) return skipped++
      if (seen.has(item.id)) return
      seen.add(item.id)
      entries.push({ item, tier: forceRare ? 'CONTRABAND' : item.rarity })
    }

    for (const skin of crate.contains) await add(skin, false)
    for (const skin of crate.contains_rare ?? []) await add(skin, true)

    if (!entries.length) {
      console.log(`  ${crate.name}: нет предметов с ценой, пропускаю`)
      continue
    }

    // Билеты по тирам: доля тира делится поровну между его предметами.
    const byTier = new Map()
    for (const entry of entries) {
      const tier = TIER_TICKETS[entry.tier] ? entry.tier : 'MILSPEC'
      if (!byTier.has(tier)) byTier.set(tier, [])
      byTier.get(tier).push(entry)
    }

    const weighted = []
    for (const [tier, list] of byTier) {
      const shares = splitTickets(TIER_TICKETS[tier], list.length)
      list.forEach((entry, i) => weighted.push({ ...entry, weight: Math.max(1, shares[i]) }))
    }

    const totalWeight = weighted.reduce((sum, e) => sum + e.weight, 0)
    const ev = weighted.reduce((sum, e) => sum + (e.weight / totalWeight) * e.item.price, 0)
    const price = Math.max(1, Math.round(ev / TARGET_RTP))

    const slug = slugify(crate.name)
    const existingCase = await prisma.case.findUnique({ where: { slug } })

    const caseData = {
      title: crate.name,
      description: crate.description?.replace(/<[^>]*>/g, '').slice(0, 400) || null,
      image: crate.image ?? null,
      price,
      sortOrder: index,
      active: true,
    }

    const caseRow = existingCase
      ? await prisma.case.update({ where: { id: existingCase.id }, data: caseData })
      : await prisma.case.create({ data: { slug, ...caseData } })

    existingCase ? updated++ : created++

    await prisma.caseItem.deleteMany({ where: { caseId: caseRow.id } })
    await prisma.caseItem.createMany({
      data: weighted.map((e) => ({ caseId: caseRow.id, itemId: e.item.id, weight: e.weight })),
    })

    console.log(
      `  ${crate.name.padEnd(32)} цена ${(price / 100).toFixed(2).padStart(9)}  ` +
        `EV ${(ev / 100).toFixed(2).padStart(9)}  предметов ${String(weighted.length).padStart(3)}`,
    )
  }

  if (!KEEP_DEMO) {
    const off = await prisma.case.updateMany({
      where: { slug: { in: DEMO_SLUGS } },
      data: { active: false },
    })
    if (off.count) console.log(`\nДемо-кейсы отключены: ${off.count} (вернуть можно в админке)`)
  }

  const activeCases = await prisma.case.count({ where: { active: true } })
  const totalItems = await prisma.item.count()

  console.log(`\nИтого: создано кейсов ${created}, обновлено ${updated}`)
  console.log(`  предметов в базе: ${totalItems}`)
  console.log(`  активных кейсов: ${activeCases}`)
  if (skipped) console.log(`  пропущено предметов без цены на Steam: ${skipped}`)
  if (RATE === 1 && config.currency !== 'USD') {
    console.log(
      `\nВнимание: цены Steam в долларах, а CURRENCY=${config.currency}. ` +
        `Перезапустите с --rate=<курс>, либо поставьте CURRENCY=USD.`,
    )
  }
}

main()
  .catch((err) => {
    console.error('Ошибка импорта:', err.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
