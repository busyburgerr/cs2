import 'dotenv/config'

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 4000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Основной адрес фронтенда (используется в ссылках на оплату).
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim(),
  // Разрешённые origin-ы для CORS: можно перечислить через запятую.
  corsOrigins: (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean),
  currency: process.env.CURRENCY || 'USD',

  // Схема БД накатывается при старте (prisma migrate deploy).
  autoMigrate: bool(process.env.AUTO_MIGRATE, true),
  // Демо-данные заливаются, только если база пустая и мы не в production.
  autoSeed: bool(process.env.AUTO_SEED, process.env.NODE_ENV !== 'production'),

  // Платежи
  payments: {
    provider: process.env.PAYMENT_PROVIDER || 'mock', // mock | stripe
    minDeposit: int(process.env.MIN_DEPOSIT, 500), // 5.00
    maxDeposit: int(process.env.MAX_DEPOSIT, 100000), // 1000.00
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  // Доля цены предмета, которую пользователь получает при продаже назад площадке.
  sellRate: Number.parseFloat(process.env.SELL_RATE || '0.9'),

  // Цены демо-предметов заданы в долларовом масштабе. Множитель позволяет
  // пересидировать базу под другую валюту (например, 90 для рублей).
  seedPriceMultiplier: Number.parseFloat(process.env.SEED_PRICE_MULTIPLIER || '1'),

  seedAdmin: {
    email: process.env.ADMIN_EMAIL || 'admin@cs2cases.local',
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin12345',
  },
}

if (config.env === 'production') {
  if (config.jwtSecret === 'dev-secret-change-me') {
    throw new Error('JWT_SECRET обязателен в production')
  }
  if (config.payments.provider === 'mock') {
    throw new Error('PAYMENT_PROVIDER=mock недопустим в production')
  }
}
