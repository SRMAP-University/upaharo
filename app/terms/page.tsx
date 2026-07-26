import type { Metadata } from 'next'
import LegalPage, { LegalSection } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service | Upaharo',
  description: 'Terms governing use of the Upaharo website and mobile app.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="18 July 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of Upaharo&apos;s website and
        mobile app (the &quot;Service&quot;). By creating an account or placing an order, you agree
        to these Terms.
      </p>

      <LegalSection title="1. Who we are">
        <p>
          Upaharo provides gift, flower, cake, and related product ordering with delivery in our
          service area (primarily the Kathmandu Valley). Contact:{' '}
          <a href="mailto:hello@upaharo.com" className="font-semibold text-wine underline">
            hello@upaharo.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility">
        <p>
          You must be able to form a binding contract under applicable law. You are responsible for
          keeping your login credentials secure and for activity under your account.
        </p>
      </LegalSection>

      <LegalSection title="3. Orders &amp; pricing">
        <ul className="list-disc space-y-1 pl-5">
          <li>Product images are illustrative; seasonal availability may vary.</li>
          <li>Prices, delivery fees, and promotions may change without notice.</li>
          <li>An order is an offer to purchase; we may accept, decline, or cancel (e.g. stock, area, payment issues).</li>
          <li>Delivery times are estimates and may be affected by traffic, weather, or peak demand.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Delivery">
        <p>
          Accurate recipient details and location are your responsibility. Failed delivery due to
          incorrect address, unreachable recipient, or restricted access may incur extra fees or
          cancellation per our support policies.
        </p>
      </LegalSection>

      <LegalSection title="5. Payments">
        <p>
          Payments are processed through our payment partners. You authorize charges for accepted
          orders. Refunds for cancelled or failed orders are handled according to the payment method
          and our support process.
        </p>
      </LegalSection>

      <LegalSection title="6. Gifts &amp; messages">
        <p>
          You must not submit illegal, harmful, or abusive gift messages or content. We may refuse
          orders that violate this rule.
        </p>
      </LegalSection>

      <LegalSection title="7. Acceptable use">
        <p>
          You agree not to misuse the Service (including scraping, attacking our systems, creating
          fake accounts, or interfering with other customers). We may suspend or terminate accounts
          that violate these Terms.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property">
        <p>
          Upaharo branding, app design, and site content are owned by us or our licensors. You may
          not copy or reuse them without permission.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimers">
        <p>
          The Service is provided &quot;as is&quot; to the extent permitted by law. We are not
          liable for indirect or consequential damages arising from delays, third-party delivery
          failures, or circumstances beyond our reasonable control.
        </p>
      </LegalSection>

      <LegalSection title="10. Account deletion">
        <p>
          You may delete your account in the Upaharo app (Account → Delete account). See our{' '}
          <a href="/account-deletion" className="font-semibold text-wine underline">
            Account deletion
          </a>{' '}
          page and{' '}
          <a href="/privacy" className="font-semibold text-wine underline">
            Privacy Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update these Terms. Continued use after changes constitutes acceptance of the
          revised Terms. Material changes will be reflected by updating the date above.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          <a href="mailto:hello@upaharo.com" className="font-semibold text-wine underline">
            hello@upaharo.com
          </a>{' '}
          ·{' '}
          <a href="https://www.upaharo.com" className="font-semibold text-wine underline">
            www.upaharo.com
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  )
}
