import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F5F2] px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <img
          src="/logos/JLM_Collective_Primary_Horizontal_Terracotta_UI.webp"
          alt="JLM Collective"
          className="mx-auto h-10 w-auto"
        />
        <h1 className="font-display mt-8 text-2xl font-bold text-stone-950">
          We could not verify that link
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-500">
          The confirmation link may have expired or already been used. Try signing in, or create the account again if needed.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/host/login"
            className="rounded-full bg-[#252525] px-5 py-3 text-sm font-bold text-white hover:bg-[#111111]"
          >
            Sign in
          </Link>
          <Link
            href="/host/register"
            className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-stone-800 hover:border-stone-500"
          >
            Create account
          </Link>
        </div>
      </section>
    </main>
  )
}
