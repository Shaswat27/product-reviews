// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // Expand the public paths to include auth-related routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname === '/favicon.ico' ||
    pathname === '/auth/callback' ||
    pathname === '/check-email' ||
    pathname.includes('/auth/v1') // Add this line to allow Supabase auth endpoints
  ) {
    return NextResponse.next()
  }

  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If user hits /login:
  if (pathname === '/login') {
    // Check if there's an error parameter in the URL
    const params = new URLSearchParams(search)
    const error = params.get('error')

    // If there's an error but we have a session, redirect to dashboard
    if (error && session) {
      const url = req.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }

    // already signed in? send them to their redirect (or dashboard)
    if (session) {
      const url = req.nextUrl.clone()
      const params = new URLSearchParams(search)
      const redirectTo = params.get('redirect') || '/dashboard'
      url.pathname = redirectTo
      url.search = ''
      return NextResponse.redirect(url)
    }

    // not signed in → allow /login to render
    return res
  }

  // For all other app routes, require auth
  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?redirect=${encodeURIComponent(pathname + (search || ''))}`
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}