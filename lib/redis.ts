type RedisClient = {
  publish: (channel: string, message: string) => Promise<number>
  get: (key: string) => Promise<string | null>
  setex: (key: string, seconds: number, value: string) => Promise<unknown>
  del: (...keys: string[]) => Promise<number>
  on: (event: 'error', listener: (error: Error) => void) => void
}

const globalForRedis = globalThis as unknown as {
  redisPromise: Promise<RedisClient | null> | undefined
}

async function createRedisClient(): Promise<RedisClient | null> {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    return null
  }

  const { default: Redis } = await import('ioredis')
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('Redis connection failed after 3 retries')
        return null
      }

      return Math.min(times * 100, 3000)
    },
    lazyConnect: true,
  }) as RedisClient

  client.on('error', (error) => {
    console.warn('Redis connection error:', error.message)
  })

  return client
}

function getRedisClient() {
  if (!globalForRedis.redisPromise) {
    globalForRedis.redisPromise = createRedisClient().catch((error) => {
      console.warn('Redis client setup failed:', error)
      return null
    })
  }

  return globalForRedis.redisPromise
}

export const redis = {
  async get(key: string) {
    try {
      const client = await getRedisClient()

      if (!client) {
        return null
      }

      return await client.get(key)
    } catch (error) {
      console.warn('Redis get failed:', error)
      return null
    }
  },
  async setex(key: string, seconds: number, value: string) {
    try {
      const client = await getRedisClient()

      if (!client) {
        return null
      }

      return await client.setex(key, seconds, value)
    } catch (error) {
      console.warn('Redis setex failed:', error)
      return null
    }
  },
  async del(...keys: string[]) {
    try {
      const client = await getRedisClient()

      if (!client || keys.length === 0) {
        return 0
      }

      return await client.del(...keys)
    } catch (error) {
      console.warn('Redis del failed:', error)
      return 0
    }
  },
  async publish(channel: string, message: string) {
    try {
      const client = await getRedisClient()

      if (!client) {
        return 0
      }

      return await client.publish(channel, message)
    } catch (error) {
      console.warn('Redis publish failed:', error)
      return 0
    }
  },
}

export async function getOrSetJson<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const cached = await redis.get(key)
  if (cached) {
    try {
      return JSON.parse(cached) as T
    } catch {
      // fall through and refresh invalid cache value
    }
  }

  const value = await loader()
  await redis.setex(key, ttlSeconds, JSON.stringify(value))
  return value
}

export const REDIS_KEYS = {
  CART: (userId: string) => `cart:${userId}`,
  ORDER_STATUS: (orderId: string) => `order:${orderId}:status`,
  DELIVERY_LOCATION: (partnerId: string) => `delivery:${partnerId}:location`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
  RATE_LIMIT: (ip: string) => `ratelimit:${ip}`,
  APP_SETTINGS: 'cache:app-settings:public',
  CATEGORIES: (type: string) => `cache:categories:${type}`,
  PRODUCT_LIST: (query: string) => `cache:products:${query}`,
  PRODUCT_DETAIL: (id: string) => `cache:product:${id}`,
  PRODUCT_RECOMMENDATIONS: (productId: string, viewedKey: string) => `cache:product-recommendations:${productId}:${viewedKey}`,
  CART_RECOMMENDATIONS: (productKey: string, viewedKey: string) => `cache:cart-recommendations:${productKey}:${viewedKey}`,
  HOME_RECOMMENDATIONS: (viewedKey: string) => `cache:home-recommendations:${viewedKey}`,
  HOME: 'cache:home:v1',
  HOME_BANNERS: 'cache:home:banners',
  HOME_MINI_BANNERS: 'cache:home:mini-banners',
}

export const REDIS_CHANNELS = {
  ORDER_UPDATES: 'order:updates',
  DELIVERY_LOCATION: 'delivery:location'
}
