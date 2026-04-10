import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const adminPublicPaths = ['/admin/login', '/admin/forgot-password', '/admin/reset-password']
  const agentPublicPaths = ['/agent/accept-invite']

  if (
    pathname.startsWith('/admin') &&
    !adminPublicPaths.some((p) => pathname.startsWith(p))
  ) {
    if (!user) return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  if (
    pathname.startsWith('/agent') &&
    !agentPublicPaths.some((p) => pathname.startsWith(p))
  ) {
    if (!user) return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/agent/:path*'],
}
