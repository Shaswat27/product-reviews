// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // Always allow static assets and the auth callback to pass through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname === '/favicon.ico' ||
    pathname === '/auth/callback' ||
    pathname === '/check-email'
  ) {
    return NextResponse.next()
  }

  // We'll mutate cookies on this response when Supabase sets them
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // NEW pattern: read all request cookies
        getAll: () => req.cookies.getAll(),
        // NEW pattern: batch-set response cookies
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
    // already signed in? send them to their redirect (or dashboard)
    if (session) {
      const url = req.nextUrl.clone()
      const params = new URLSearchParams(search)
      url.pathname = params.get('redirect') || '/dashboard'
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

  // Signed in → proceed
  return res
}

export const config = {
  // protect everything except API & static
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}