import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { authOptions } from '@/lib/auth-options'
import { isKathmanduValleyLocation, SERVICE_AREA_UNAVAILABLE_MESSAGE } from '@/lib/service-area'

async function resolveUserId(request: NextRequest) {
  const token = getTokenFromRequest(request)

  if (token) {
    const payload = await verifyToken(token)
    if (payload?.userId) {
      return String(payload.userId)
    }
  }

  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    return String(session.user.id)
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Verify user exists in database
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })
    
    if (!userExists) {
      console.error('User not found:', userId)
      return NextResponse.json({ error: 'User not found. Please log out and log in again.' }, { status: 401 })
    }

    const body = await request.json()
    const { label, street, apartment, landmark, city, state, pincode, latitude, longitude, isDefault } = body

    // Validate required fields
    if (!label || !street || !city || !state || !pincode) {
      return NextResponse.json(
        { error: 'Missing required fields: label, street, city, state, pincode' },
        { status: 400 }
      )
    }

    // Ensure latitude and longitude are valid numbers
    const lat = typeof latitude === 'number' ? latitude : parseFloat(latitude) || 0
    const lng = typeof longitude === 'number' ? longitude : parseFloat(longitude) || 0

    if (
      !isKathmanduValleyLocation({
        city,
        state,
        address: [street, landmark, apartment].filter(Boolean).join(', '),
        latitude: lat,
        longitude: lng,
      })
    ) {
      return NextResponse.json({ error: SERVICE_AREA_UNAVAILABLE_MESSAGE }, { status: 400 })
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      })
    }

    // Create address
    const address = await prisma.address.create({
      data: {
        userId,
        label,
        street,
        apartment: apartment || '',
        landmark: landmark || '',
        city,
        state,
        pincode,
        latitude: lat,
        longitude: lng,
        isDefault: isDefault || false,
      },
    })

    return NextResponse.json({ address }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating address:', error)
    console.error('Error details:', error?.message, error?.code)
    return NextResponse.json(
      { error: 'Failed to create address', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user addresses
    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: { isDefault: 'desc' },
    })

    return NextResponse.json({ addresses })
  } catch (error) {
    console.error('Error fetching addresses:', error)
    return NextResponse.json(
      { error: 'Failed to fetch addresses' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, label, street, apartment, landmark, city, state, pincode, latitude, longitude, isDefault } = body

    if (!id || !label || !street || !city || !state || !pincode) {
      return NextResponse.json(
        { error: 'Missing required fields: id, label, street, city, state, pincode' },
        { status: 400 }
      )
    }

    const existing = await prisma.address.findFirst({
      where: { id: String(id), userId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 })
    }

    const lat = typeof latitude === 'number' ? latitude : parseFloat(latitude) || 0
    const lng = typeof longitude === 'number' ? longitude : parseFloat(longitude) || 0

    if (
      !isKathmanduValleyLocation({
        city,
        state,
        address: [street, landmark, apartment].filter(Boolean).join(', '),
        latitude: lat,
        longitude: lng,
      })
    ) {
      return NextResponse.json({ error: SERVICE_AREA_UNAVAILABLE_MESSAGE }, { status: 400 })
    }

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      })
    }

    const address = await prisma.address.update({
      where: { id: existing.id },
      data: {
        label,
        street,
        apartment: apartment || '',
        landmark: landmark || '',
        city,
        state,
        pincode,
        latitude: lat,
        longitude: lng,
        isDefault: typeof isDefault === 'boolean' ? isDefault : existing.isDefault,
      },
    })

    return NextResponse.json({ address })
  } catch (error: any) {
    console.error('Error updating address:', error)
    return NextResponse.json(
      { error: 'Failed to update address', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
