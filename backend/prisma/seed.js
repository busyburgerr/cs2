import { pathToFileURL } from 'node:url'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { config } from '../src/config.js'
import { generateClientSeed, generateServerSeed, hashServerSeed } from '../src/lib/fair.js'

// [оружие, скин, редкость, износ, цена в центах]
const ITEMS = [
  ['P2000', 'Ivory', 'CONSUMER', 'FT', 45],
  ['MP7', 'Skulls', 'CONSUMER', 'FT', 60],
  ['Tec-9', 'Army Mesh', 'CONSUMER', 'BS', 30],
  ['UMP-45', 'Gunsmoke', 'INDUSTRIAL', 'FT', 55],
  ['Sawed-Off', 'Origami', 'INDUSTRIAL', 'FT', 40],
  ['Negev', 'Army Sheen', 'INDUSTRIAL', 'FT', 35],
  ['Nova', 'Predator', 'INDUSTRIAL', 'MW', 70],

  ['SG 553', 'Cyrex', 'MILSPEC', 'FT', 210],
  ['Galil AR', 'Cerberus', 'MILSPEC', 'FT', 190],
  ['MP9', 'Hot Rod', 'MILSPEC', 'FN', 320],
  ['P250', 'Asiimov', 'MILSPEC', 'WW', 340],
  ['Glock-18', 'Water Elemental', 'MILSPEC', 'MW', 480],
  ['Five-SeveN', 'Hyper Beast', 'MILSPEC', 'FT', 550],
  ['MAC-10', 'Neon Rider', 'MILSPEC', 'FT', 700],
  ['Nova', 'Hyper Beast', 'MILSPEC', 'MW', 260],

  ['FAMAS', 'Roll Cage', 'RESTRICTED', 'FN', 420],
  ['AWP', 'Worm God', 'RESTRICTED', 'FN', 620],
  ['AUG', 'Chameleon', 'RESTRICTED', 'MW', 640],
  ['Desert Eagle', 'Conspiracy', 'RESTRICTED', 'MW', 780],
  ['M4A1-S', 'Guardian', 'RESTRICTED', 'MW', 890],
  ['P90', 'Asiimov', 'RESTRICTED', 'FT', 1100],
  ['USP-S', 'Orion', 'RESTRICTED', 'FT', 1250],
  ['AK-47', 'Redline', 'RESTRICTED', 'FT', 1450],

  ['M4A4', 'Desolate Space', 'CLASSIFIED', 'FN', 2600],
  ['M4A1-S', 'Hyper Beast', 'CLASSIFIED', 'MW', 2900],
  ['USP-S', 'Kill Confirmed', 'CLASSIFIED', 'FT', 3800],
  ['AK-47', 'Vulcan', 'CLASSIFIED', 'FT', 4900],
  ['Glock-18', 'Fade', 'CLASSIFIED', 'FN', 5200],
  ['AWP', 'Asiimov', 'CLASSIFIED', 'FT', 5600],
  ['Desert Eagle', 'Blaze', 'CLASSIFIED', 'FN', 6900],

  ['AK-47', 'Asiimov', 'COVERT', 'MW', 8500],
  ['Desert Eagle', 'Printstream', 'COVERT', 'FN', 18000],
  ['AK-47', 'Case Hardened', 'COVERT', 'MW', 22000],
  ['AK-47', 'Fire Serpent', 'COVERT', 'FT', 32000],
  ['M4A1-S', 'Knight', 'COVERT', 'FN', 95000],
  ['AWP', 'Medusa', 'COVERT', 'FT', 120000],
  ['M4A4', 'Howl', 'COVERT', 'FT', 180000],
  ['AWP', 'Dragon Lore', 'COVERT', 'FT', 450000],

  ['★ Bayonet', 'Tiger Tooth', 'CONTRABAND', 'FN', 52000],
  ['★ M9 Bayonet', 'Marble Fade', 'CONTRABAND', 'FN', 78000],
  ['★ Karambit', 'Doppler', 'CONTRABAND', 'FN', 95000],
  ['★ Talon Knife', 'Crimson Web', 'CONTRABAND', 'MW', 130000],
  ['★ Butterfly Knife', 'Fade', 'CONTRABAND', 'FN', 165000],
  ['★ Sport Gloves', "Pandora's Box", 'CONTRABAND', 'FT', 240000],
]

