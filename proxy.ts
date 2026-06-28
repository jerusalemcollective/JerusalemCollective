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
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/host/dashboard') && !isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = '/host/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Defense-in-depth for the remaining private areas. Page/layout guards
  // (requireAdmin, the account layout) remain the primary enforcement; this
  // just stops a signed-out request before any work is done. Login routes are
  // outside these prefixes, so there is no redirect loop.
  if (
    (pathname === '/become-a-host' ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/account')) &&
    !isAuthenticated
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/become-a-host',
    '/host/dashboard/:path*',
    '/admin/:path*',
    '/account/:path*',
  ],
}
