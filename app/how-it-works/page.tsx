import Link from 'next/link'

export const revalidate = 86400

export const metadata = {
  title: 'How It Works | JLM Collective',
  description:
    'How to find and book a verified Jerusalem stay through JLM Collective \u2014 simple, personal, and transparent.',
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

export default function HowItWorksPage() {
  return (
    <div className="bg-white">
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
              className="inline-flex rounded-full bg-[#c76f55] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]"
            >
              Browse stays
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
