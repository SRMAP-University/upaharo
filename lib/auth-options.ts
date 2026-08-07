import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { signToken, verifyToken } from '@/lib/auth'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        /** JWT from /api/otp/verify or /api/otp/complete-signup */
        otpAccessToken: { label: 'OTP access token', type: 'text' },
      },
      async authorize(credentials) {
        const otpAccessToken = String(credentials?.otpAccessToken || '').trim()
        if (otpAccessToken) {
          const payload = await verifyToken(otpAccessToken)
          const userId =
            typeof payload?.userId === 'string' ? payload.userId : null
          // Reject signup-only tokens — only full login tokens have userId.
          if (!payload || !userId || payload.purpose === 'otp_signup') {
            throw new Error('OTP session expired. Please verify again.')
          }

          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              image: true,
            },
          })
          if (!user) {
            throw new Error('Account not found')
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.image,
          }
        }

        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) {
          throw new Error('Invalid credentials')
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isValidPassword) {
          throw new Error('Invalid credentials')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        
        // Generate custom JWT for API authentication
        const customToken = await signToken({
          userId: user.id,
          email: user.email,
          role: (user as any).role
        })
        token.customToken = customToken
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string
        (session.user as any).role = token.role as string
        (session.user as any).token = token.customToken as string
      }
      return session
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          // Check if user exists with this email
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { accounts: true }
          })

          if (existingUser) {
            // Check if this Google account is already linked
            const googleAccount = existingUser.accounts.find(
              acc => acc.provider === 'google' && acc.providerAccountId === account.providerAccountId
            )

            if (!googleAccount) {
              // Link the Google account to existing user
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                }
              })
            }

            // Update user info from Google if needed
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                name: user.name || existingUser.name,
                image: user.image || existingUser.image,
                emailVerified: new Date(),
              }
            })

            // Update the user object with existing user data
            user.id = existingUser.id
            ;(user as any).role = existingUser.role
          } else {
            // Create new user for Google OAuth
            const newUser = await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name || 'User',
                image: user.image,
                emailVerified: new Date(),
                role: 'CUSTOMER',
                accounts: {
                  create: {
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    access_token: account.access_token,
                    expires_at: account.expires_at,
                    token_type: account.token_type,
                    scope: account.scope,
                    id_token: account.id_token,
                  }
                }
              }
            })
            
            user.id = newUser.id
            ;(user as any).role = newUser.role
          }
        } catch (error) {
          console.error('Error in Google sign-in:', error)
          return false
        }
      }
      return true
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
}
