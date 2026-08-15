import { prisma } from '../db.js'
import { AppError, badRequest, notFound } from '../lib/errors.js'
import { buildTicketRanges, computeRoll, pickByRoll } from '../lib/fair.js'
import { getSettings } from './settings.js'

/**
 * Открытие кейса. Всё внутри одной транзакции:
 * списание баланса (с оптимистической блокировкой по nonce),
 * розыгрыш, запись дропа, зачисление в инвентарь и проводка.
 */
export async function openCase({ userId, slug, count = 1 }) {
  const settings = await getSettings()
  const maxAtOnce = settings['cases.maxOpenAtOnce']

  if (!Number.isInteger(count) || count < 1 || count > maxAtOnce) {
    throw badRequest(`Можно открыть от 1 до ${maxAtOnce} кейсов за раз`)
  }

  const caseRow = await prisma.case.findUnique({
    where: { slug },
    include: { items: { include: { item: true } } },
  })
  if (!caseRow) throw notFound('Кейс не найден')
  if (!caseRow.active) throw badRequest('Кейс отключён')
  if (caseRow.items.length === 0) throw badRequest('В кейсе нет предметов')

  const { totalWeight, ranges } = buildTicketRanges(
    caseRow.items.map((ci) => ({ id: ci.id, weight: ci.weight, item: ci.item })),
  )
  const cost = caseRow.price * count

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user) throw notFound('Пользователь не найден')
    if (user.banned) throw new AppError(403, 'Аккаунт заблокирован')
    if (user.balance < cost) throw new AppError(402, 'Недостаточно средств на балансе', 'NO_FUNDS')

    // Оптимистическая блокировка: nonce должен быть тем же, что мы прочитали,
    // иначе параллельный запрос уже израсходовал эти тикеты.
    const locked = await tx.user.updateMany({
      where: { id: userId, nonce: user.nonce, balance: { gte: cost } },
      data: { balance: { decrement: cost }, nonce: { increment: count } },
    })
    if (locked.count !== 1) {
      throw new AppError(409, 'Параллельное открытие, повторите попытку', 'CONFLICT')
    }

    let balance = user.balance - cost
    const results = []

    for (let i = 0; i < count; i++) {
      const nonce = user.nonce + i
      const roll = computeRoll(user.serverSeed, user.clientSeed, nonce, totalWeight)
      const won = pickByRoll(ranges, roll)

      const opening = await tx.opening.create({
        data: {
          userId,
          caseId: caseRow.id,
          itemId: won.item.id,
          cost: caseRow.price,
          value: won.item.price,
          serverSeed: '', // раскрывается только после ротации сида
          serverHash: user.serverSeedHash,
          clientSeed: user.clientSeed,
          nonce,
          roll,
          totalTickets: totalWeight,
        },
        include: { item: true, case: true },
      })

      const inventoryItem = await tx.inventoryItem.create({
        data: { userId, itemId: won.item.id, openingId: opening.id },
      })

      await tx.transaction.create({
        data: {
          userId,
          type: 'CASE_OPEN',
          amount: -caseRow.price,
          balanceAfter: user.balance - caseRow.price * (i + 1),
          meta: JSON.stringify({ caseSlug: caseRow.slug, itemId: won.item.id, roll }),
        },
      })

      results.push({ opening, inventoryItemId: inventoryItem.id, chance: won.chance, roll })
    }

    return { openings: results, balance, totalWeight, caseRow }
  })
}

/** Продажа предмета из инвентаря обратно площадке. */
export async function sellInventoryItem({ userId, inventoryItemId }) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.inventoryItem.findFirst({
      where: { id: inventoryItemId, userId },
      include: { item: true },
    })
    if (!inv) throw notFound('Предмет не найден в инвентаре')
    if (inv.status !== 'IN_INVENTORY') throw badRequest('Предмет уже продан или выведен')

    const settings = await getSettings()
    const payout = Math.max(0, Math.round(inv.item.price * settings['cases.sellRate']))

    const updated = await tx.inventoryItem.updateMany({
      where: { id: inv.id, status: 'IN_INVENTORY' },
      data: { status: 'SOLD', soldPrice: payout },
    })
    if (updated.count !== 1) throw badRequest('Предмет уже продан')

    const user = await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: payout } },
    })

    await tx.transaction.create({
      data: {
        userId,
        type: 'ITEM_SELL',
        amount: payout,
        balanceAfter: user.balance,
        meta: JSON.stringify({ itemId: inv.itemId, inventoryItemId: inv.id }),
      },
    })

    return { payout, balance: user.balance }
  })
}
