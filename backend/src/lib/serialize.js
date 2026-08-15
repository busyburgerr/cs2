import { buildTicketRanges } from './fair.js'

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    balance: user.balance,
    createdAt: user.createdAt,
  }
}

export function publicItem(item) {
  return {
    id: item.id,
    name: item.name,
    weapon: item.weapon,
    skin: item.skin,
    rarity: item.rarity,
    wear: item.wear,
    statTrak: item.statTrak,
    price: item.price,
    image: item.image,
  }
}

/**
 * Кейс для витрины. Шансы считаем из весов — они публичные,
 * это часть модели provably fair.
 */
export function publicCase(caseRow, { withItems = false } = {}) {
  const base = {
    id: caseRow.id,
    slug: caseRow.slug,
    title: caseRow.title,
    description: caseRow.description,
    image: caseRow.image,
    price: caseRow.price,
    active: caseRow.active,
    sortOrder: caseRow.sortOrder,
  }
  if (!caseRow.items) return base

  const { totalWeight, ranges } = buildTicketRanges(
    caseRow.items.map((ci) => ({ id: ci.id, weight: ci.weight, item: ci.item })),
  )

  base.itemsCount = ranges.length
  base.totalWeight = totalWeight

  // Ожидаемая отдача (RTP) — сумма цен предметов, взвешенная по шансам.
  const ev = ranges.reduce((sum, r) => sum + r.chance * r.item.price, 0)
  base.expectedValue = Math.round(ev)
  base.rtp = caseRow.price > 0 ? ev / caseRow.price : 0

  if (withItems) {
    base.items = ranges
      .map((r) => ({
        id: r.id,
        weight: r.weight,
        chance: r.chance,
        ticketFrom: r.from,
        ticketTo: r.to,
        item: publicItem(r.item),
      }))
      .sort((a, b) => b.item.price - a.item.price)
  }
  return base
}

export function publicOpening(opening) {
  return {
    id: opening.id,
    caseId: opening.caseId,
    case: opening.case ? { slug: opening.case.slug, title: opening.case.title } : undefined,
    item: opening.item ? publicItem(opening.item) : undefined,
    user: opening.user ? { username: opening.user.username } : undefined,
    cost: opening.cost,
    value: opening.value,
    roll: opening.roll,
    nonce: opening.nonce,
    serverHash: opening.serverHash,
    clientSeed: opening.clientSeed,
    totalTickets: opening.totalTickets,
    createdAt: opening.createdAt,
  }
}
