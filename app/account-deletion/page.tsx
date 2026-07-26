import type { Metadata } from 'next'
import LegalPage, { LegalSection } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Account deletion | Upaharo',
  description: 'How to delete your Upaharo account from the mobile app.',
}

export default function AccountDeletionPage() {
  return (
    <LegalPage title="Delete your Upaharo account" updated="18 July 2026">
      <p>
        If you created an Upaharo account in the mobile app or on the website, you can delete it
        yourself. Google Play requires apps with account creation to offer in-app account deletion.
      </p>

      <LegalSection title="How to delete (mobile app)">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open the Upaharo app and sign in.</li>
          <li>Go to <strong>Account</strong>.</li>
          <li>Tap <strong>Delete account</strong>.</li>
          <li>Confirm the deletion.</li>
        </ol>
        <p className="mt-2">
          After confirmation, you will be signed out and will no longer be able to log in with that
          account.
        </p>
      </LegalSection>

      <LegalSection title="What we delete or anonymize">
        <ul className="list-disc space-y-1 pl-5">
          <li>Name, email, phone, and password credentials</li>
          <li>Saved delivery addresses</li>
          <li>Push notification device tokens</li>
          <li>In-app notification inbox entries</li>
          <li>Gift recipient profiles linked to your account</li>
        </ul>
        <p>
          Open orders that are not yet completed may be cancelled. Historical order records may be
          retained in anonymized form for accounting, fraud prevention, and legal compliance.
        </p>
      </LegalSection>

      <LegalSection title="Need help?">
        <p>
          Email{' '}
          <a href="mailto:hello@upaharo.com" className="font-semibold text-wine underline">
            hello@upaharo.com
          </a>{' '}
          if you cannot access the app. We will verify ownership and process deletion requests.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
