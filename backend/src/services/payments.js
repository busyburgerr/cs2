import { config } from '../config.js'
import { prisma } from '../db.js'
import { AppError, badRequest, notFound } from '../lib/errors.js'
import { getSettings } from './settings.js'

/**
 * Платежи. Провайдер выбирается через PAYMENT_PROVIDER.
 *
 *  - mock   — для локальной разработки: оплата подтверждается вручную
 *             на странице /wallet/checkout. В production запрещён (см. config.js).
 *  - stripe — реальный приём денег через Stripe Checkout + webhook.
 *             Требует `npm i stripe`, STRIPE_SECRET_KEY и STRIPE_WEBHOOK_SECRET.
 *
 * Баланс зачисляется ТОЛЬКО в creditPayment() и только один раз —
 * функция идемпотентна, повторный webhook денег не добавит.
 */

let stripeClient = null
async function getStripe() {
  if (stripeClient) return stripeClient
  if (!config.payments.stripeSecretKey) {
    throw new AppError(500, 'STRIPE_SECRET_KEY не задан')
  }
  let Stripe
  try {
    ;({ default: Stripe } = await import('stripe'))
  } catch {
    throw new AppError(500, 'Модуль stripe не установлен. Выполните: npm i stripe')
  }
  stripeClient = new Stripe(config.payments.stripeSecretKey)
  return stripeClient
}

export async function createDeposit({ user, amount }) {
  if (user.demo) {
    throw badRequest('Демо-аккаунт не может пополнять баланс реальными деньгами')
  }
  const settings = await getSettings()
  const { provider } = config.payments
  const minDeposit = settings['wallet.minDeposit']
  const maxDeposit = settings['wallet.maxDeposit']
  if (!Number.isInteger(amount)) throw badRequest('Некорректная сумма')
  if (amount < minDeposit) throw badRequest(`Минимальная сумма пополнения — ${minDeposit / 100}`)
  if (amount > maxDeposit) throw badRequest(`Максимальная сумма пополнения — ${maxDeposit / 100}`)

  const payment = await prisma.payment.create({
    data: { userId: user.id, provider, amount, currency: config.currency, status: 'PENDING' },
  })

  if (provider === 'stripe') {
    const stripe = await getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: payment.id,
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: config.currency.toLowerCase(),
            unit_amount: amount,
            product_data: { name: `Пополнение баланса — ${user.username}` },
          },
        },
      ],
      success_url: `${config.frontendUrl}/wallet?status=success`,
      cancel_url: `${config.frontendUrl}/wallet?status=cancel`,
      metadata: { paymentId: payment.id, userId: user.id },
    })
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerId: session.id },
    })
    return { payment, checkoutUrl: session.url }
  }

  // mock
  return {
    payment,
    checkoutUrl: `${config.frontendUrl}/wallet/checkout?payment=${payment.id}`,
  }
}

/** Идемпотентное зачисление оплаченного платежа на баланс. */
export async function creditPayment(paymentId) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } })
    if (!payment) throw notFound('Платёж не найден')
    if (payment.status === 'PAID') return { payment, credited: false }
    if (payment.status !== 'PENDING') throw badRequest('Платёж нельзя подтвердить')

    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'PAID', paidAt: new Date() },
    })
    if (claimed.count !== 1) return { payment, credited: false }

    const user = await tx.user.update({
      where: { id: payment.userId },
      data: { balance: { increment: payment.amount } },
    })

    await tx.transaction.create({
      data: {
        userId: payment.userId,
        type: 'DEPOSIT',
        amount: payment.amount,
        balanceAfter: user.balance,
        meta: JSON.stringify({ paymentId, provider: payment.provider }),
      },
    })

    return { payment: { ...payment, status: 'PAID' }, credited: true, balance: user.balance }
  })
}

/** Разбор webhook Stripe: проверка подписи и зачисление. */
export async function handleStripeWebhook(rawBody, signature) {
  const stripe = await getStripe()
  if (!config.payments.stripeWebhookSecret) {
    throw new AppError(500, 'STRIPE_WEBHOOK_SECRET не задан')
  }
  let event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.payments.stripeWebhookSecret,
    )
  } catch (err) {
    throw new AppError(400, `Подпись webhook невалидна: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const paymentId = session.metadata?.paymentId || session.client_reference_id
    if (paymentId) await creditPayment(paymentId)
  }

  if (event.type === 'checkout.session.expired') {
    const paymentId = event.data.object.metadata?.paymentId
    if (paymentId) {
      await prisma.payment.updateMany({
        where: { id: paymentId, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      })
    }
  }

  return { received: true, type: event.type }
}
