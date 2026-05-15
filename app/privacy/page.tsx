import Link from 'next/link'
import { Footer } from '@/components/footer'

export const metadata = {
  title: 'Privacy Policy | JLM Collective',
  description: 'Privacy Policy for JLM Collective - how we collect, use, and protect your information.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#F8F5F2]">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-6">
          <Link href="/" className="shrink-0">
            <img
              src="/logos/JLM_Collective_Primary_Horizontal_Terracotta_Transparent.png"
              alt="JLM Collective"
              className="h-10 w-auto md:h-12"
            />
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-stone-600 transition hover:text-[#c76f55]"
          >
            Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-5 py-12 md:px-6 md:py-16">
        <article className="rounded-2xl border border-stone-200 bg-white p-8 md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-stone-900 md:text-4xl">
            Privacy Policy
          </h1>
          <p className="mb-8 text-sm text-stone-500">
            Last updated: May 15, 2026
          </p>

          <div className="prose prose-stone max-w-none">
            <section className="mb-8">
              <h2 className="mb-4 text-xl font-bold text-stone-900">1. Introduction</h2>
              <p className="mb-4 text-stone-700 leading-relaxed">
                Welcome to JLM Collective. We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you use our website and services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-bold text-stone-900">2. Information We Collect</h2>
              <p className="mb-4 text-stone-700 leading-relaxed">
                We may collect the following types of information:
              </p>
              <ul className="mb-4 list-disc pl-6 text-stone-700 space-y-2">
                <li>Personal identification information (name, email address, phone number)</li>
                <li>Account credentials</li>
                <li>Property listing information</li>
                <li>Booking and reservation details</li>
                <li>Payment information</li>
                <li>Communications between users</li>
                <li>Usage data and analytics</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-bold text-stone-900">3. How We Use Your Information</h2>
              <p className="mb-4 text-stone-700 leading-relaxed">
                We use the information we collect to:
              </p>
              <ul className="mb-4 list-disc pl-6 text-stone-700 space-y-2">
                <li>Provide and maintain our services</li>
                <li>Process bookings and payments</li>
                <li>Communicate with you about your account and bookings</li>
                <li>Send promotional communications (with your consent)</li>
                <li>Improve our website and services</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-bold text-stone-900">4. Information Sharing</h2>
              <p className="mb-4 text-stone-700 leading-relaxed">
                We may share your information with:
              </p>
              <ul className="mb-4 list-disc pl-6 text-stone-700 space-y-2">
                <li>Hosts and guests to facilitate bookings</li>
                <li>Service providers who assist in our operations</li>
                <li>Payment processors</li>
                <li>Legal authorities when required by law</li>
              </ul>
              <p className="mb-4 text-stone-700 leading-relaxed">
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-bold text-stone-900">5. Data Security</h2>
              <p className="mb-4 text-stone-700 leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-bold text-stone-900">6. Your Rights</h2>
              <p className="mb-4 text-stone-700 leading-relaxed">
                Depending on your location, you may have the right to:
              </p>
              <ul className="mb-4 list-disc pl-6 text-stone-700 space-y-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Request data portability</li>
                <li>Withdraw consent</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-bold text-stone-900">7. Cookies</h2>
              <p className="mb-4 text-stone-700 leading-relaxed">
                We use cookies and similar tracking technologies to enhance your experience on our website. You can control cookie settings through your browser preferences.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="mb-4 text-xl font-bold text-stone-900">8. Changes to This Policy</h2>
              <p className="mb-4 text-stone-700 leading-relaxed">
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-stone-900">9. Contact Us</h2>
              <p className="mb-4 text-stone-700 leading-relaxed">
                If you have any questions about this privacy policy or our data practices, please contact us at:
              </p>
              <p className="text-stone-700">
                <strong>Email:</strong> privacy@jlmcollective.co
              </p>
            </section>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  )
}
