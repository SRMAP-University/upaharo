'use client'

import { useEffect, useRef, useState } from 'react'
import { appBridge, isInApp } from '@/lib/app-bridge'

/**
 * Web feature shown inside the app (sheet or inline block via the admin
 * "App Features" page). Three taps → an AI search for the right gift.
 */

type Option = { label: string; emoji: string; value: string }

const STEPS: Array<{ id: 'who' | 'occasion' | 'budget'; question: string; options: Option[] }> = [
  {
    id: 'who',
    question: 'Who’s the lucky one?',
    options: [
      { label: 'Mom', emoji: '👩', value: 'mom' },
      { label: 'Partner', emoji: '💕', value: 'partner' },
      { label: 'Friend', emoji: '🤝', value: 'friend' },
      { label: 'Sibling', emoji: '👫', value: 'brother or sister' },
      { label: 'Dad', emoji: '👨', value: 'dad' },
      { label: 'Little one', emoji: '👶', value: 'kids' },
    ],
  },
  {
    id: 'occasion',
    question: 'What are we celebrating?',
    options: [
      { label: 'Birthday', emoji: '🎂', value: 'birthday' },
      { label: 'Anniversary', emoji: '💍', value: 'anniversary' },
      { label: 'Tihar', emoji: '✨', value: 'tihar' },
      { label: 'Thank you', emoji: '🙏', value: 'thank you' },
      { label: 'Just because', emoji: '💝', value: 'surprise' },
      { label: 'Get well', emoji: '🤗', value: 'get well soon' },
    ],
  },
  {
    id: 'budget',
    question: 'And the budget?',
    options: [
      { label: 'Under Rs. 1,000', emoji: '🪙', value: 'under 1000' },
      { label: 'Rs. 1,000 – 2,500', emoji: '💵', value: 'under 2500' },
      { label: 'Treat them big', emoji: '💎', value: 'premium' },
    ],
  },
]

export default function GiftFinderFeature() {
  const [answers, setAnswers] = useState<Record<string, Option>>({})
  const [inApp, setInApp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const step = STEPS.find((s) => !answers[s.id])
  const done = !step

  useEffect(() => {
    setInApp(isInApp())
    // Match the app's sheet so no white shows below the quiz.
    document.body.style.background = '#faf5f0'
  }, [])

  // Inline blocks grow to fit the page.
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => appBridge.resize(el.scrollHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const query = done
    ? `${answers.occasion.value} gift for ${answers.who.value} ${answers.budget.value}`.replace(/\s+/g, ' ').trim()
    : ''

  useEffect(() => {
    if (!done) return
    appBridge.say('Ooh, I know just the thing! 🎁')
    appBridge.emit('gift_finder_done', {
      who: answers.who.value,
      occasion: answers.occasion.value,
      budget: answers.budget.value,
    })
  }, [done, answers])

  const choose = (id: string, option: Option) => {
    appBridge.haptic('light')
    setAnswers((prev) => ({ ...prev, [id]: option }))
  }

  const showGifts = () => {
    const path = `/search?q=${encodeURIComponent(query)}`
    if (appBridge.open(path)) {
      appBridge.close()
    } else {
      window.location.href = path
    }
  }

  return (
    <div ref={rootRef} className="min-h-0 bg-cream px-5 pb-6 pt-5 text-ink">
      <div className="mx-auto max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-wine/70">Gift finder</p>

        {step ? (
          <>
            <h1 className="mt-1 text-xl font-semibold">{step.question}</h1>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {step.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => choose(step.id, option)}
                  className="flex items-center gap-2.5 rounded-2xl border border-wine/10 bg-white px-3.5 py-3 text-left text-[15px] font-semibold shadow-[0_6px_18px_-14px_rgba(43,29,34,0.5)] transition active:scale-[0.98]"
                >
                  <span className="text-xl" aria-hidden>
                    {option.emoji}
                  </span>
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-1.5" aria-label={`Step ${STEPS.indexOf(step) + 1} of ${STEPS.length}`}>
              {STEPS.map((s) => (
                <span
                  key={s.id}
                  className={`h-1.5 flex-1 rounded-full ${answers[s.id] || s === step ? 'bg-blush' : 'bg-wine/10'}`}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-1 text-xl font-semibold">
              A {answers.occasion.label.toLowerCase()} gift for {answers.who.label.toLowerCase()} {answers.who.emoji}
            </h1>
            <p className="mt-1.5 text-sm text-ink/60">
              We’ll ask our AI search for “{query}”.
            </p>
            <button
              type="button"
              onClick={showGifts}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-wine text-[15px] font-semibold text-white active:scale-[0.99]"
            >
              Show me gifts
            </button>
            <button
              type="button"
              onClick={() => setAnswers({})}
              className="mt-2 h-10 w-full text-sm font-semibold text-wine"
            >
              Start over
            </button>
            {!inApp ? (
              <p className="mt-3 text-center text-xs text-ink/45">Works best in the Upaharo app.</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
