import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { prisma } from '../db.js'
import { ah, badRequest, notFound } from '../lib/errors.js'
import { parse } from '../lib/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { createDeposit, creditPayment } from '../services/payments.js'
import { getSettings } from '../services/settings.js'

export const paymentsRouter = Router()

paymentsRouter.get(
  '/config',
  ah(async (_req, res) => {
    const settings = await getSettings()
    res.json({
      provider: config.payments.provider,
      currency: config.currency,
      minDeposit: settings['wallet.minDeposit'],
      maxDeposit: settings['wallet.maxDeposit'],
    })
  }),
)

paymentsRouter.post(
  '/deposit',
  requireAuth,
  ah(async (req, res) => {
    const { amount } = parse(
      z.object({ amount: z.number().int().positive() }),
      req.body ?? {},
    )
    const { payment, checkoutUrl } = await createDeposit({ user: req.user, amount })
    res.status(201).json({
      payment: { id: payment.id, amount: payment.amount, status: payment.status, provider: payment.provider },
      checkoutUrl,
    })
  }),
)

paymentsRouter.get(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    })
    if (!payment) throw notFound('Платёж не найден')
    res.json({ payment })
  }),
)

/**
 * Подтверждение тестового платежа. Работает только с provider=mock,
 * то есть только в dev-окружении.
 */
paymentsRouter.post(
  '/:id/mock-confirm',
  requireAuth,
  ah(async (req, res) => {
    if (config.payments.provider !== 'mock') {
      throw badRequest('Тестовая оплата отключена')
    }
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    })
    if (!payment) throw notFound('Платёж не найден')

    const result = await creditPayment(payment.id)
    res.json({ status: 'PAID', credited: result.credited, balance: result.balance })
  }),
)
