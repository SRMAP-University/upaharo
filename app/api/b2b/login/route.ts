import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        businessProfile: true,
        addresses: {
          where: { isDefault: true },
          take: 1,
          orderBy: { updatedAt: 'desc' },
        },
      },
    })

    if (!user?.password || !user.businessProfile) {
      return NextResponse.json(
        { error: 'No business account found for this email. Please register.' },
        { status: 401 }
      )
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const address =
      user.addresses[0] ??
      (await prisma.address.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
      }))

    const token = await signToken({
      userId: user.id,
      email: user.email,
      b2b: true,
    })

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
      },
      shopName: user.businessProfile.shopName,
      address: address
        ? {
            id: address.id,
            label: address.label,
            street: address.street,
            apartment: address.apartment,
            landmark: address.landmark,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            latitude: address.latitude,
            longitude: address.longitude,
          }
        : null,
    })
  } catch (error: any) {
    console.error('B2B login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
