import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
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
