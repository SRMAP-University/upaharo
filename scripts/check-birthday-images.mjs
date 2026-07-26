import { PrismaClient } from '@prisma/client'
import fs from 'fs'

// Load .env.local DATABASE_URL if present
try {
  const env = fs.readFileSync('.env.local', 'utf8')
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^DATABASE_URL=(.*)$/)
    if (m) {
      let v = m[1].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      process.env.DATABASE_URL = v
    }
  }
} catch {}

const p = new PrismaClient()
const rows = await p.product.findMany({
  where: {
    OR: [
      { tags: { has: 'Birthday' } },
      { tags: { has: 'birthday' } },
      { category: { contains: 'Birthday', mode: 'insensitive' } },
    ],
  },
  select: { id: true, name: true, image: true, tags: true },
  take: 50,
})

const byImage = new Map()
for (const r of rows) {
  const k = r.image || '(empty)'
  byImage.set(k, (byImage.get(k) || 0) + 1)
}

console.log('birthday_like_count', rows.length)
console.log('unique_images', byImage.size)
console.log('--- top image frequencies ---')
;[...byImage.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([img, n]) => console.log(n, String(img).slice(0, 140)))

console.log('--- sample ---')
rows.slice(0, 12).forEach((r) => {
  console.log(`${r.name.slice(0, 45)} | ${String(r.image || '').slice(0, 100)}`)
})

await p.$disconnect()
