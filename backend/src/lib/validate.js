import { AppError } from './errors.js'

// Валидация тела/квери запроса схемой zod с человекочитаемой ошибкой.
export function parse(schema, data) {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issue = result.error.issues[0]
    const path = issue.path.join('.')
    throw new AppError(400, path ? `${path}: ${issue.message}` : issue.message, 'VALIDATION')
  }
  return result.data
}
