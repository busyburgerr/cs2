import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { ah, badRequest, notFound } from '../lib/errors.js'
import { parse } from '../lib/validate.js'
import { publicCase, publicItem, publicOpening, publicUser } from '../lib/serialize.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { searchSkins } from '../services/skinCatalog.js'
import {
  SETTINGS_GROUPS,
  SETTINGS_SCHEMA,
  economySummary,
  getSettings,
  updateSettings,
} from '../services/settings.js'

export const adminRouter = Router()
adminRouter.use(requireAuth, requireAdmin)

const RARITIES = [
  'CONSUMER',
  'INDUSTRIAL',
  'MILSPEC',
  'RESTRICTED',
  'CLASSIFIED',
  'COVERT',
  'CONTRABAND',
]
const WEARS = ['FN', 'MW', 'FT', 'WW', 'BS']

// ----------------------------------------------------------------- экономика

adminRouter.get(
  '/settings',
  ah(async (_req, res) => {
    const values = await getSettings()
    res.json({
      groups: SETTINGS_GROUPS,
      schema: Object.entries(SETTINGS_SCHEMA).map(([key, spec]) => ({
        key,
        type: spec.type,
        min: spec.min,
        max: spec.max,
        group: spec.group,
        label: spec.label,
        hint: spec.hint ?? null,
        default: spec.default,
      })),
      values,
      summary: economySummary(values),
    })
  }),
)

adminRouter.put(
  '/settings',
  ah(async (req, res) => {
    const { values } = parse(
      z.object({ values: z.record(z.union([z.number(), z.boolean()])) }),
      req.body,
    )
    const updated = await updateSettings(values)
    res.json({ values: updated, summary: economySummary(updated) })
  }),
)

// ---------------------------------------------------------------- статистика

adminRouter.get(
  '/stats',
  ah(async (_req, res) => {
    // Сутки считаем по UTC — так же, как ключи в графике ниже,
    // иначе часовой пояс сервера сдвигает данные на день.
    const now = new Date()
    const startUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13)
    const since = new Date(startUtc)
    const DAY_MS = 24 * 60 * 60 * 1000

    const [
      usersCount,
      openingsAgg,
      depositsAgg,
      casesCount,
      itemsCount,
      recentOpenings,
      chartRows,
      rouletteAgg,
      coinflipAgg,
    ] = await Promise.all([
        prisma.user.count(),
        // Демо-игры в деньгах не участвуют и в статистику не попадают.
        prisma.opening.aggregate({
          where: { demo: false },
          _sum: { cost: true, value: true },
          _count: true,
        }),
        prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true }, _count: true }),
        prisma.case.count(),
        prisma.item.count(),
        prisma.opening.findMany({
          take: 15,
          orderBy: { createdAt: 'desc' },
          include: { item: true, case: true, user: true },
        }),
        prisma.opening.findMany({
          where: { createdAt: { gte: since }, demo: false },
          select: { cost: true, value: true, createdAt: true },
        }),
        prisma.rouletteBet.aggregate({
          where: { demo: false },
          _sum: { amount: true, payout: true },
          _count: true,
        }),
        prisma.coinflipGame.aggregate({
          where: { demo: false },
          _sum: { amount: true, payout: true },
          _count: true,
        }),
      ])

    const wagered = openingsAgg._sum.cost ?? 0
    const returned = openingsAgg._sum.value ?? 0

    const byDay = new Map()
    for (let i = 0; i < 14; i++) {
      const key = new Date(startUtc + i * DAY_MS).toISOString().slice(0, 10)
      byDay.set(key, { date: key, wagered: 0, returned: 0, opens: 0 })
    }
    for (const row of chartRows) {
      const key = row.createdAt.toISOString().slice(0, 10)
      const bucket = byDay.get(key)
      if (!bucket) continue
      bucket.wagered += row.cost
      bucket.returned += row.value
      bucket.opens += 1
    }

    const games = {
      roulette: {
        rounds: rouletteAgg._count,
        wagered: rouletteAgg._sum.amount ?? 0,
        returned: rouletteAgg._sum.payout ?? 0,
      },
      coinflip: {
        rounds: coinflipAgg._count,
        wagered: coinflipAgg._sum.amount ?? 0,
        returned: coinflipAgg._sum.payout ?? 0,
      },
    }
    for (const game of Object.values(games)) {
      game.ggr = game.wagered - game.returned
      game.margin = game.wagered > 0 ? game.ggr / game.wagered : 0
    }

    res.json({
      usersCount,
      casesCount,
      itemsCount,
      games,
      totalGgr: wagered - returned + games.roulette.ggr + games.coinflip.ggr,
      openingsCount: openingsAgg._count,
      depositsCount: depositsAgg._count,
      depositsTotal: depositsAgg._sum.amount ?? 0,
      wagered,
      returned,
      ggr: wagered - returned,
      ggrMargin: wagered > 0 ? (wagered - returned) / wagered : 0,
      chart: [...byDay.values()],
      recentOpenings: recentOpenings.map(publicOpening),
    })
  }),
)

