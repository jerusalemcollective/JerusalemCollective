import { createClient } from '@/lib/supabase/server'
import { ensureHostProfile } from '@/lib/host-profile'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  if (code || (tokenHash && type)) {
    try {
      const supabase = await createClient()
      const { error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({
            token_hash: tokenHash!,
            type: type!,
          })

      if (!error) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          try {
            await ensureHostProfile(supabase, user)
          } catch (profileError) {
            console.error('Could not create host profile after verification:', profileError)
          }
        }
        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch {
      return NextResponse.redirect(`${origin}/host/login?error=supabase-not-configured`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
