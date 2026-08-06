import Link from 'next/link'
import { ogImages, ogTwitterImages } from '@/lib/og'

export const revalidate = 86400

export const metadata = {
  title: 'How It Works',
  description:
    'How to find and book a verified Jerusalem stay through JLM Collective \u2014 simple, personal, and transparent.',
  alternates: {
    canonical: '/how-it-works',
  },
  openGraph: {
    title: 'How It Works | JLM Collective',
    description:
      'How to find and book a verified Jerusalem stay through JLM Collective \u2014 simple, personal, and transparent.',
    url: '/how-it-works',
    type: 'website',
    ...ogImages('How JLM Collective works'),
  },
  twitter: {
    card: 'summary_large_image',
    images: ogTwitterImages('How JLM Collective works'),
  },
}

const steps = [
  {
    title: 'Browse verified stays',
    description:
      'Every listing on JLM Collective has been personally reviewed by our team. Browse by neighbourhood, dates, amenities, or what matters most to you.',
  },
  {
    title: 'Message the host',
    description:
      'Send a free message to the host with your dates and any questions. No commitment required. Most hosts reply within a few hours.',
  },
  {
    title: 'Confirm the details',
    description:
      'Once you are both happy, the host confirms availability and you agree the details together.',
  },
  {
    title: 'Arrange payment',
    description:
      'Once the booking details are confirmed, we guide the payment step. Where online payment is available, JLM Collective collects payment as agent for the host; some hosts may arrange payment directly.',
  },
  {
    title: 'Receive check-in details',
    description:
      'The host sends full check-in instructions before your arrival so you know exactly what to expect.',
  },
  {
    title: 'Arrive and enjoy',
    description:
      'We are available throughout your stay if you need anything at all.',
  },
]

const faqs: { q: string; a: string }[] = [
  {
    q: 'Are the apartments kosher?',
    a: 'Many of our Jerusalem stays have kosher kitchens, and each listing shows its kosher level so you can filter for exactly what you keep.',
  },
  {
    q: 'How close are the stays to the Kotel?',
    a: 'Listings show an approximate walking time to the Kotel and to nearby shuls, so you can choose a stay within comfortable walking distance for Shabbat and Yom Tov.',
  },
  {
    q: 'Do you have stays with a sukkah balcony?',
    a: 'Yes. You can filter for apartments with a balcony suitable for a sukkah, which are in high demand around Sukkot — book early.',
  },
  {
    q: 'Is there availability for Pesach and the chagim?',
    a: 'Jerusalem fills up fast around Pesach, Sukkot and the Yamim Noraim. Browse available stays for your dates and message the host to confirm before the peak season sells out.',
  },
  {
    q: 'Can I message a host before I book?',
    a: 'Yes — messaging a host is free and there is no commitment. Ask about availability, the neighbourhood, or anything about the stay, and most hosts reply within a few hours.',
  },
  {
    q: 'How does payment work, and is my deposit refundable?',
    a: 'Where online payment is available, JLM Collective collects the deposit as agent for the host and you pay the balance securely through the site on the host\u2019s schedule; some hosts arrange payment directly. Cancellation and refund terms are set per booking, so check with the host before you pay.',
  },
  {
    q: 'Are the hosts verified?',
    a: 'Every property is personally reviewed before we agree to represent it, and hosts are identity-verified, so you can book with confidence.',
  },
]

function escapeJsonLd(value: string) {
  return value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

export default function HowItWorksPage() {
  return (
    <div className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: escapeJsonLd(
            JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.map((faq) => ({
                '@type': 'Question',
                name: faq.q,
                acceptedAnswer: { '@type': 'Answer', text: faq.a },
              })),
            }),
          ),
        }}
      />
      <div className="mx-auto max-w-3xl px-5 pt-8 md:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 transition hover:text-stone-900"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Home
        </Link>
      </div>
      <div className="mx-auto max-w-3xl px-5 py-16 text-center md:px-8">
        <h1 className="font-display text-4xl font-bold tracking-tight text-stone-950 md:text-5xl">
          How JLM Collective works
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-stone-600">
          Simple, personal, and verified {'\u2014'} from search to keys.
        </p>
      </div>

      <div className="mx-auto max-w-3xl px-5 pb-16 md:px-8">
        <div className="space-y-6">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex gap-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-100"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c76f55] text-sm font-bold text-white">
                {index + 1}
              </span>
              <div>
                <h2 className="font-bold text-stone-950">{step.title}</h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <h2 className="font-display text-2xl font-bold text-stone-950">
            Frequently asked questions
          </h2>
          <div className="mt-6 divide-y divide-stone-200 border-y border-stone-200">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-stone-900">
                  {faq.q}
                  <span className="text-stone-500 transition group-open:rotate-180" aria-hidden="true">
                    ⌄
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-stone-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F8F5F2] py-16">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <h2 className="font-display text-2xl font-bold text-stone-950">
            Why JLM Collective
          </h2>
          <div className="mt-6 space-y-4">
            {[
              'Every property reviewed before we agree to represent it',
              'Local specialists who know every neighbourhood',
              'Dedicated agent support throughout your stay',
            ].map((point) => (
              <div key={point} className="flex items-center gap-3">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c76f55"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <p className="text-stone-700">{point}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link
              href="/stays"
              className="inline-flex rounded-full bg-[#252525] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#111111]"
            >
              Browse stays
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
