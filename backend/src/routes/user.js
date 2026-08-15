import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { ah } from '../lib/errors.js'
import { parse } from '../lib/validate.js'
import { publicItem, publicOpening } from '../lib/serialize.js'
import { requireAuth } from '../middleware/auth.js'
import { sellInventoryItem } from '../services/opening.js'
import { generateServerSeed, hashServerSeed } from '../lib/fair.js'
import { getSettings } from '../services/settings.js'

export const userRouter = Router()
userRouter.use(requireAuth)

userRouter.get(
  '/inventory',
  ah(async (req, res) => {
    const status = ['IN_INVENTORY', 'SOLD', 'WITHDRAWN'].includes(req.query.status)
      ? req.query.status
      : 'IN_INVENTORY'

    const items = await prisma.inventoryItem.findMany({
      where: { userId: req.user.id, status },
      orderBy: { createdAt: 'desc' },
      include: { item: true },
      take: 200,
    })

    const settings = await getSettings()
    const sellRate = settings['cases.sellRate']

    res.json({
      sellRate,
      items: items.map((inv) => ({
        id: inv.id,
        status: inv.status,
        soldPrice: inv.soldPrice,
        createdAt: inv.createdAt,
        sellPrice: Math.round(inv.item.price * sellRate),
        item: publicItem(inv.item),
      })),
    })
  }),
)

userRouter.post(
  '/inventory/:id/sell',
  ah(async (req, res) => {
    const result = await sellInventoryItem({ userId: req.user.id, inventoryItemId: req.params.id })
    res.json(result)
  }),
)

userRouter.get(
  '/openings',
  ah(async (req, res) => {
    const openings = await prisma.opening.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { item: true, case: true },
      take: 100,
    })
    res.json({ openings: openings.map(publicOpening) })
  }),
)

userRouter.get(
  '/transactions',
  ah(async (req, res) => {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    res.json({
      transactions: transactions.map((t) => ({
        ...t,
        meta: t.meta ? JSON.parse(t.meta) : null,
      })),
    })
  }),
)

// --- provably fair ---

userRouter.get(
  '/seeds',
  ah(async (req, res) => {
    const history = await prisma.seedPair.findMany({
      where: { userId: req.user.id },
      orderBy: { revealedAt: 'desc' },
      take: 20,
    })
    res.json({
      current: {
        serverSeedHash: req.user.serverSeedHash,
        clientSeed: req.user.clientSeed,
        nonce: req.user.nonce,
      },
      history,
    })
  }),
)

userRouter.post(
  '/seeds/client',
  ah(async (req, res) => {
    const { clientSeed } = parse(
      z.object({ clientSeed: z.string().min(1).max(64) }),
      req.body ?? {},
    )
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { clientSeed },
    })
    res.json({ clientSeed: user.clientSeed, nonce: user.nonce })
  }),
)

/**
 * Ротация серверного сида: старый раскрывается (можно проверить все
 * прошлые открытия), новый выдаётся сразу в виде хеша.
 */
userRouter.post(
  '/seeds/rotate',
  ah(async (req, res) => {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: req.user.id } })

      await tx.seedPair.create({
        data: {
          userId: current.id,
          serverSeed: current.serverSeed,
          serverHash: current.serverSeedHash,
          clientSeed: current.clientSeed,
          nonceUsed: current.nonce,
        },
      })

      // Раскрываем сид в уже сохранённых открытиях этой пары.
      await tx.opening.updateMany({
        where: { userId: current.id, serverHash: current.serverSeedHash },
        data: { serverSeed: current.serverSeed },
      })

      const serverSeed = generateServerSeed()
      const updated = await tx.user.update({
        where: { id: current.id },
        data: {
          serverSeed,
          serverSeedHash: hashServerSeed(serverSeed),
          nonce: 0,
        },
      })

      return {
        revealed: {
          serverSeed: current.serverSeed,
          serverHash: current.serverSeedHash,
          clientSeed: current.clientSeed,
          nonceUsed: current.nonce,
        },
        current: { serverSeedHash: updated.serverSeedHash, clientSeed: updated.clientSeed, nonce: 0 },
      }
    })

    res.json(result)
  }),
)
