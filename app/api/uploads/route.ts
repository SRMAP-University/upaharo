import { randomUUID } from 'crypto'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

const DEFAULT_R2_BUCKET_URL =
  'https://f943d5f656be301e2c766ac590d8910b.r2.cloudflarestorage.com/chapter'

function sanitizeFolderName(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  return cleaned || 'products'
}

function extensionForMime(mime: string): string {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/gif') return '.gif'
  return '.jpg'
}

function mimeFromFilename(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return ''
}

function resolveImageMime(file: File): string {
  const typed = (file.type || '').toLowerCase().trim()
  if (ALLOWED_IMAGE_TYPES.has(typed)) return typed === 'image/jpg' ? 'image/jpeg' : typed
  return mimeFromFilename(file.name)
}

type R2Config = {
  endpoint: string
  bucket: string
  publicBaseUrl?: string
  accessKeyId: string
  secretAccessKey: string
}

let r2Client: S3Client | null = null

function parseBucketUrl(urlValue: string): { endpoint: string; bucket: string } | null {
  try {
    const parsed = new URL(urlValue)
    const bucket = parsed.pathname.split('/').filter(Boolean)[0]
    if (!bucket) return null
    return {
      endpoint: parsed.origin,
      bucket,
    }
  } catch {
    return null
  }
}

function resolveR2Config(): R2Config | null {
  const configuredBucketUrl = process.env.R2_BUCKET_URL || DEFAULT_R2_BUCKET_URL
  const parsedFromUrl = parseBucketUrl(configuredBucketUrl)

  const endpoint =
    process.env.R2_ENDPOINT ||
    process.env.CLOUDFLARE_R2_ENDPOINT ||
    parsedFromUrl?.endpoint ||
    ''
  const bucket = process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET || parsedFromUrl?.bucket || ''
  const publicBaseUrl =
    process.env.R2_PUBLIC_BASE_URL || process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || ''
  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || ''
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || ''

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null
  }

  return {
    endpoint,
    bucket,
    ...(publicBaseUrl ? { publicBaseUrl } : {}),
    accessKeyId,
    secretAccessKey,
  }
}

function getR2Client(config: R2Config): S3Client {
  if (r2Client) return r2Client

  r2Client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  return r2Client
}

function sanitizeObjectKey(value: string): string | null {
  const key = value.trim().replace(/^\/+/, '').replace(/\\/g, '/')
  if (!key || key.includes('..')) return null
  return key
}

function getObjectUrl(key: string, config: R2Config): string {
  if (config.publicBaseUrl) {
    try {
      const parsed = new URL(config.publicBaseUrl)
      // r2.cloudflarestorage.com is the S3 API endpoint, not a public asset domain.
      if (!parsed.hostname.endsWith('.r2.cloudflarestorage.com')) {
        const base = config.publicBaseUrl.replace(/\/+$/, '')
        return `${base}/${key}`
      }
    } catch {
      // Fall back to proxy URL
    }
  }

  return `/api/uploads?key=${encodeURIComponent(key)}`
}

export async function GET(request: Request) {
  try {
    const config = resolveR2Config()
    if (!config) {
      return NextResponse.json(
        {
          error:
            'R2 config missing. Set R2_BUCKET_URL, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.',
        },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const keyParam = String(searchParams.get('key') || '')
    const key = sanitizeObjectKey(keyParam)
    if (!key) {
      return NextResponse.json({ error: 'Valid key query parameter is required' }, { status: 400 })
    }

    const client = getR2Client(config)
    const object = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    )

    if (!object.Body) {
      return NextResponse.json({ error: 'Object not found' }, { status: 404 })
    }

    const stream =
      typeof object.Body.transformToWebStream === 'function'
        ? object.Body.transformToWebStream()
        : null

    if (!stream) {
      return NextResponse.json({ error: 'Failed to stream object' }, { status: 500 })
    }

    return new Response(stream as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': object.ContentType || 'application/octet-stream',
        // Browser can cache per full URL (includes ?key=).
        'Cache-Control': object.CacheControl || 'public, max-age=31536000, immutable',
        Vary: 'Accept',
        ...(object.ETag ? { ETag: object.ETag } : {}),
      },
    })
  } catch (error: any) {
    const code = String(error?.name || '')
    if (code === 'NoSuchKey' || code === 'NotFound') {
      return NextResponse.json({ error: 'Object not found' }, { status: 404 })
    }
    console.error('R2 object fetch failed:', error)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const role = session?.user?.role

    if (!session || (role !== 'ADMIN' && role !== 'SELLER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const folderName = sanitizeFolderName(String(formData.get('folder') || 'products'))

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }

    const contentType = resolveImageMime(file)
    if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, WEBP and GIF images are allowed' },
        { status: 400 }
      )
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Image size must be 5MB or smaller' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const extension = extensionForMime(contentType)
    const filename = `${Date.now()}-${randomUUID()}${extension}`
    const key = `uploads/${folderName}/${filename}`

    const r2Config = resolveR2Config()
    if (!r2Config) {
      return NextResponse.json(
        {
          error:
            'R2 config missing. Set R2_BUCKET_URL, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.',
        },
        { status: 500 }
      )
    }

    const client = getR2Client(r2Config)

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: r2Config.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        })
      )
    } catch (putError: any) {
      console.error('R2 PutObject failed:', {
        name: putError?.name,
        message: putError?.message,
        bucket: r2Config.bucket,
        key,
      })
      return NextResponse.json(
        {
          error:
            putError?.name === 'AccessDenied' || putError?.$metadata?.httpStatusCode === 403
              ? 'R2 access denied — check bucket credentials and permissions.'
              : 'Failed to upload image to storage.',
        },
        { status: 500 }
      )
    }

    const normalizedKey = key.replace(/\\/g, '/')
    const url = getObjectUrl(normalizedKey, r2Config)

    return NextResponse.json({ url, filename, size: file.size, type: contentType })
  } catch (error) {
    console.error('Image upload failed:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