// -------------------------------------------------------------------- items

adminRouter.get(
  '/items',
  ah(async (req, res) => {
    const q = (req.query.q || '').toString().trim()
    const items = await prisma.item.findMany({
      where: q ? { name: { contains: q } } : undefined,
      orderBy: { price: 'desc' },
      take: 500,
    })
    res.json({ items: items.map(publicItem) })
  }),
)

// Подбор официальной картинки скина по названию — для формы предмета.
adminRouter.get(
  '/skin-lookup',
  ah(async (req, res) => {
    const q = (req.query.q || '').toString().trim()
    if (q.length < 2) return res.json({ results: [] })
    const results = await searchSkins(q, 8)
    res.json({ results })
  }),
)

const itemSchema = z.object({
  weapon: z.string().min(1).max(60),
  skin: z.string().min(1).max(60),
  rarity: z.enum(RARITIES),
  wear: z.enum(WEARS),
  statTrak: z.boolean().optional().default(false),
  price: z.number().int().min(1, 'Цена должна быть больше нуля'),
  image: z.string().url().nullish().or(z.literal('')),
})

function buildItemData(data) {
  const name = `${data.statTrak ? 'StatTrak™ ' : ''}${data.weapon} | ${data.skin}`
  return { ...data, name, image: data.image || null }
}

adminRouter.post(
  '/items',
  ah(async (req, res) => {
    const data = parse(itemSchema, req.body)
    const item = await prisma.item.create({ data: buildItemData(data) })
    res.status(201).json({ item: publicItem(item) })
  }),
)

adminRouter.patch(
  '/items/:id',
  ah(async (req, res) => {
    const data = parse(itemSchema, req.body)
    const item = await prisma.item.update({
      where: { id: req.params.id },
      data: buildItemData(data),
    })
    res.json({ item: publicItem(item) })
  }),
)

adminRouter.delete(
  '/items/:id',
  ah(async (req, res) => {
    const used = await prisma.inventoryItem.count({ where: { itemId: req.params.id } })
    if (used > 0) {
      throw badRequest('Предмет есть в инвентарях игроков — удаление запрещено')
    }
    await prisma.item.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  }),
)

// -------------------------------------------------------------------- cases

adminRouter.get(
  '/cases',
  ah(async (_req, res) => {
    const cases = await prisma.case.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { items: { include: { item: true } }, _count: { select: { openings: true } } },
    })
    res.json({
      cases: cases.map((c) => ({ ...publicCase(c), openingsCount: c._count.openings })),
    })
  }),
)

adminRouter.get(
  '/cases/:id',
  ah(async (req, res) => {
    const caseRow = await prisma.case.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { item: true } } },
    })
    if (!caseRow) throw notFound('Кейс не найден')
    res.json({ case: publicCase(caseRow, { withItems: true }) })
  }),
)

const caseSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Только строчная латиница, цифры и дефис'),
  title: z.string().min(2).max(80),
  description: z.string().max(400).nullish(),
  image: z.string().url().nullish().or(z.literal('')),
  price: z.number().int().min(1),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
})

adminRouter.post(
  '/cases',
  ah(async (req, res) => {
    const data = parse(caseSchema, req.body)
    const exists = await prisma.case.findUnique({ where: { slug: data.slug } })
    if (exists) throw badRequest('Кейс с таким slug уже существует')
    const created = await prisma.case.create({
      data: { ...data, image: data.image || null, description: data.description || null },
    })
    res.status(201).json({ case: publicCase(created) })
  }),
)

adminRouter.patch(
  '/cases/:id',
  ah(async (req, res) => {
    const data = parse(caseSchema.partial(), req.body)
    if (data.slug) {
      const clash = await prisma.case.findFirst({
        where: { slug: data.slug, NOT: { id: req.params.id } },
      })
      if (clash) throw badRequest('Кейс с таким slug уже существует')
    }
    if (data.image !== undefined) data.image = data.image || null
    if (data.description !== undefined) data.description = data.description || null

    const updated = await prisma.case.update({ where: { id: req.params.id }, data })
    res.json({ case: publicCase(updated) })
  }),
)

adminRouter.delete(
  '/cases/:id',
  ah(async (req, res) => {
    const opened = await prisma.opening.count({ where: { caseId: req.params.id } })
    if (opened > 0) {
      throw badRequest('Кейс уже открывали — его можно только отключить, но не удалить')
    }
    await prisma.case.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  }),
)

// Полная замена состава кейса: [{ itemId, weight }]
const caseItemsSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        weight: z.number().int().min(1, 'Вес должен быть >= 1'),
      }),
    )
    .min(1, 'В кейсе должен быть хотя бы один предмет'),
})

adminRouter.put(
  '/cases/:id/items',
  ah(async (req, res) => {
    const { items } = parse(caseItemsSchema, req.body)

    const ids = items.map((i) => i.itemId)
    if (new Set(ids).size !== ids.length) throw badRequest('Предметы в кейсе не должны повторяться')

    const found = await prisma.item.count({ where: { id: { in: ids } } })
    if (found !== ids.length) throw badRequest('Некоторые предметы не найдены')

    const caseRow = await prisma.case.findUnique({ where: { id: req.params.id } })
    if (!caseRow) throw notFound('Кейс не найден')

    await prisma.$transaction([
      prisma.caseItem.deleteMany({ where: { caseId: caseRow.id } }),
      prisma.caseItem.createMany({
        data: items.map((i) => ({ caseId: caseRow.id, itemId: i.itemId, weight: i.weight })),
      }),
    ])

    const updated = await prisma.case.findUnique({
      where: { id: caseRow.id },
      include: { items: { include: { item: true } } },
    })
    res.json({ case: publicCase(updated, { withItems: true }) })
  }),
)

// -------------------------------------------------------------------- users

adminRouter.get(
  '/users',
  ah(async (req, res) => {
    const q = (req.query.q || '').toString().trim()
    const users = await prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q } }, { username: { contains: q } }] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { _count: { select: { openings: true } } },
    })
    res.json({
      users: users.map((u) => ({
        ...publicUser(u),
        balance: u.balance,
        banned: u.banned,
        demoBalance: u.demoBalance,
        demoForceItemId: u.demoForceItemId,
        demoForceCoinflip: u.demoForceCoinflip,
        openingsCount: u._count.openings,
      })),
    })
  }),
)

adminRouter.patch(
  '/users/:id',
  ah(async (req, res) => {
    const data = parse(
      z.object({ role: z.enum(['USER', 'ADMIN']).optional(), banned: z.boolean().optional() }),
      req.body,
    )
    if (req.params.id === req.user.id && (data.role === 'USER' || data.banned)) {
      throw badRequest('Нельзя разжаловать или забанить самого себя')
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data })
    res.json({ user: { ...publicUser(user), banned: user.banned } })
  }),
)

