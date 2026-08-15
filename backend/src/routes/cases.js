import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { ah, notFound } from '../lib/errors.js'
import { parse } from '../lib/validate.js'
import { publicCase, publicOpening } from '../lib/serialize.js'
import { requireAuth } from '../middleware/auth.js'
import { openCase } from '../services/opening.js'

export const casesRouter = Router()

casesRouter.get(
  '/',
  ah(async (_req, res) => {
    const cases = await prisma.case.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
      include: { items: { include: { item: true } } },
    })
    res.json({ cases: cases.map((c) => publicCase(c)) })
  }),
)

casesRouter.get(
  '/:slug',
  ah(async (req, res) => {
    const caseRow = await prisma.case.findUnique({
      where: { slug: req.params.slug },
      include: { items: { include: { item: true } } },
    })
    if (!caseRow || !caseRow.active) throw notFound('Кейс не найден')
    res.json({ case: publicCase(caseRow, { withItems: true }) })
  }),
)

const openLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком часто. Немного подождите.' },
})

// Верхнюю границу проверяет сервис — она задаётся в админке.
const openSchema = z.object({
  count: z.number().int().min(1).max(20).optional().default(1),
})

casesRouter.post(
  '/:slug/open',
  requireAuth,
  openLimiter,
  ah(async (req, res) => {
    const { count } = parse(openSchema, req.body ?? {})
    const result = await openCase({ userId: req.user.id, slug: req.params.slug, count })

    res.json({
      balance: result.balance,
      totalTickets: result.totalWeight,
      results: result.openings.map((r) => ({
        ...publicOpening(r.opening),
        inventoryItemId: r.inventoryItemId,
        chance: r.chance,
      })),
    })
  }),
)

export const feedRouter = Router()

// Лента последних дропов на главной.
feedRouter.get(
  '/live',
  ah(async (req, res) => {
    const take = Math.min(Number.parseInt(req.query.limit, 10) || 20, 50)
    const openings = await prisma.opening.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      include: { item: true, case: true, user: true },
    })
    res.json({ openings: openings.map(publicOpening) })
  }),
)
