import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Путь к JS-скрипту Prisma CLI из локальных node_modules (работает и на Windows). */
function prismaCliPath() {
  const pkg = require('prisma/package.json')
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.prisma
  if (!bin) throw new Error('Не найден бинарь Prisma CLI')
  return path.join(path.dirname(require.resolve('prisma/package.json')), bin)
}

function runPrisma(args, { allowExitCodes = [0] } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [prismaCliPath(), ...args], {
      cwd: backendRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let output = ''
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))

    child.on('error', reject)
    child.on('close', (code) => {
      if (allowExitCodes.includes(code)) resolve({ code, output })
      else reject(new Error(`prisma ${args.join(' ')} завершился с кодом ${code}:\n${output}`))
    })
  })
}

/**
 * Применяет непринятые миграции к SQLite-базе при старте приложения.
 * Если файла базы ещё нет, он создаётся вместе со всеми таблицами,
 * поэтому отдельный ручной шаг настройки не нужен.
 */
export async function applyMigrations({ syncSchema = false } = {}) {
  const { output } = await runPrisma(['migrate', 'deploy'])
  const applied = output.match(/Applying migration `([^`]+)`/g) ?? []

  if (applied.length) {
    console.log(`Миграции: применено ${applied.length}`)
    for (const line of applied) console.log(`  ${line.replace('Applying migration ', '')}`)
  } else {
    console.log('Миграции: база актуальна')
  }

  if (syncSchema) await syncSchemaDrift()
  return applied.length
}

/**
 * Догоняет базу под schema.prisma, если её правили без создания миграции.
 * Только для разработки: в production схема меняется исключительно
 * версионированными миграциями (`npm run db:migrate`).
 */
async function syncSchemaDrift() {
  const diff = await runPrisma(
    [
      'migrate',
      'diff',
      '--from-schema-datasource',
      'prisma/schema.prisma',
      '--to-schema-datamodel',
      'prisma/schema.prisma',
      '--exit-code',
    ],
    { allowExitCodes: [0, 2] },
  )

  // 0 — расхождений нет, 2 — схема и база разошлись.
  if (diff.code !== 2) return false

  console.log('Схема изменилась без миграции — синхронизирую таблицы (db push)...')
  try {
    await runPrisma(['db', 'push', '--skip-generate'])
    console.log('Таблицы синхронизированы. Для продакшена создайте миграцию: npm run db:migrate')
    return true
  } catch (err) {
    console.warn(
      'Не удалось синхронизировать схему автоматически (вероятно, изменение приведёт к потере данных).\n' +
        'Создайте миграцию вручную: npm run db:migrate\n' +
        err.message,
    )
    return false
  }
}
