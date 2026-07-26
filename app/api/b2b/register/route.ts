import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { isKathmanduValleyLocation, SERVICE_AREA_UNAVAILABLE_MESSAGE } from '@/lib/service-area'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const shopName = String(body.shopName || '').trim()
    const name = String(body.name || body.contactName || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const phone = String(body.phone || '').trim()
    const password = String(body.password || '')

    const street = String(body.street || '').trim()
    const apartment = String(body.apartment || '').trim() || null
    const landmark = String(body.landmark || '').trim() || null
    const city = String(body.city || '').trim()
    const state = String(body.state || '').trim()
    const pincode = String(body.pincode || '').trim()
    const latitude = Number(body.latitude)
    const longitude = Number(body.longitude)

    if (!shopName || !name || !email || !phone || !password) {
      return NextResponse.json(
        { error: 'Shop name, your name, phone, email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    if (!street || !city || !state || !pincode || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { error: 'Complete shop location details are required (use the map)' },
        { status: 400 }
      )
    }

    if (
      !isKathmanduValleyLocation({
        city,
        state,
        address: street,
        latitude,
        longitude,
      })
    ) {
      return NextResponse.json({ error: SERVICE_AREA_UNAVAILABLE_MESSAGE }, { status: 400 })
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } })
    if (existingEmail) {
      const hasBiz = await prisma.businessProfile.findUnique({ where: { userId: existingEmail.id } })
      if (hasBiz) {
        return NextResponse.json(
          { error: 'A business account already exists for this email. Please log in.' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'This email is already registered. Log in or use a different email for business.' },
        { status: 400 }
      )
    }

    const existingPhone = await prisma.user.findUnique({ where: { phone } })
    if (existingPhone) {
      return NextResponse.json({ error: 'Phone number already registered' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone,
          role: 'CUSTOMER',
        },
        select: { id: true, email: true, name: true, phone: true, role: true },
      })

      const business = await tx.businessProfile.create({
        data: {
          userId: user.id,
          shopName,
        },
      })

      const address = await tx.address.create({
        data: {
          userId: user.id,
          label: 'Shop',
          street,
          apartment,
          landmark,
          city,
          state,
          pincode,
          latitude,
          longitude,
          isDefault: true,
        },
      })

      return { user, business, address }
    })

    const token = await signToken({
      userId: result.user.id,
      email: result.user.email,
      b2b: true,
    })

    return NextResponse.json(
      {
        token,
        user: result.user,
        shopName: result.business.shopName,
        address: {
          id: result.address.id,
          label: result.address.label,
          street: result.address.street,
          apartment: result.address.apartment,
          landmark: result.address.landmark,
          city: result.address.city,
          state: result.address.state,
          pincode: result.address.pincode,
          latitude: result.address.latitude,
          longitude: result.address.longitude,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('B2B register error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to register business' },
      { status: 500 }
    )
  }
}