// Официальные рендеры ящиков CS2 с CDN Steam — используются как обложки кейсов.
const CASE_ART = {
  chroma:
    'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJKz2lu_XsnXwtmkJjSU91dh8bj35VTqVBP4io_fq2wP7qr6bqI5cvHDCzfBlbcv57JqF3zrxRkj4W6Dwo34dy6QPQAoC5ZyW6dU5cxvklfG',
  clutch:
    'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJKz2lu_XsnXwtmkJjSU91dh8bj35VTqVBP4io_frHsVtqr8a_dsdKTAWDWVxLgjsrAwHSvgwEQk4m-ByYuqIC2eO1VyD5QiR_lK7EcxQQPYQA',
  prisma:
    'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJKz2lu_XsnXwtmkJjSU91dh8bj35VTqVBP4io_fr3AV6aD8O6BpdKKQVmPEwr1zs-c8Tnngl09w52zTmY2sc3jBag8jXpohE_lK7Ede7E2Kfw',
  bravo:
    'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJKz2lu_XsnXwtmkJjSU91dh8bj7-lz1QAn4kZjf9CsVuvf7OfQ5IabBVzbHlb915bcwHCjikEp_sTnTn4z6eH6RblQlC8RwFPlK7EdXSP0Ibg',
  falchion:
    'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGJKz2lu_XsnXwtmkJjSU91dh8bj35VTqVBP4io_fpWwI7Pb-P6Y5dvPEDGSSlrsh57U8HHHiwx5yt2-Dwo7_JSnCOw8oCJF0W6dU5dgrLNA1',
}

// Состав кейсов: [название предмета, вес]. Шанс = вес / сумма весов.
const CASES = [
  {
    slug: 'starter',
    image: CASE_ART.chroma,
    title: 'Стартовый кейс',
    description: 'Дешёвый вход. Мало шансов на дорогое, но и рисковать почти нечем.',
    targetRtp: 0.92,
    sortOrder: 10,
    entries: [
      ['Tec-9 | Army Mesh', 22000],
      ['P2000 | Ivory', 20000],
      ['Negev | Army Sheen', 18000],
      ['UMP-45 | Gunsmoke', 15000],
      ['MP7 | Skulls', 12000],
      ['Nova | Predator', 8000],
      ['SG 553 | Cyrex', 3200],
      ['MP9 | Hot Rod', 1400],
      ['Glock-18 | Water Elemental', 320],
      ['AK-47 | Redline', 70],
      ['AWP | Asiimov', 9],
      ['AK-47 | Fire Serpent', 1],
    ],
  },
  {
    slug: 'clutch',
    image: CASE_ART.clutch,
    title: 'Клатч кейс',
    description: 'Средний сегмент: половина дропа окупает открытие.',
    targetRtp: 0.93,
    sortOrder: 20,
    entries: [
      ['Galil AR | Cerberus', 20000],
      ['P250 | Asiimov', 17000],
      ['Nova | Hyper Beast', 14000],
      ['Five-SeveN | Hyper Beast', 11000],
      ['MAC-10 | Neon Rider', 8000],
      ['FAMAS | Roll Cage', 6000],
      ['AWP | Worm God', 4000],
      ['AUG | Chameleon', 2600],
      ['USP-S | Orion', 900],
      ['AK-47 | Redline', 600],
      ['M4A4 | Desolate Space', 160],
      ['AK-47 | Vulcan', 55],
      ['AWP | Asiimov', 20],
      ['★ Bayonet | Tiger Tooth', 3],
    ],
  },
  {
    slug: 'prime',
    image: CASE_ART.prisma,
    title: 'Кейс Прайм',
    description: 'Только скины от Restricted и выше. Каждый третий дроп — Classified.',
    targetRtp: 0.93,
    sortOrder: 30,
    entries: [
      ['M4A1-S | Guardian', 24000],
      ['Desert Eagle | Conspiracy', 20000],
      ['P90 | Asiimov', 15000],
      ['USP-S | Orion', 12000],
      ['AK-47 | Redline', 10000],
      ['M4A1-S | Hyper Beast', 5000],
      ['USP-S | Kill Confirmed', 3000],
      ['AK-47 | Vulcan', 1500],
      ['Glock-18 | Fade', 700],
      ['Desert Eagle | Blaze', 400],
      ['AK-47 | Asiimov', 220],
      ['Desert Eagle | Printstream', 70],
      ['AK-47 | Case Hardened', 30],
      ['★ M9 Bayonet | Marble Fade', 6],
      ['AWP | Medusa', 3],
    ],
  },
  {
    slug: 'dragon',
    image: CASE_ART.bravo,
    title: 'Драконий кейс',
    description: 'Высокий риск. Внутри — Dragon Lore и Howl.',
    targetRtp: 0.9,
    sortOrder: 40,
    entries: [
      ['AK-47 | Vulcan', 26000],
      ['AWP | Asiimov', 20000],
      ['Desert Eagle | Blaze', 14000],
      ['Glock-18 | Fade', 12000],
      ['AK-47 | Asiimov', 9000],
      ['Desert Eagle | Printstream', 4000],
      ['AK-47 | Case Hardened', 2200],
      ['AK-47 | Fire Serpent', 1200],
      ['★ Bayonet | Tiger Tooth', 600],
      ['M4A1-S | Knight', 300],
      ['AWP | Medusa', 160],
      ['★ Karambit | Doppler', 90],
      ['M4A4 | Howl', 40],
      ['AWP | Dragon Lore', 8],
    ],
  },
  {
    slug: 'knife',
    image: CASE_ART.falchion,
    title: 'Ножевой кейс',
    description: 'Только ножи и перчатки. Худший дроп всё ещё стоит пятьсот долларов.',
    targetRtp: 0.91,
    sortOrder: 50,
    entries: [
      ['★ Bayonet | Tiger Tooth', 34000],
      ['★ M9 Bayonet | Marble Fade', 26000],
      ['★ Karambit | Doppler', 20000],
      ['★ Talon Knife | Crimson Web', 12000],
      ['★ Butterfly Knife | Fade', 6000],
      ['★ Sport Gloves | Pandora\'s Box', 2000],
    ],
  },
]

