import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { prisma } from '../db.js'
import { AppError, forbidden, unauthorized } from '../lib/errors.js'

function extractToken(req) {
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) return header.slice(7)
  if (req.cookies?.token) return req.cookies.token
  return null
}

async function loadUser(req) {
  const token = extractToken(req)
  if (!token) return null
  let payload
  try {
    payload = jwt.verify(token, config.jwtSecret)
  } catch {
    throw unauthorized('Сессия истекла или токен недействителен')
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user) throw unauthorized('Пользователь не найден')
  if (user.banned) throw new AppError(403, 'Аккаунт заблокирован')
  return user
}

export async function optionalAuth(req, _res, next) {
  try {
    req.user = await loadUser(req)
    next()
  } catch {
    req.user = null
    next()
  }
}

export async function requireAuth(req, _res, next) {
  try {
    const user = await loadUser(req)
    if (!user) throw unauthorized()
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

export function requireAdmin(req, _res, next) {
  if (!req.user) return next(unauthorized())
  if (req.user.role !== 'ADMIN') return next(forbidden('Доступ только для администратора'))
  next()
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  })
}
