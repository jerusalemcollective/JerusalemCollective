import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for guests and hosts using JLM Collective.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-6 md:py-16">
        <article className="rounded-2xl border border-stone-200 bg-white p-8 md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-stone-900 md:text-4xl">
            Terms of Service
          </h1>
          <p className="mb-8 text-sm text-stone-500">
            Last updated: 18 May 2026
          </p>

          <div className="space-y-10">
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">1. About these terms</h2>
              <p className="leading-relaxed text-stone-700">
                These terms govern use of JLM Collective, including guest accounts, host accounts,
                listing submissions, enquiries, booking requests, messaging, and related services.
              </p>
              <p className="mt-4 leading-relaxed text-stone-700">
                They should be read together with our{' '}
                <Link href="/privacy" className="text-[#c76f55] hover:underline">
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link href="/trust-and-safety" className="text-[#c76f55] hover:underline">
                  Trust &amp; Safety Policy
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">2. Platform role</h2>
              <p className="leading-relaxed text-stone-700">
                JLM Collective provides a marketplace where users can discover stays, submit listings,
                send enquiries, and manage related communications. Unless clearly stated otherwise,
                JLM Collective is not the owner, landlord, tenant, or operator of listed properties.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">3. User accounts</h2>
              <p className="leading-relaxed text-stone-700">
                Users must provide accurate information, keep account access secure, and use the
                platform honestly and lawfully. We may restrict or suspend access where reasonably
                necessary to protect users, the platform, or comply with law.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">4. Host terms and conditions</h2>
              <p className="leading-relaxed text-stone-700">
                Before submitting a first stay, a host must agree to these host terms. By doing so,
                the host confirms that:
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-6 text-stone-700">
                <li>they are authorised to submit the stay for listing;</li>
                <li>all listing information, pricing, photos, amenities, and descriptions are accurate;</li>
                <li>the stay may lawfully be offered for the intended use;</li>
                <li>they have the right to upload and use all photos and content provided;</li>
                <li>they will keep material listing details reasonably up to date;</li>
                <li>they will communicate honestly with guests and JLM Collective;</li>
                <li>they understand that listings may be reviewed before publication;</li>
                <li>they remain responsible for their property, availability, pricing, taxes, and legal obligations.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">5. Listings and review</h2>
              <p className="leading-relaxed text-stone-700">
                We may review, request changes to, decline, pause, or remove listings where needed.
                Submission does not guarantee publication. A review does not amount to a guarantee of
                the property, host, guest, or booking outcome.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">6. Enquiries, bookings, and payments</h2>
              <p className="leading-relaxed text-stone-700">
                Users must follow the booking and payment process shown on the platform. Where direct
                payment to a host is permitted, the host remains responsible for clearly stating the
                agreed terms. Any later integrated payment terms will apply in addition to these terms.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">7. Disputes and refunds</h2>
              <p className="leading-relaxed text-stone-700">
                Users may raise support cases through the platform where available. We may review
                information from both sides and record case outcomes. Refund eligibility depends on the
                applicable booking, payment, cancellation, and host terms in force for that stay.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">8. Prohibited use</h2>
              <p className="leading-relaxed text-stone-700">
                Users must not submit misleading listings, impersonate others, upload content without
                rights, misuse personal data, send spam, interfere with security, or use the platform for
                unlawful, deceptive, abusive, or discriminatory purposes.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">9. Changes</h2>
              <p className="leading-relaxed text-stone-700">
                We may update these terms from time to time. The current version will be shown on this
                page with its last-updated date.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">10. Contact</h2>
              <p className="leading-relaxed text-stone-700">
                Questions about these terms can be sent to{' '}
                <a href="mailto:info@jlmcollective.co" className="text-[#c76f55] hover:underline">
                  info@jlmcollective.co
                </a>
                .
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  )
}
