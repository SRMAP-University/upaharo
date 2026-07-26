import type { Metadata } from 'next'
import LegalPage, { LegalSection } from '@/components/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy | Upaharo',
  description: 'How Upaharo collects, uses, and protects your personal information.',
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="18 July 2026">
      <p>
        Upaharo (&quot;we&quot;, &quot;us&quot;) operates the website{' '}
        <a href="https://www.upaharo.com" className="font-semibold text-wine underline">
          www.upaharo.com
        </a>{' '}
        and the Upaharo mobile application. This Privacy Policy explains what information we
        collect and how we use it when you shop for gifts, flowers, and related delivery services
        in Nepal.
      </p>

      <LegalSection title="1. Information we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account information:</strong> name, email address, phone number, and password
            (stored hashed).
          </li>
          <li>
            <strong>Delivery details:</strong> addresses, map pin (latitude/longitude), landmarks,
            and related delivery notes.
          </li>
          <li>
            <strong>Order &amp; payment information:</strong> products ordered, gift messages,
            order status history, and payment status. Card/payment details are processed by our
            payment provider; we do not store full card numbers.
          </li>
          <li>
            <strong>Device &amp; notifications:</strong> device tokens for push notifications
            (Firebase Cloud Messaging), app version, and basic device platform (Android/iOS/web).
          </li>
          <li>
            <strong>Usage:</strong> product views and similar analytics that help us improve
            recommendations and the shopping experience.
          </li>
          <li>
            <strong>Support communications:</strong> messages you send to our support channels.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. How we use information">
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide, fulfill, and support gift orders and delivery.</li>
          <li>Verify your account and keep it secure.</li>
          <li>Show delivery availability for your location (Kathmandu Valley service area).</li>
          <li>Send transactional notifications (order updates) and, if you allow, marketing offers.</li>
          <li>Improve our catalog, app, and customer support.</li>
          <li>Comply with legal obligations and prevent fraud or abuse.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Location">
        <p>
          We use precise or approximate location when you choose a delivery address so we can
          confirm serviceability and complete delivery. Location is not used for unrelated
          advertising. You can change or clear saved addresses in the app.
        </p>
      </LegalSection>

      <LegalSection title="4. Push notifications">
        <p>
          On supported devices we may request permission to send notifications about orders,
          payments, reminders, and promotions. You can revoke permission anytime in your device
          settings. Uninstalling the app or logging out removes your device token from our systems
          when possible.
        </p>
      </LegalSection>

      <LegalSection title="5. Sharing">
        <p>We share data only as needed to operate the service, including:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Delivery partners / staff fulfilling your order.</li>
          <li>Payment processors for checkout.</li>
          <li>Infrastructure providers (hosting, database, file storage, email, Firebase for push).</li>
          <li>Authorities when required by law.</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </LegalSection>

      <LegalSection title="6. Retention">
        <p>
          We keep account and order records as long as needed to provide the service, meet
          accounting/legal requirements, and resolve disputes. When you delete your account, we
          remove or anonymize personal identifiers and revoke device tokens, while retaining
          order history in anonymized form where required for business records.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <ul className="list-disc space-y-1 pl-5">
          <li>Access or update profile details while logged in.</li>
          <li>
            Delete your account in the mobile app under <strong>Account → Delete account</strong>{' '}
            (see also{' '}
            <a href="/account-deletion" className="font-semibold text-wine underline">
              Account deletion
            </a>
            ).
          </li>
          <li>Control notification and location permissions on your device.</li>
          <li>Contact us to ask questions about your data.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>
          We use industry-standard measures such as HTTPS, hashed passwords, and access controls.
          No method of transmission or storage is 100% secure; please use a strong unique password.
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p>
          Upaharo is intended for adults purchasing gifts. We do not knowingly collect personal
          information from children under 13. Contact us if you believe a child has provided data
          so we can delete it.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes">
        <p>
          We may update this policy from time to time. The &quot;Last updated&quot; date at the top
          will change when we do. Continued use of the service after changes means you accept the
          updated policy.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Questions about privacy:{' '}
          <a href="mailto:hello@upaharo.com" className="font-semibold text-wine underline">
            hello@upaharo.com
          </a>
          <br />
          Website:{' '}
          <a href="https://www.upaharo.com" className="font-semibold text-wine underline">
            https://www.upaharo.com
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  )
}
