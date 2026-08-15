import crypto from 'node:crypto'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { config } from '../config.js'
import { passwordResetLetter, sendMail } from '../services/mailer.js'
import { ah, badRequest, unauthorized } from '../lib/errors.js'
import { parse } from '../lib/validate.js'
import { publicUser } from '../lib/serialize.js'
import { requireAuth, signToken } from '../middleware/auth.js'
import { generateClientSeed, generateServerSeed, hashServerSeed } from '../lib/fair.js'

export const authRouter = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток, попробуйте позже' },
})

const registerSchema = z.object({
  email: z.string().email('Некорректный e-mail'),
  username: z
    .string()
    .min(3, 'Минимум 3 символа')
    .max(20, 'Максимум 20 символов')
    .regex(/^[a-zA-Z0-9_]+$/, 'Только латиница, цифры и _'),
  password: z.string().min(8, 'Минимум 8 символов').max(100),
  ageConfirmed: z.literal(true, {
    errorMap: () => ({ message: 'Нужно подтвердить, что вам исполнилось 18 лет' }),
  }),
})

authRouter.post(
  '/register',
  authLimiter,
  ah(async (req, res) => {
    const data = parse(registerSchema, req.body)
    const email = data.email.toLowerCase().trim()

    const exists = await prisma.user.findFirst({
      where: { OR: [{ email }, { username: data.username }] },
    })
    if (exists) throw badRequest('E-mail или никнейм уже заняты')

    const serverSeed = generateServerSeed()
    const user = await prisma.user.create({
      data: {
        email,
        username: data.username,
        passwordHash: await bcrypt.hash(data.password, 12),
        serverSeed,
        serverSeedHash: hashServerSeed(serverSeed),
        clientSeed: generateClientSeed(),
      },
    })

    res.status(201).json({ token: signToken(user), user: publicUser(user) })
  }),
)

const loginSchema = z.object({
  email: z.string().min(1, 'Укажите e-mail'),
  password: z.string().min(1, 'Укажите пароль'),
})

authRouter.post(
  '/login',
  authLimiter,
  ah(async (req, res) => {
    const data = parse(loginSchema, req.body)
    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } })
    // Хешируем всегда, чтобы время ответа не выдавало наличие аккаунта.
    const ok = await bcrypt.compare(data.password, user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv')
    if (!user || !ok) throw unauthorized('Неверный e-mail или пароль')
    if (user.banned) throw unauthorized('Аккаунт заблокирован')

    res.json({ token: signToken(user), user: publicUser(user) })
  }),
)

authRouter.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    res.json({ user: publicUser(req.user) })
  }),
)

// --------------------------------------------------------------- пароль

authRouter.post(
  '/change-password',
  requireAuth,
  ah(async (req, res) => {
    const data = parse(
      z.object({
        currentPassword: z.string().min(1, 'Укажите текущий пароль'),
        newPassword: z.string().min(8, 'Минимум 8 символов').max(100),
      }),
      req.body,
    )

    const ok = await bcrypt.compare(data.currentPassword, req.user.passwordHash)
    if (!ok) throw badRequest('Текущий пароль указан неверно')
    if (data.currentPassword === data.newPassword) {
      throw badRequest('Новый пароль совпадает с текущим')
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: await bcrypt.hash(data.newPassword, 12) },
    })

    // Старые ссылки восстановления после смены пароля недействительны.
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    // Выдаём новый токен: старый остаётся валидным до истечения срока,
    // поэтому в production сюда стоит добавить чёрный список сессий.
    res.json({ token: signToken(user), user: publicUser(user) })
  }),
)

authRouter.post(
  '/forgot-password',
  authLimiter,
  ah(async (req, res) => {
    const { email } = parse(z.object({ email: z.string().email() }), req.body)
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

    // Ответ одинаковый в любом случае — по нему нельзя узнать, есть ли аккаунт.
    if (user && !user.banned) {
      const token = crypto.randomBytes(32).toString('hex')
      const ttl = config.mail.resetTtlMinutes

      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
          expiresAt: new Date(Date.now() + ttl * 60 * 1000),
        },
      })

      const url = `${config.frontendUrl}/reset-password?token=${token}`
      const letter = passwordResetLetter({ username: user.username, url, ttlMinutes: ttl })
      await sendMail({ to: user.email, ...letter })
    }

    res.json({ ok: true, message: 'Если такой аккаунт существует, письмо отправлено' })
  }),
)

authRouter.post(
  '/reset-password',
  authLimiter,
  ah(async (req, res) => {
    const data = parse(
      z.object({
        token: z.string().min(10),
        password: z.string().min(8, 'Минимум 8 символов').max(100),
      }),
      req.body,
    )

    const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex')
    const reset = await prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true },
    })

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw badRequest('Ссылка недействительна или устарела')
    }

    const user = await prisma.$transaction(async (tx) => {
      await tx.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } })
      return tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash: await bcrypt.hash(data.password, 12) },
      })
    })

    res.json({ token: signToken(user), user: publicUser(user) })
  }),
)
