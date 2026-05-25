import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return protectRoute(request, response, false)
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return protectRoute(request, response, Boolean(user))
}

function protectRoute(
  request: NextRequest,
  response: NextResponse,
  isAuthenticated: boolean,
) {
  if (
    request.nextUrl.pathname.startsWith('/host/dashboard') &&
    !isAuthenticated
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/host/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (
    request.nextUrl.pathname === '/become-a-host' &&
    !isAuthenticated
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/become-a-host',
    '/host/dashboard/:path*',
  ],
}