/**
 * Наполняет базу демо-данными. Идемпотентна: предметы и кейсы обновляются
 * по имени/slug, поэтому повторный запуск не плодит дубликаты.
 */
export async function seedDatabase(prisma) {
  console.log('Сидирование базы...')

  // --- предметы ---
  const itemsByName = new Map()
  const scale = Number.isFinite(config.seedPriceMultiplier) ? config.seedPriceMultiplier : 1

  for (const [weapon, skin, rarity, wear, basePrice] of ITEMS) {
    const name = `${weapon} | ${skin}`
    const price = Math.max(1, Math.round(basePrice * scale))
    const existing = await prisma.item.findFirst({ where: { name } })
    const item = existing
      ? await prisma.item.update({
          where: { id: existing.id },
          data: { weapon, skin, rarity, wear, price },
        })
      : await prisma.item.create({ data: { name, weapon, skin, rarity, wear, price } })
    itemsByName.set(name, item)
  }
  console.log(`  предметов: ${itemsByName.size}`)

  // --- кейсы ---
  for (const def of CASES) {
    const entries = def.entries.map(([name, weight]) => {
      const item = itemsByName.get(name)
      if (!item) throw new Error(`Предмет не найден: ${name}`)
      return { item, weight }
    })

    const totalWeight = entries.reduce((s, e) => s + e.weight, 0)
    const ev = entries.reduce((s, e) => s + (e.weight / totalWeight) * e.item.price, 0)
    // Цену кейса выводим из ожидаемой отдачи, чтобы маржа была предсказуемой.
    const price = Math.max(50, Math.round(ev / def.targetRtp / 10) * 10)

    const caseRow = await prisma.case.upsert({
      where: { slug: def.slug },
      update: {
        title: def.title,
        description: def.description,
        image: def.image ?? null,
        price,
        sortOrder: def.sortOrder,
        active: true,
      },
      create: {
        slug: def.slug,
        title: def.title,
        description: def.description,
        image: def.image ?? null,
        price,
        sortOrder: def.sortOrder,
      },
    })

    await prisma.caseItem.deleteMany({ where: { caseId: caseRow.id } })
    await prisma.caseItem.createMany({
      data: entries.map((e) => ({ caseId: caseRow.id, itemId: e.item.id, weight: e.weight })),
    })

    console.log(
      `  ${def.slug.padEnd(8)} цена ${(price / 100).toFixed(2).padStart(9)}  ` +
        `EV ${(ev / 100).toFixed(2).padStart(9)} ${config.currency}  ` +
        `RTP ${((ev / price) * 100).toFixed(1)}%  предметов ${entries.length}`,
    )
  }

  // --- администратор ---
  const { email, username, password } = config.seedAdmin
  const serverSeed = generateServerSeed()
  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN' },
    create: {
      email,
      username,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'ADMIN',
      balance: 1000000,
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
      clientSeed: generateClientSeed(),
    },
  })
  console.log(`  админ: ${admin.email} / ${password}`)

  // --- демо-игрок ---
  const demoSeed = generateServerSeed()
  await prisma.user.upsert({
    where: { email: 'player@cs2cases.local' },
    update: {},
    create: {
      email: 'player@cs2cases.local',
      username: 'player',
      passwordHash: await bcrypt.hash('player12345', 12),
      balance: 50000,
      serverSeed: demoSeed,
      serverSeedHash: hashServerSeed(demoSeed),
      clientSeed: generateClientSeed(),
    },
  })
  console.log('  игрок: player@cs2cases.local / player12345')

  console.log('Готово.')
}

// Запуск напрямую: node prisma/seed.js
const isCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isCli) {
  const prisma = new PrismaClient()
  seedDatabase(prisma)
    .catch((e) => {
      console.error(e)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
