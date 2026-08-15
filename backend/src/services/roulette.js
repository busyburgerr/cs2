import { prisma } from '../db.js'
import { AppError, badRequest, notFound } from '../lib/errors.js'
import { computeRoll, generateServerSeed, hashServerSeed } from '../lib/fair.js'
import { getSettings } from './settings.js'

/**
 * Рулетка: колесо против площадки.
 *
 * Раунды идут по расписанию независимо от того, есть ли ставки.
 * Жизненный цикл: BETTING -> SPINNING -> SETTLED, переходы делает tick(),
 * поэтому перезапуск сервера не ломает уже начатый раунд.
 *
 * Provably fair: серверный сид генерируется при создании раунда, его хеш
 * публикуется сразу, сам сид раскрывается вместе с результатом.
 * Билет = HMAC_SHA256(serverSeed, "round:<номер>") % количество секторов.
 */

export const COLORS = ['RED', 'BLACK', 'GREEN']

/**
 * Раскладка секторов колеса: красные и чёрные чередуются,
 * зелёные расставлены равномерно. Одинакова на сервере и клиенте.
 */
export function buildWheel({ redSlots, blackSlots, greenSlots }) {
  const colored = []
  for (let i = 0; i < Math.max(redSlots, blackSlots); i++) {
    if (i < redSlots) colored.push('RED')
    if (i < blackSlots) colored.push('BLACK')
  }

  const total = colored.length + greenSlots
  const gap = Math.max(1, Math.round(total / greenSlots))

  const wheel = []
  let colorIndex = 0
  let greensPlaced = 0
  for (let i = 0; i < total; i++) {
    if (greensPlaced < greenSlots && i % gap === 0) {
      wheel.push('GREEN')
      greensPlaced++
    } else {
      wheel.push(colored[colorIndex++] ?? 'RED')
    }
  }
  return wheel
}

async function createRound(settings) {
  const last = await prisma.rouletteRound.findFirst({ orderBy: { number: 'desc' } })
  const serverSeed = generateServerSeed()

  return prisma.rouletteRound.create({
    data: {
      number: (last?.number ?? 0) + 1,
      serverSeed,
      serverHash: hashServerSeed(serverSeed),
      phase: 'BETTING',
      redSlots: settings['roulette.redSlots'],
      blackSlots: settings['roulette.blackSlots'],
      greenSlots: settings['roulette.greenSlots'],
      totalSlots:
        settings['roulette.redSlots'] +
        settings['roulette.blackSlots'] +
        settings['roulette.greenSlots'],
      payoutColor: settings['roulette.payoutColor'],
      payoutGreen: settings['roulette.payoutGreen'],
      bettingEndsAt: new Date(Date.now() + settings['roulette.bettingSeconds'] * 1000),
    },
  })
}

/** Определяет результат: билет -> сектор -> цвет. */
async function startSpin(round) {
  const roll = computeRoll(round.serverSeed, `round:${round.number}`, 0, round.totalSlots)
  const wheel = buildWheel(round)
  const color = wheel[roll] ?? 'RED'

  return prisma.rouletteRound.update({
    where: { id: round.id },
    data: { phase: 'SPINNING', roll, slot: roll, color },
  })
}

/** Закрывает раунд и выплачивает выигрыши. */
async function settleRound(round) {
  return prisma.$transaction(async (tx) => {
    const fresh = await tx.rouletteRound.findUnique({ where: { id: round.id } })
    if (!fresh || fresh.phase !== 'SPINNING') return fresh

    const bets = await tx.rouletteBet.findMany({ where: { roundId: round.id } })
    // Множитель берём из раунда, а не из текущих настроек.
    const multiplier = fresh.color === 'GREEN' ? fresh.payoutGreen : fresh.payoutColor

    for (const bet of bets) {
      if (bet.color !== fresh.color) continue

      const payout = Math.round(bet.amount * multiplier)
      await tx.rouletteBet.update({ where: { id: bet.id }, data: { payout } })

      const user = await tx.user.update({
        where: { id: bet.userId },
        data: { balance: { increment: payout } },
      })
      await tx.transaction.create({
        data: {
          userId: bet.userId,
          type: 'ROULETTE_WIN',
          amount: payout,
          balanceAfter: user.balance,
          meta: JSON.stringify({ roundId: fresh.id, round: fresh.number, color: fresh.color }),
        },
      })
    }

    return tx.rouletteRound.update({
      where: { id: fresh.id },
      data: { phase: 'SETTLED', settledAt: new Date() },
    })
  })
}

/** Один шаг конечного автомата раундов. Вызывается по таймеру. */
export async function tick() {
  const settings = await getSettings()

  let round = await prisma.rouletteRound.findFirst({
    where: { phase: { in: ['BETTING', 'SPINNING'] } },
    orderBy: { number: 'desc' },
  })

  if (!round) {
    if (!settings['roulette.enabled']) return null
    return createRound(settings)
  }

  const now = Date.now()

  if (round.phase === 'BETTING' && now >= round.bettingEndsAt.getTime()) {
    round = await startSpin(round)
  }

  if (round.phase === 'SPINNING') {
    const spinEndsAt = round.bettingEndsAt.getTime() + settings['roulette.spinSeconds'] * 1000
    if (now >= spinEndsAt) {
      await settleRound(round)
      return settings['roulette.enabled'] ? createRound(settings) : null
    }
  }

  return round
}

