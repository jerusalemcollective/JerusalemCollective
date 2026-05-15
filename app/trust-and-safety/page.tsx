export const metadata = {
  title: 'Trust & Safety Policy | JLM Collective',
  description: 'Trust & Safety Policy for JLM Collective - our standards, review process, and how we protect users.',
}

export default function TrustAndSafetyPage() {
  return (
    <div className="min-h-screen">
      {/* Content */}
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-6 md:py-16">
        <article className="rounded-2xl border border-stone-200 bg-white p-8 md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-stone-900 md:text-4xl">
            Trust &amp; Safety Policy
          </h1>
          <p className="mb-8 text-sm text-stone-500">
            Last updated: 15 May 2026
          </p>

          <div className="space-y-10">
            {/* 1. Introduction */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">1. Introduction</h2>
              <p className="text-stone-700 leading-relaxed">
                JLM Collective is designed to help guests find short-term stays and to help owners, hosts, representatives and managing agents submit stays for listing.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                Trust is central to the platform. This Trust &amp; Safety Policy explains the standards we expect from users, how we review listings, and the steps we may take to protect guests, hosts and the JLM Collective marketplace.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                This policy should be read together with our <Link href="/terms" className="text-[#c76f55] hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-[#c76f55] hover:underline">Privacy Policy</Link>.
              </p>
            </section>

            {/* 2. Listing standards */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">2. Listing standards</h2>
              <p className="text-stone-700 leading-relaxed">
                All listings submitted to JLM Collective should be accurate, honest and up to date.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                Hosts, owners, representatives and managing agents must ensure that listing information is not misleading, including:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1 text-stone-700">
                <li>property location or neighbourhood;</li>
                <li>photos;</li>
                <li>pricing;</li>
                <li>availability;</li>
                <li>number of guests;</li>
                <li>bedrooms and sleeping arrangements;</li>
                <li>amenities;</li>
                <li>access arrangements;</li>
                <li>house rules;</li>
                <li>cancellation or deposit terms;</li>
                <li>any important limitations or restrictions.</li>
              </ul>
              <p className="mt-4 text-stone-700 leading-relaxed">
                Listings should not exaggerate the condition, size, location, quality or facilities of a stay.
              </p>
            </section>

            {/* 3. Listing review */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">3. Listing review</h2>
              <p className="text-stone-700 leading-relaxed">
                JLM Collective may review listings before they go live on the platform.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                A submitted listing does not automatically appear publicly. We may check the listing for completeness, quality, suitability, accuracy and platform standards.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                We may approve, reject, pause, edit, request more information, or remove a listing at our discretion.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                Review by JLM Collective does not mean that we guarantee the property, host, guest, price, availability, safety, legality or suitability of any stay.
              </p>
            </section>

            {/* 4. Host and representative responsibility */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">4. Host and representative responsibility</h2>
              <p className="text-stone-700 leading-relaxed">
                Anyone submitting a stay must have the right or permission to do so.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                If you submit a listing, you confirm that:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1 text-stone-700">
                <li>the information you provide is accurate;</li>
                <li>you have authority to submit the stay for listing;</li>
                <li>the stay can lawfully be offered for short-term use;</li>
                <li>the photos and content you upload may be used for the listing;</li>
                <li>you will keep the listing information reasonably up to date;</li>
                <li>you will respond honestly to guest enquiries.</li>
              </ul>
              <p className="mt-4 text-stone-700 leading-relaxed">
                If you are acting on behalf of an owner, you are responsible for ensuring that you have permission from the owner or other authorised person.
              </p>
            </section>

            {/* 5. Guest responsibility */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">5. Guest responsibility</h2>
              <p className="text-stone-700 leading-relaxed">
                Guests must use the platform honestly and respectfully.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                Guests should provide accurate information when making enquiries or booking requests, including guest numbers, intended dates, contact details and any relevant requirements.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                Guests must not use the platform to send false enquiries, spam, abusive messages, fraudulent requests, misleading information or unlawful content.
              </p>
            </section>

            {/* 6. Accuracy of photos and descriptions */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">6. Accuracy of photos and descriptions</h2>
              <p className="text-stone-700 leading-relaxed">
                Photos should fairly represent the stay being offered.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                Hosts should not upload photos that materially misrepresent the property, show a different property, hide important defects, or create a misleading impression of the stay.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                JLM Collective may reject or remove photos that are unclear, inappropriate, low quality, misleading, duplicated, copied without permission, or unsuitable for the platform.
              </p>
            </section>

            {/* 7. Verification and checks */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">7. Verification and checks</h2>
              <p className="text-stone-700 leading-relaxed">
                JLM Collective may carry out checks to help protect the platform.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                These may include requesting additional information from hosts, representatives, managing agents or guests. We may ask for confirmation of authority, contact details, ownership or management connection, listing details, or other information reasonably needed to assess a listing or enquiry.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                We do not guarantee that every user, listing or stay has been independently verified unless we clearly state this in relation to a specific listing or feature.
              </p>
            </section>

            {/* 8. Payments, deposits and booking safety */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">8. Payments, deposits and booking safety</h2>
              <p className="text-stone-700 leading-relaxed">
                Where payment, deposit or booking features are available, users should follow the process shown on the platform.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                Guests should be cautious about sending money outside the platform or to unknown third parties. Hosts and representatives should not request payment in a way that is misleading, unsafe or contrary to the instructions shown on JLM Collective.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                If JLM Collective introduces payment or deposit handling, the relevant payment terms will apply.
              </p>
            </section>

            {/* 9. Prohibited conduct */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">9. Prohibited conduct</h2>
              <p className="text-stone-700 leading-relaxed">
                Users must not:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1 text-stone-700">
                <li>submit false, misleading or fraudulent listings;</li>
                <li>impersonate another person or organisation;</li>
                <li>list a property without permission;</li>
                <li>upload content they do not have the right to use;</li>
                <li>send spam or abusive messages;</li>
                <li>attempt to avoid platform safety processes;</li>
                <li>interfere with the website or platform security;</li>
                <li>use the platform for unlawful, discriminatory, harmful or deceptive purposes;</li>
                <li>misuse another person&apos;s personal information;</li>
                <li>pressure users to communicate or pay in unsafe ways.</li>
              </ul>
            </section>

            {/* 10. Reporting concerns */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">10. Reporting concerns</h2>
              <p className="text-stone-700 leading-relaxed">
                Users should report concerns to JLM Collective if they believe that:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1 text-stone-700">
                <li>a listing is false or misleading;</li>
                <li>a user is acting fraudulently or abusively;</li>
                <li>a property is materially different from what was described;</li>
                <li>photos are inaccurate or copied;</li>
                <li>someone is listing without authority;</li>
                <li>payment or deposit requests seem suspicious;</li>
                <li>there is a safety, legal or conduct concern.</li>
              </ul>
              <p className="mt-4 text-stone-700 leading-relaxed">
                Reports can be sent to:
              </p>
              <p className="mt-2 text-stone-700">
                <a 
                  href="mailto:info@jlmcollective.co" 
                  className="text-[#c76f55] underline hover:text-[#b55f47]"
                >
                  info@jlmcollective.co
                </a>
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                Please include relevant details, such as the listing name, dates, messages, screenshots or any other information that may help us review the issue.
              </p>
            </section>

            {/* 11. Platform action */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">11. Platform action</h2>
              <p className="text-stone-700 leading-relaxed">
                If we identify or suspect a trust or safety issue, we may take action.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                This may include:
              </p>
              <ul className="mt-3 list-disc pl-6 space-y-1 text-stone-700">
                <li>requesting more information;</li>
                <li>editing, pausing or removing a listing;</li>
                <li>restricting or suspending an account;</li>
                <li>blocking enquiries or communications;</li>
                <li>refusing to publish a listing;</li>
                <li>warning a user;</li>
                <li>reporting serious issues to relevant authorities where appropriate;</li>
                <li>taking any other reasonable step to protect users or the platform.</li>
              </ul>
              <p className="mt-4 text-stone-700 leading-relaxed">
                We may act where we believe it is necessary, even if an issue has not yet been fully proven.
              </p>
            </section>

            {/* 12. No guarantee */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">12. No guarantee</h2>
              <p className="text-stone-700 leading-relaxed">
                JLM Collective aims to support a safer and more reliable marketplace, but we cannot guarantee every listing, user, property, enquiry, payment or stay.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                Users are responsible for making their own checks and decisions before entering into any arrangement.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                Nothing in this policy is intended to replace a user&apos;s own judgment, due diligence, legal obligations or contractual responsibilities.
              </p>
            </section>

            {/* 13. Changes to this policy */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">13. Changes to this policy</h2>
              <p className="text-stone-700 leading-relaxed">
                We may update this Trust &amp; Safety Policy from time to time.
              </p>
              <p className="mt-4 text-stone-700 leading-relaxed">
                The updated version will be posted on this page with a new &quot;Last updated&quot; date.
              </p>
            </section>

            {/* 14. Contact us */}
            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">14. Contact us</h2>
              <p className="text-stone-700 leading-relaxed">
                For trust and safety concerns, contact:
              </p>
              <div className="mt-4 text-stone-700 leading-relaxed">
                <p><strong>JLM Collective</strong></p>
                <p className="mt-2">
                  Email:{' '}
                  <a 
                    href="mailto:info@jlmcollective.co" 
                    className="text-[#c76f55] underline hover:text-[#b55f47]"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    info@jlmcollective.co
                  </a>
                </p>
              </div>
            </section>
          </div>
        </article>
      </div>
    </div>
  )
}
