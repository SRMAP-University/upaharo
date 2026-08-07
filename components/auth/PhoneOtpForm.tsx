'use client'

import { FormEvent, useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { getGoogleOAuthConfigError } from '@/lib/google-auth'

type Mode = 'phone' | 'email'
type PhoneStep = 'enterPhone' | 'enterOtp' | 'completeSignup'

const ACCENT = '#E85A8C'

async function establishSession(otpAccessToken: string) {
  const result = await signIn('credentials', {
    otpAccessToken,
    redirect: false,
  })
  if (result?.error) {
    throw new Error(result.error)
  }
  if (!result?.ok) {
    throw new Error('Could not start session')
  }
}

export default function PhoneOtpForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('phone')
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('enterPhone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupToken, setSignupToken] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendSeconds, setResendSeconds] = useState(0)

  useEffect(() => {
    if (resendSeconds <= 0) return
    const t = window.setTimeout(() => setResendSeconds((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [resendSeconds])

  const phoneDigits = phone.replace(/\D/g, '').slice(0, 10)
  const phoneLooksValid = phoneDigits.length === 10

  const afterAuth = async () => {
    const sessionRes = await fetch('/api/auth/session')
    const session = await sessionRes.json()
    if (session?.user?.role === 'ADMIN') {
      router.push('/admin')
    } else {
      router.push('/')
    }
    router.refresh()
  }

  const sendOtp = async (resend = false) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDigits }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP')
      setPhoneStep('enterOtp')
      setOtp('')
      setResendSeconds(Number(data.resendIn) || 30)
      if (resend) {
        /* keep step */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDigits, code: otp.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid OTP')

      if (data.needsSignup) {
        setSignupToken(String(data.signupToken || ''))
        setPhoneStep('completeSignup')
        return
      }

      if (!data.token) throw new Error('Login token missing')
      await establishSession(data.token)
      await afterAuth()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const completeSignup = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/otp/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signupToken,
          name: name.trim(),
          email: signupEmail.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Signup failed')
      if (!data.token) throw new Error('Login token missing')
      await establishSession(data.token)
      await afterAuth()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const loginEmail = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      })
      if (result?.error) throw new Error(result.error)
      if (!result?.ok) throw new Error('Sign in failed')
      await afterAuth()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'email') {
      await loginEmail()
      return
    }
    if (phoneStep === 'enterPhone') await sendOtp()
    else if (phoneStep === 'enterOtp') await verifyOtp()
    else await completeSignup()
  }

  const primaryLabel =
    mode === 'email'
      ? 'Sign in'
      : phoneStep === 'enterPhone'
        ? 'Continue'
        : phoneStep === 'enterOtp'
          ? 'Verify & continue'
          : 'Create account'

  const primaryDisabled =
    loading ||
    (mode === 'phone' && phoneStep === 'enterPhone' && !phoneLooksValid) ||
    (mode === 'phone' && phoneStep === 'enterOtp' && otp.trim().length < 6) ||
    (mode === 'phone' &&
      phoneStep === 'completeSignup' &&
      (!name.trim() || !signupEmail.trim()))

  const handleGoogle = async () => {
    try {
      setGoogleLoading(true)
      setError('')
      const configError = getGoogleOAuthConfigError(window.location.origin)
      if (configError) {
        setError(configError)
        return
      }
      await signIn('google', { callbackUrl: '/' })
    } catch {
      setError('Failed to sign in with Google')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="text-center">
        <p className="text-[22px] font-extrabold leading-tight text-[#1F1F1F]">
          Gifts for every occasion
        </p>
        <p className="mt-1.5 text-sm font-medium text-[#3E3E3E]/65">
          {phoneStep === 'completeSignup'
            ? 'Finish creating your account'
            : phoneStep === 'enterOtp' && mode === 'phone'
              ? 'Enter the OTP we sent'
              : 'Log in or Sign up'}
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {mode === 'phone' && phoneStep === 'enterPhone' ? (
        <div className="flex gap-2.5">
          <div className="flex h-[54px] w-16 items-center justify-center rounded-[14px] border border-[#E0E0E0] bg-white text-xl">
            🇳🇵
          </div>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phoneDigits}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            disabled={loading}
            placeholder="Enter mobile number"
            className="h-[54px] flex-1 rounded-[14px] border border-[#E0E0E0] px-4 text-[15px] font-semibold text-[#1F1F1F] outline-none placeholder:font-medium placeholder:text-[#3E3E3E]/40 focus:border-[#E85A8C]/50"
          />
        </div>
      ) : null}

      {mode === 'phone' && phoneStep === 'enterOtp' ? (
        <>
          <p className="text-[13px] font-medium text-[#3E3E3E]/65">
            Code sent to {phoneDigits}
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={loading}
            placeholder="6-digit OTP"
            className="h-[54px] w-full rounded-[14px] border border-[#E0E0E0] px-4 text-[15px] font-semibold outline-none focus:border-[#E85A8C]/50"
          />
        </>
      ) : null}

      {mode === 'phone' && phoneStep === 'completeSignup' ? (
        <>
          <p className="text-[13px] font-medium text-[#3E3E3E]/65">
            Phone {phoneDigits} verified
          </p>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            placeholder="Full name"
            className="h-[54px] w-full rounded-[14px] border border-[#E0E0E0] px-4 text-[15px] font-semibold outline-none focus:border-[#E85A8C]/50"
          />
          <input
            type="email"
            autoComplete="email"
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
            disabled={loading}
            placeholder="Email"
            className="h-[54px] w-full rounded-[14px] border border-[#E0E0E0] px-4 text-[15px] font-semibold outline-none focus:border-[#E85A8C]/50"
          />
        </>
      ) : null}

      {mode === 'email' ? (
        <>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="Email"
            required
            className="h-[54px] w-full rounded-[14px] border border-[#E0E0E0] px-4 text-[15px] font-semibold outline-none focus:border-[#E85A8C]/50"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="Password"
            required
            className="h-[54px] w-full rounded-[14px] border border-[#E0E0E0] px-4 text-[15px] font-semibold outline-none focus:border-[#E85A8C]/50"
          />
        </>
      ) : null}

      <button
        type="submit"
        disabled={primaryDisabled}
        className="flex h-[52px] w-full items-center justify-center rounded-[14px] text-base font-bold text-white transition disabled:cursor-not-allowed disabled:bg-[#BDBDBD]"
        style={{ backgroundColor: primaryDisabled ? undefined : ACCENT }}
      >
        {loading ? 'Please wait…' : primaryLabel}
      </button>

      {mode === 'phone' && phoneStep === 'enterOtp' ? (
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            disabled={loading || resendSeconds > 0}
            onClick={() => sendOtp(true)}
            className="text-sm font-semibold disabled:opacity-50"
            style={{ color: ACCENT }}
          >
            {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend code'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setPhoneStep('enterPhone')
              setOtp('')
              setError('')
            }}
            className="text-sm font-semibold text-[#3E3E3E]/55"
          >
            Change phone number
          </button>
        </div>
      ) : null}

      {phoneStep !== 'completeSignup' ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setMode(mode === 'phone' ? 'email' : 'phone')
            setError('')
            setPhoneStep('enterPhone')
          }}
          className="mx-auto block text-[13px] font-semibold text-[#3E3E3E]/55"
        >
          {mode === 'phone' ? 'Use email instead' : 'Use phone OTP instead'}
        </button>
      ) : null}

      {phoneStep === 'enterPhone' || mode === 'email' ? (
        <>
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/10" />
            </div>
            <div className="relative flex justify-center text-xs font-semibold text-[#3E3E3E]/45">
              <span className="bg-white px-2">or</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading || googleLoading}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border font-bold transition disabled:opacity-50"
            style={{ borderColor: `${ACCENT}73`, color: ACCENT }}
          >
            {googleLoading ? 'Signing in…' : 'Continue with Google'}
          </button>
        </>
      ) : null}

      <p className="pt-1 text-center text-[11px] leading-snug text-[#3E3E3E]/45">
        By continuing, you agree to our{' '}
        <span className="font-semibold underline">Terms of service</span> &{' '}
        <span className="font-semibold underline">Privacy policy</span>
      </p>
    </form>
  )
}