/**
 * Демо-режим аккаунта: виртуальный баланс и заданный исход следующей игры.
 * Нужен для записи промо-роликов. Подкрутка возможна только здесь —
 * на аккаунтах с реальными деньгами таких полей нет вообще.
 */
adminRouter.put(
  '/users/:id/demo',
  ah(async (req, res) => {
    const data = parse(
      z.object({
        demo: z.boolean().optional(),
        demoBalance: z.number().int().min(0).max(1_000_000_00).optional(),
        demoForceItemId: z.string().nullish(),
        demoForceCoinflip: z.enum(['WIN', 'LOSE']).nullish(),
      }),
      req.body,
    )

    const target = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!target) throw notFound('Пользователь не найден')

    const willBeDemo = data.demo ?? target.demo
    const forcing = data.demoForceItemId || data.demoForceCoinflip
    if (forcing && !willBeDemo) {
      throw badRequest('Задать исход игры можно только демо-аккаунту')
    }
    if (willBeDemo && target.balance > 0 && data.demo === true) {
      throw badRequest(
        'На аккаунте есть реальные деньги. Сначала обнулите баланс, иначе демо-режим смешает реальные и виртуальные средства.',
      )
    }
    if (data.demoForceItemId) {
      const item = await prisma.item.findUnique({ where: { id: data.demoForceItemId } })
      if (!item) throw badRequest('Предмет не найден')
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(data.demo !== undefined ? { demo: data.demo } : {}),
        ...(data.demoBalance !== undefined ? { demoBalance: data.demoBalance } : {}),
        ...(data.demoForceItemId !== undefined ? { demoForceItemId: data.demoForceItemId } : {}),
        ...(data.demoForceCoinflip !== undefined
          ? { demoForceCoinflip: data.demoForceCoinflip }
          : {}),
      },
    })

    res.json({
      user: {
        ...publicUser(user),
        demoBalance: user.demoBalance,
        demoForceItemId: user.demoForceItemId,
        demoForceCoinflip: user.demoForceCoinflip,
      },
    })
  }),
)

adminRouter.post(
  '/users/:id/balance',
  ah(async (req, res) => {
    const { amount, note } = parse(
      z.object({ amount: z.number().int(), note: z.string().max(200).optional() }),
      req.body,
    )
    if (amount === 0) throw badRequest('Сумма не может быть нулевой')

    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: req.params.id } })
      if (!target) throw notFound('Пользователь не найден')

      // Демо-аккаунту корректируем виртуальный баланс.
      const field = target.demo ? 'demoBalance' : 'balance'
      if (target[field] + amount < 0) throw badRequest('Баланс не может уйти в минус')

      const user = await tx.user.update({
        where: { id: target.id },
        data: { [field]: { increment: amount } },
      })
      await tx.transaction.create({
        data: {
          userId: user.id,
          demo: target.demo,
          type: 'ADMIN_ADJUST',
          amount,
          balanceAfter: user[field],
          meta: JSON.stringify({ by: req.user.username, note: note || null }),
        },
      })
      return user
    })

    res.json({ user: publicUser(result) })
  }),
)

// ----------------------------------------------------------------- журналы

adminRouter.get(
  '/openings',
  ah(async (req, res) => {
    const where = {}
    if (req.query.userId) where.userId = req.query.userId.toString()
    if (req.query.caseId) where.caseId = req.query.caseId.toString()

    const openings = await prisma.opening.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number.parseInt(req.query.limit, 10) || 100, 300),
      include: { item: true, case: true, user: true },
    })
    res.json({ openings: openings.map(publicOpening) })
  }),
)

adminRouter.get(
  '/payments',
  ah(async (req, res) => {
    const payments = await prisma.payment.findMany({
      where: req.query.status ? { status: req.query.status.toString() } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { username: true, email: true } } },
    })
    res.json({ payments })
  }),
)
