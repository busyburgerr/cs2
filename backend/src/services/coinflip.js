import { prisma } from '../db.js'
import { AppError, badRequest } from '../lib/errors.js'
import { computeRoll } from '../lib/fair.js'
import { getSettings } from './settings.js'
import { balanceField, balanceOf } from '../lib/wallet.js'

/**
 * Коинфлип против площадки.
 *
 * Результат считается той же парой сидов, что и открытие кейсов:
 * билет = HMAC_SHA256(serverSeed, clientSeed:nonce) % 10000.
 * Игрок выигрывает, если билет попал в диапазон [0, шанс * 10000).
 * Значит, честность броска проверяется тем же калькулятором на /fair.
 */

const TICKETS = 10_000
export const SIDES = ['HEADS', 'TAILS']

export async function flip({ userId, side, amount }) {
  const settings = await getSettings()

  if (!settings['coinflip.enabled']) throw badRequest('Коинфлип временно отключён')
  if (!SIDES.includes(side)) throw badRequest('Выберите сторону монеты')
  if (!Number.isInteger(amount)) throw badRequest('Некорректная сумма')
  if (amount < settings['coinflip.minBet']) {
    throw badRequest(`Минимальная ставка — ${settings['coinflip.minBet'] / 100}`)
  }
  if (amount > settings['coinflip.maxBet']) {
    throw badRequest(`Максимальная ставка — ${settings['coinflip.maxBet'] / 100}`)
  }

  const winChance = settings['coinflip.winChance']
  const multiplier = settings['coinflip.payout']
  const winTickets = Math.round(winChance * TICKETS)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user) throw badRequest('Пользователь не найден')

    const field = balanceField(user)
    const startBalance = balanceOf(user)
    if (startBalance < amount) throw new AppError(402, 'Недостаточно средств', 'NO_FUNDS')

    // Тот же оптимистичный замок по nonce, что и при открытии кейса:
    // параллельные броски не могут использовать один и тот же билет.
    const locked = await tx.user.updateMany({
      where: { id: userId, nonce: user.nonce, [field]: { gte: amount } },
      data: { [field]: { decrement: amount }, nonce: { increment: 1 } },
    })
    if (locked.count !== 1) {
      throw new AppError(409, 'Параллельная ставка, повторите попытку', 'CONFLICT')
    }

    const roll = computeRoll(user.serverSeed, user.clientSeed, user.nonce, TICKETS)

    // Заданный администратором исход — только на демо-аккаунте, одноразовый.
    const forced = Boolean(user.demo && user.demoForceCoinflip)
    const win = forced ? user.demoForceCoinflip === 'WIN' : roll < winTickets
    const payout = win ? Math.round(amount * multiplier) : 0
    const result = win ? side : SIDES.find((s) => s !== side)

    if (forced) {
      await tx.user.update({ where: { id: userId }, data: { demoForceCoinflip: null } })
    }

    let balance = startBalance - amount

    await tx.transaction.create({
      data: {
        userId,
        demo: user.demo,
        type: 'COINFLIP_BET',
        amount: -amount,
        balanceAfter: balance,
        meta: JSON.stringify({ side, roll, forced }),
      },
    })

    if (payout > 0) {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { [field]: { increment: payout } },
      })
      balance = updated[field]
      await tx.transaction.create({
        data: {
          userId,
          demo: user.demo,
          type: 'COINFLIP_WIN',
          amount: payout,
          balanceAfter: balance,
          meta: JSON.stringify({ side, roll, multiplier, forced }),
        },
      })
    }

    const game = await tx.coinflipGame.create({
      data: {
        userId,
        demo: user.demo,
        forced,
        side,
        result,
        amount,
        win,
        payout,
        multiplier,
        winChance,
        serverSeed: '', // раскрывается вместе с ротацией сида
        serverHash: user.serverSeedHash,
        clientSeed: user.clientSeed,
        nonce: user.nonce,
        roll,
        totalTickets: TICKETS,
      },
    })

    return { game, balance }
  })
}

export async function history({ userId, limit = 20 }) {
  return prisma.coinflipGame.findMany({
    // Публичная лента (без userId) не показывает демо-игры.
    where: userId ? { userId } : { demo: false },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: userId ? undefined : { user: { select: { username: true } } },
  })
}
