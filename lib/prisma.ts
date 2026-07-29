import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Supabase: the direct host (db.*.supabase.co) is IPv6-only and fails on EC2 and
 * many serverless runtimes. Prefer the pooler session URL (5432) in production.
 */
function poolerSessionUrl(): string | undefined {
  const pooled = process.env.DATABASE_URL?.trim()
  if (!pooled?.includes('pooler.supabase.com')) return undefined
  return pooled
    .replace(':6543/', ':5432/')
    .replace(/([?&])pgbouncer=true&?/, '$1')
    .replace(/[?&]$/, '')
}

function databaseUrl(): string | undefined {
  const direct = process.env.DIRECT_URL?.trim()
  const pooled = process.env.DATABASE_URL?.trim()

  if (process.env.NODE_ENV === 'production') {
    const directIsIpv6Host =
      !!direct &&
      direct.includes('.supabase.co') &&
      !direct.includes('pooler.supabase.com')

    if (directIsIpv6Host) {
      return (
        (direct.includes('pooler.supabase.com') ? direct : undefined) ||
        poolerSessionUrl() ||
        pooled ||
        direct
      )
    }
    if (direct) {
      return direct
    }
  }

  return pooled
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
