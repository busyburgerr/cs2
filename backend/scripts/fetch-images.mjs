/**
 * Подтягивает официальные изображения скинов из публичного датасета CS2
 * и проставляет их в Item.image.
 *
 *   npm run images          — заполнить только предметы без картинки
 *   npm run images -- --all — перезаписать все
 *
 * Источник: ByMykel/CSGO-API (открытый датасет, картинки лежат на CDN Steam).
 * Если сеть недоступна, ничего не ломается: фронтенд рисует векторный силуэт.
 */
import { PrismaClient } from '@prisma/client'

const SOURCE = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json'

const prisma = new PrismaClient()
const overwriteAll = process.argv.includes('--all')

/** Приводит название к виду, по которому сравниваем: без StatTrak, регистра и лишних знаков. */
function normalize(name) {
  return name
    .replace(/^StatTrak™\s*/i, '')
    .replace(/^Сувенир\s*/i, '')
    .replace(/★/g, '')
    .replace(/[^a-zа-я0-9|]/gi, '')
    .toLowerCase()
}

/** Отбрасывает уточнение фазы: "Doppler (Phase 2)" -> "Doppler". */
function stripPhase(name) {
  return name.replace(/\s*\((Phase \d|Ruby|Sapphire|Black Pearl|Emerald)\)\s*$/i, '')
}

async function main() {
  console.log('Загружаю датасет скинов...')
  const res = await fetch(SOURCE)
  if (!res.ok) throw new Error(`Источник ответил ${res.status}`)
  const skins = await res.json()
  console.log(`  записей в датасете: ${skins.length}`)

  // Индекс: точное имя и имя без фазы. Первое вхождение выигрывает.
  const byName = new Map()
  for (const skin of skins) {
    if (!skin?.name || !skin?.image) continue
    for (const key of [normalize(skin.name), normalize(stripPhase(skin.name))]) {
      if (!byName.has(key)) byName.set(key, skin.image)
    }
  }

  const items = await prisma.item.findMany({
    where: overwriteAll ? undefined : { OR: [{ image: null }, { image: '' }] },
    orderBy: { name: 'asc' },
  })
  console.log(`  предметов к обработке: ${items.length}`)

  let matched = 0
  const missed = []

  for (const item of items) {
    const image = byName.get(normalize(item.name)) ?? byName.get(normalize(`${item.weapon}|${item.skin}`))
    if (!image) {
      missed.push(item.name)
      continue
    }
    await prisma.item.update({ where: { id: item.id }, data: { image } })
    matched++
  }

  console.log(`\nПроставлено картинок: ${matched} из ${items.length}`)
  if (missed.length) {
    console.log('Не нашлось совпадений (останутся с векторным силуэтом):')
    for (const name of missed) console.log(`  - ${name}`)
  }
}

main()
  .catch((err) => {
    console.error('Ошибка:', err.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
