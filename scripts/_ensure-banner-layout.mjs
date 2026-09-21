import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Banner" ADD COLUMN IF NOT EXISTS "layout" TEXT NOT NULL DEFAULT 'cover'`
  )
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "homepageBannerWidth" INTEGER NOT NULL DEFAULT 88`
  )
  console.log('Banner.layout and homepageBannerWidth columns ready')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
