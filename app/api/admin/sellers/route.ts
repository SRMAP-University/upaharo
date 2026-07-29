import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { sendEmail, emailTemplates } from '@/lib/email'
import { requireAdmin } from '@/lib/request-auth'

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sellers = await prisma.seller.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(sellers)
  } catch (error) {
    console.error('Error fetching sellers:', error)
    return NextResponse.json({ error: 'Failed to fetch sellers' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      email,
      phone,
      password,
      businessName,
      businessAddress,
      gstin,
      commission,
      bankAccountName,
      bankAccountNo,
      ifscCode,
      panNumber,
    } = body

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email or phone already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user and seller in a transaction
    const seller = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          phone,
          password: hashedPassword,
          role: 'SELLER',
        },
      })

      return tx.seller.create({
        data: {
          userId: user.id,
          businessName,
          businessAddress,
          gstin: gstin || undefined,
          phone,
          email,
          commission: commission || 15,
          bankAccountName: bankAccountName || undefined,
          bankAccountNo: bankAccountNo || undefined,
          ifscCode: ifscCode || undefined,
          panNumber: panNumber || undefined,
          isActive: true,
          isVerified: false,
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      })
    });

    // Send email notifications (non-blocking)
    void (async () => {
      try {
        // Send welcome email to seller with credentials
        await sendEmail({
          to: email,
          subject: 'Welcome to AGS Seller Platform',
          html: emailTemplates.sellerAccountCreated({
            sellerName: name,
            businessName,
            email,
            password, // Send original password (only this one time)
          }),
        })

        // Notify admin about new seller
        const adminUsers = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { email: true },
        })

        for (const admin of adminUsers) {
          if (admin.email) {
            await sendEmail({
              to: admin.email,
              subject: 'New Seller Account Created',
              html: emailTemplates.adminNewSeller({
                businessName,
                sellerName: name,
                email,
              }),
            })
          }
        }
      } catch (emailError) {
        console.error('Email notification error (non-critical):', emailError)
      }
    })()

    return NextResponse.json(seller, { status: 201 })
  } catch (error) {
    console.error('Error creating seller:', error)
    return NextResponse.json({ error: 'Failed to create seller' }, { status: 500 })
  }
}
