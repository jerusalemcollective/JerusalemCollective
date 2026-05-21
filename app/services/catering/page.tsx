import { CateringEnquiryForm } from '@/components/service-enquiry-forms'

export const metadata = {
  title: 'Kosher Catering & Shabbat Meals | JLM Collective',
  description: 'Custom kosher menus and Shabbat packages delivered to your Jerusalem rental. Arranged by JLM Collective.',
}

export default function CateringPage() {
  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-12 text-[#252525] md:px-6">
      <section className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[#c76f55]">Food & catering</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-stone-950 md:text-5xl">Custom Menus & Shabbat Packages</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-stone-600">
          We arrange fresh, kosher meals delivered directly to your property — whether you need a Friday night dinner, a full Yom Tov package, or simple weekday meals.
        </p>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <Step number="1" title="Tell us your dates" body="Let us know when you arrive, how many guests, and what you need." />
          <Step number="2" title="Choose your menu" body="We will be in touch to confirm the menu, kashrut level, and dietary requirements." />
          <Step number="3" title="We deliver to your door" body="Fresh food delivered to your property, ready when you need it." />
        </section>

        <section className="mt-10">
          <CateringEnquiryForm />
        </section>
      </section>
    </main>
  )
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <article className="rounded-3xl bg-white p-6 shadow-sm">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#fff4ef] text-sm font-bold text-[#c76f55]">{number}</span>
      <h2 className="mt-4 text-lg font-bold text-stone-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
    </article>
  )
}
