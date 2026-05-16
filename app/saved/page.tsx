import Link from 'next/link'

export default function SavedPage() {
  return (
    <main className="min-h-screen bg-[#F8F5F2] px-5 py-12 text-[#252525]">
      <section className="mx-auto max-w-2xl rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <img
          src="/icons/yemin-moshe-save-512.png"
          alt=""
          aria-hidden="true"
          className="mx-auto h-12 w-12 object-contain"
        />
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-stone-950">
          Saved stays
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">
          Accounts and saved properties are ready to connect once the live data layer is configured.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/stays"
            className="rounded-full bg-[#c76f55] px-5 py-3 text-sm font-bold text-white hover:bg-[#b85f47]"
          >
            Browse stays
          </Link>
          <Link
            href="/host/login"
            className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-800 hover:border-stone-500"
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  )
}
