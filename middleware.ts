import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const canonicalDomainRedirect = redirectApexDomain(request)
  if (canonicalDomainRedirect) {
    return canonicalDomainRedirect
  }

  const response = NextResponse.next({
    request,
  })

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return response
  }

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

function redirectApexDomain(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase()

  if (host !== 'jlmcollective.co') return null

  const url = request.nextUrl.clone()
  url.protocol = 'https:'
  url.hostname = 'www.jlmcollective.co'

  return NextResponse.redirect(url, 308)
}

function isProtectedPath(pathname: string) {
  return pathname === '/become-a-host' || pathname.startsWith('/host/dashboard')
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
