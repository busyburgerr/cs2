import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { ah } from '../lib/errors.js'
import { parse } from '../lib/validate.js'
import { optionalAuth, requireAuth } from '../middleware/auth.js'
import { COLORS, getCurrentState, placeBet } from '../services/roulette.js'
import { SIDES, flip, history } from '../services/coinflip.js'
import { getSettings } from '../services/settings.js'

export const rouletteRouter = Router()

// Состояние текущего раунда: клиент опрашивает раз в секунду.
rouletteRouter.get(
  '/state',
  optionalAuth,
  ah(async (req, res) => {
    res.json(await getCurrentState(req.user?.id ?? null))
  }),
)

const betLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком часто. Немного подождите.' },
})

rouletteRouter.post(
  '/bet',
  requireAuth,
  betLimiter,
  ah(async (req, res) => {
    const { color, amount } = parse(
      z.object({ color: z.enum(COLORS), amount: z.number().int().positive() }),
      req.body ?? {},
    )
    const result = await placeBet({ userId: req.user.id, color, amount })
    res.status(201).json({ balance: result.balance, bet: result.bet, round: result.round })
  }),
)

export const coinflipRouter = Router()

coinflipRouter.get(
  '/config',
  ah(async (_req, res) => {
    const settings = await getSettings()
    res.json({
      enabled: settings['coinflip.enabled'],
      winChance: settings['coinflip.winChance'],
      payout: settings['coinflip.payout'],
      minBet: settings['coinflip.minBet'],
      maxBet: settings['coinflip.maxBet'],
    })
  }),
)

coinflipRouter.get(
  '/feed',
  ah(async (_req, res) => {
    const games = await history({ limit: 15 })
    res.json({
      games: games.map((game) => ({
        id: game.id,
        username: game.user?.username,
        side: game.side,
        result: game.result,
        amount: game.amount,
        win: game.win,
        payout: game.payout,
        createdAt: game.createdAt,
      })),
    })
  }),
)

coinflipRouter.get(
  '/history',
  requireAuth,
  ah(async (req, res) => {
    const games = await history({ userId: req.user.id, limit: 30 })
    res.json({ games })
  }),
)

coinflipRouter.post(
  '/play',
  requireAuth,
  betLimiter,
  ah(async (req, res) => {
    const { side, amount } = parse(
      z.object({ side: z.enum(SIDES), amount: z.number().int().positive() }),
      req.body ?? {},
    )
    const { game, balance } = await flip({ userId: req.user.id, side, amount })
    res.json({
      balance,
      game: {
        id: game.id,
        demo: game.demo,
        forced: game.forced,
        side: game.side,
        result: game.result,
        amount: game.amount,
        win: game.win,
        payout: game.payout,
        multiplier: game.multiplier,
        roll: game.roll,
        nonce: game.nonce,
        totalTickets: game.totalTickets,
        serverHash: game.serverHash,
        clientSeed: game.clientSeed,
      },
    })
  }),
)

// Публичная конфигурация площадки: валюта, лимиты и настройки игр.
export const configRouter = Router()

configRouter.get(
  '/',
  ah(async (_req, res) => {
    const settings = await getSettings()
    const [casesCount, openingsCount] = await Promise.all([
      prisma.case.count({ where: { active: true } }),
      prisma.opening.count(),
    ])

    res.json({
      currency: process.env.CURRENCY || 'USD',
      wallet: {
        minDeposit: settings['wallet.minDeposit'],
        maxDeposit: settings['wallet.maxDeposit'],
      },
      cases: {
        sellRate: settings['cases.sellRate'],
        maxOpenAtOnce: settings['cases.maxOpenAtOnce'],
        count: casesCount,
      },
      roulette: {
        enabled: settings['roulette.enabled'],
        minBet: settings['roulette.minBet'],
        maxBet: settings['roulette.maxBet'],
        payoutColor: settings['roulette.payoutColor'],
        payoutGreen: settings['roulette.payoutGreen'],
      },
      coinflip: {
        enabled: settings['coinflip.enabled'],
        winChance: settings['coinflip.winChance'],
        payout: settings['coinflip.payout'],
        minBet: settings['coinflip.minBet'],
        maxBet: settings['coinflip.maxBet'],
      },
      stats: { openingsCount },
    })
  }),
)
