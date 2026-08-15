import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { config } from './config.js'
import { prisma } from './db.js'
import { AppError } from './lib/errors.js'
import { authRouter } from './routes/auth.js'
import { casesRouter, feedRouter } from './routes/cases.js'
import { userRouter } from './routes/user.js'
import { paymentsRouter } from './routes/payments.js'
import { adminRouter } from './routes/admin.js'
import { coinflipRouter, configRouter, rouletteRouter } from './routes/games.js'
import { startRouletteLoop } from './services/roulette.js'
import { handleStripeWebhook } from './services/payments.js'
import { applyMigrations } from './lib/migrate.js'
import { seedDatabase } from '../prisma/seed.js'

const app = express()
app.set('trust proxy', 1)

// В разработке пускаем любой localhost — фронтенд легко переезжает на
// соседний порт. В production список строго из FRONTEND_URL (через запятую).
const isLocalhost = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)

app.use(
  cors({
    origin(origin, callback) {
      // Запросы без Origin (curl, серверный рендеринг, webhooks) не ограничиваем.
      if (!origin) return callback(null, true)
      const allowed =
        config.corsOrigins.includes(origin.replace(/\/$/, '')) ||
        (config.env !== 'production' && isLocalhost(origin))
      callback(allowed ? null : new Error(`Origin ${origin} не разрешён`), allowed)
    },
    credentials: true,
  }),
)
if (config.env !== 'test') app.use(morgan('dev'))

// Webhook принимает сырое тело — подпись считается по байтам,
// поэтому маршрут объявлен ДО express.json().
app.post(
  '/api/payments/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    try {
      const result = await handleStripeWebhook(req.body, req.headers['stripe-signature'])
      res.json(result)
    } catch (err) {
      next(err)
    }
  },
)

app.use(express.json({ limit: '256kb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: config.env, currency: config.currency })
})

app.use('/api/auth', authRouter)
app.use('/api/cases', casesRouter)
app.use('/api/openings', feedRouter)
app.use('/api/me', userRouter)
app.use('/api/config', configRouter)
app.use('/api/roulette', rouletteRouter)
app.use('/api/coinflip', coinflipRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/admin', adminRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' })
})

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code })
  }
  if (err?.code === 'P2025') return res.status(404).json({ error: 'Запись не найдена' })
  if (err?.code === 'P2002') return res.status(400).json({ error: 'Такая запись уже существует' })

  console.error(err)
  res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

/**
 * Старт: сначала приводим схему БД в актуальное состояние, при первом
 * запуске наполняем её демо-данными, и только потом слушаем порт.
 */
async function bootstrap() {
  if (config.autoMigrate) {
    await applyMigrations({ syncSchema: config.env !== 'production' })
  }

  if (config.autoSeed) {
    const casesCount = await prisma.case.count()
    if (casesCount === 0) {
      console.log('База пустая — заливаю демо-данные...')
      await seedDatabase(prisma)
    }
  }

  const instance = app.listen(config.port)

  await new Promise((resolve, reject) => {
    instance.once('listening', resolve)
    instance.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Порт ${config.port} уже занят. Закройте другой экземпляр API ` +
              `или запустите с другим портом: PORT=4001 npm run dev`,
          ),
        )
      } else reject(err)
    })
  })

  console.log(`API запущен на http://localhost:${config.port} (${config.env})`)
  console.log(`Платёжный провайдер: ${config.payments.provider}`)

  // Раунды рулетки крутятся независимо от того, есть ли игроки.
  startRouletteLoop()

  return instance
}

const server = await bootstrap().catch((err) => {
  console.error(`\n${err.message}\n`)
  process.exit(1)
})

async function shutdown(signal) {
  console.log(`\n${signal}: останавливаю сервер...`)
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
