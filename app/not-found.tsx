import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F5F2] px-5 py-12">
      <section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
        <Image
          src="/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp"
          alt="JLM Collective"
          width={208}
          height={48}
          className="mx-auto"
          priority
        />
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-stone-950">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-3 text-stone-600">
          The listing may have been removed or the link may be out of date.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Link
            href="/stays"
            className="rounded-full bg-[#c76f55] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#b85f47]"
          >
            Browse all stays
          </Link>
          <Link href="/" className="text-sm font-semibold text-stone-600 transition hover:text-stone-950">
            Go to homepage
          </Link>
        </div>
      </section>
    </main>
  )
}
