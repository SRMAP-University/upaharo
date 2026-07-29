import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Netlify + Supabase: the transaction pooler often breaks Prisma reads.
 * Prefer DIRECT_URL in production when set (direct Supabase host, port 5432).
 */
function databaseUrl(): string | undefined {
  if (process.env.NODE_ENV === 'production' && process.env.DIRECT_URL) {
    return process.env.DIRECT_URL
  }
  return process.env.DATABASE_URL
}

function createPrismaClient() {
  const url = databaseUrl()
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ...(url
      ? {
          datasources: {
            db: { url },
          },
        }
      : {}),
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma
}
