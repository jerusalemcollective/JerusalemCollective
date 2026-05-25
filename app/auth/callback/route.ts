import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/account'

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
          // Ensure profile exists (the trigger should create it, but let's be safe)
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single()

          if (!existingProfile) {
            const fullName = user.user_metadata?.full_name || 
                            user.user_metadata?.name || 
                            user.email?.split('@')[0] || 'User'
            
            await supabase.from('profiles').insert({
              id: user.id,
              full_name: fullName,
              avatar_url: user.user_metadata?.avatar_url || null,
              is_host: user.user_metadata?.is_host || false,
            })
          }

          // If user signed up as host, also create host profile
          if (user.user_metadata?.is_host) {
            const { data: existingHost } = await supabase
              .from('hosts')
              .select('id')
              .eq('id', user.id)
              .single()

            if (!existingHost) {
              const fullName = user.user_metadata?.full_name || 
                              user.user_metadata?.name || 
                              user.email?.split('@')[0] || 'Host'
              
              await supabase.from('hosts').insert({
                id: user.id,
                user_id: user.id,
                name: fullName,
                display_name: fullName.split(' ')[0],
                email: user.email,
                host_type: 'owner',
                show_full_name: false,
                is_verified: false,
              })

              // Mark profile as host
              await supabase
                .from('profiles')
                .update({ is_host: true })
                .eq('id', user.id)
            }
          }
        }
        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch (err) {
      console.error('Auth callback error:', err)
      return NextResponse.redirect(`${origin}/login?error=auth-failed`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
