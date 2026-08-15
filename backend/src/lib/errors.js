export class AppError extends Error {
  constructor(status, message, code = undefined) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const badRequest = (msg, code) => new AppError(400, msg, code)
export const unauthorized = (msg = 'Требуется авторизация') => new AppError(401, msg)
export const forbidden = (msg = 'Недостаточно прав') => new AppError(403, msg)
export const notFound = (msg = 'Не найдено') => new AppError(404, msg)

// Оборачивает async-обработчик, чтобы отклонённый промис уходил в error middleware.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
