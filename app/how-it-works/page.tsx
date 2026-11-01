import Link from 'next/link'
import { ogImages, ogTwitterImages } from '@/lib/og'

export const revalidate = 86400

export const metadata = {
  title: 'How It Works',
  description:
    'How to find and book a Jerusalem stay with JLM Collective, step by step: find a home, message the host, agree the details and pay.',
  alternates: {
    canonical: '/how-it-works',
  },
  openGraph: {
    title: 'How It Works | JLM Collective',
    description:
      'How to find and book a Jerusalem stay with JLM Collective, step by step: find a home, message the host, agree the details and pay.',
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
    title: 'Find a stay you like',
    description:
      'Our team looks at every home on JLM Collective before it goes live. Search by neighbourhood, dates, or what you need for Shabbos and Yom Tov.',
  },
  {
    title: 'Message the host',
    description:
      'Send the host your dates and any questions. It\u2019s free, and it doesn\u2019t commit you to anything.',
  },
  {
    title: 'Agree the details',
    description:
      'When you\u2019re both happy, the host confirms your dates and you agree the details together. Some stays can be booked straight away.',
  },
  {
    title: 'Pay',
    description:
      'Once your booking details are agreed, we\u2019ll show you how to pay. Where you can pay online, JLM Collective takes the payment as agent for the host. Some hosts ask you to pay them directly.',
  },
  {
    title: 'Get your check-in details',
    description:
      'Before you arrive, the host sends you full check-in instructions, so you know just what to expect.',
  },
  {
    title: 'Arrive and enjoy',
    description:
      'If you need anything during your stay, email us at info@jlmcollective.co.',
  },
]

const faqs: { q: string; a: string }[] = [
  {
    q: 'Are the apartments kosher?',
    a: 'Many of our Jerusalem stays have kosher kitchens. Each listing shows its kosher level, so you can find one that fits what you keep.',
  },
  {
    q: 'How close are the stays to the Kotel?',
    a: 'Listings show roughly how long it takes to walk to the Kotel and to nearby shuls. That way you can choose somewhere that\u2019s an easy walk on Shabbos and Yom Tov.',
  },
  {
    q: 'Do you have stays with a sukkah balcony?',
    a: 'Yes. You can search for apartments with a balcony that can take a sukkah. Lots of families want them for Sukkot, so it\u2019s worth booking early.',
  },
  {
    q: 'Is there availability for Pesach and the chagim?',
    a: 'Jerusalem fills up fast around Pesach, Sukkot and the Yamim Noraim. Search for your dates and message the host to check, before the busy season gets booked up.',
  },
  {
    q: 'Can I message a host before I book?',
    a: 'Yes. Messaging a host is free and doesn\u2019t commit you to anything. Ask about the dates, the neighbourhood or anything else about the stay.',
  },
  {
    q: 'How does payment work, and is my deposit refundable?',
    a: 'Where you can pay online, JLM Collective takes the deposit as agent for the host. You then pay the balance safely through the site on the host\u2019s schedule. Some hosts arrange payment directly. Cancellation and refund terms are set for each booking, so check them with the host before you pay.',
  },
  {
    q: 'Are the hosts verified?',
    a: 'We look at every home ourselves before we agree to list it. Hosts whose ID our team has checked show a Verified host badge on their profile and listings.',
  },
]

function escapeJsonLd(value: string) {
  return value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

export default function HowItWorksPage() {
  return (
    <div className="bg-[#F8F5F2]">
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
          <h2 className="text-2xl font-semibold text-stone-950">
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

      <section className="border-t border-stone-200 py-16">
        <div className="mx-auto max-w-3xl px-5 md:px-8">
          <h2 className="text-2xl font-semibold text-stone-950">
            Why book with us
          </h2>
          <div className="mt-6 space-y-4">
            {[
              'We look at every home before we agree to list it',
              'A local team who know Jerusalem\u2019s neighbourhoods',
              'Real people to help if something isn\u2019t right',
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
              Find a stay
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