let timer = null

export function startRouletteLoop() {
  if (timer) return
  timer = setInterval(() => {
    tick().catch((err) => console.error('Рулетка:', err.message))
  }, 500)
  timer.unref?.()
}

export function stopRouletteLoop() {
  if (timer) clearInterval(timer)
  timer = null
}

/** Текущее состояние для клиента. */
export async function getCurrentState(userId = null) {
  const settings = await getSettings()

  const round =
    (await prisma.rouletteRound.findFirst({
      where: { phase: { in: ['BETTING', 'SPINNING'] } },
      orderBy: { number: 'desc' },
      include: { bets: { include: { user: { select: { username: true } } } } },
    })) ?? null

  const history = await prisma.rouletteRound.findMany({
    where: { phase: 'SETTLED' },
    orderBy: { number: 'desc' },
    take: 15,
    select: { id: true, number: true, color: true, slot: true, serverSeed: true, serverHash: true },
  })

  const totals = { RED: 0, BLACK: 0, GREEN: 0 }
  const bets = []
  let myBets = { RED: 0, BLACK: 0, GREEN: 0 }

  for (const bet of round?.bets ?? []) {
    totals[bet.color] += bet.amount
    bets.push({
      id: bet.id,
      color: bet.color,
      amount: bet.amount,
      username: bet.user.username,
      mine: bet.userId === userId,
    })
    if (bet.userId === userId) myBets[bet.color] += bet.amount
  }

  const spinEndsAt = round
    ? new Date(round.bettingEndsAt.getTime() + settings['roulette.spinSeconds'] * 1000)
    : null

  return {
    enabled: settings['roulette.enabled'],
    config: {
      minBet: settings['roulette.minBet'],
      maxBet: settings['roulette.maxBet'],
      // Множители текущего раунда — по ним и будет выплата.
      payoutColor: round?.payoutColor ?? settings['roulette.payoutColor'],
      payoutGreen: round?.payoutGreen ?? settings['roulette.payoutGreen'],
      bettingSeconds: settings['roulette.bettingSeconds'],
      spinSeconds: settings['roulette.spinSeconds'],
    },
    wheel: round ? buildWheel(round) : buildWheel({
      redSlots: settings['roulette.redSlots'],
      blackSlots: settings['roulette.blackSlots'],
      greenSlots: settings['roulette.greenSlots'],
    }),
    round: round && {
      id: round.id,
      number: round.number,
      phase: round.phase,
      serverHash: round.serverHash,
      totalSlots: round.totalSlots,
      bettingEndsAt: round.bettingEndsAt,
      spinEndsAt,
      // Результат отдаём только когда колесо уже крутится.
      slot: round.phase === 'SPINNING' ? round.slot : null,
      color: round.phase === 'SPINNING' ? round.color : null,
    },
    totals,
    myBets,
    bets: bets.slice(-40),
    history,
    serverTime: new Date(),
  }
}

/** Ставка на цвет в текущем раунде. */
export async function placeBet({ userId, color, amount }) {
  const settings = await getSettings()
  if (!settings['roulette.enabled']) throw badRequest('Рулетка временно отключена')
  if (!COLORS.includes(color)) throw badRequest('Неизвестный цвет')
  if (!Number.isInteger(amount)) throw badRequest('Некорректная сумма')
  if (amount < settings['roulette.minBet']) {
    throw badRequest(`Минимальная ставка — ${settings['roulette.minBet'] / 100}`)
  }

  return prisma.$transaction(async (tx) => {
    const round = await tx.rouletteRound.findFirst({
      where: { phase: 'BETTING' },
      orderBy: { number: 'desc' },
    })
    if (!round) throw notFound('Раунд не найден, подождите следующий')
    if (Date.now() >= round.bettingEndsAt.getTime()) {
      throw badRequest('Приём ставок в этом раунде закрыт')
    }

    const existing = await tx.rouletteBet.findUnique({
      where: { roundId_userId_color: { roundId: round.id, userId, color } },
    })
    const totalOnColor = (existing?.amount ?? 0) + amount
    if (totalOnColor > settings['roulette.maxBet']) {
      throw badRequest(`Максимальная ставка на цвет — ${settings['roulette.maxBet'] / 100}`)
    }

    const debited = await tx.user.updateMany({
      where: { id: userId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    })
    if (debited.count !== 1) throw new AppError(402, 'Недостаточно средств', 'NO_FUNDS')

    const bet = existing
      ? await tx.rouletteBet.update({
          where: { id: existing.id },
          data: { amount: totalOnColor },
        })
      : await tx.rouletteBet.create({ data: { roundId: round.id, userId, color, amount } })

    const user = await tx.user.findUnique({ where: { id: userId } })
    await tx.transaction.create({
      data: {
        userId,
        type: 'ROULETTE_BET',
        amount: -amount,
        balanceAfter: user.balance,
        meta: JSON.stringify({ roundId: round.id, round: round.number, color }),
      },
    })

    return { bet, balance: user.balance, round: { id: round.id, number: round.number } }
  })
}
