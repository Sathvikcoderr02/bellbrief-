import { NextResponse } from 'next/server'
import { z } from 'zod'
import { attachSession } from '@/lib/auth/cookie'
import { rateLimit } from '@/lib/auth/rateLimit'
import { loginUser } from '@/lib/auth/service'

const body = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'local'
  if (!rateLimit(`login:${ip}`, 8).ok) {
    return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
  }

  const parsed = body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  try {
    const { userId } = await loginUser(parsed.data)
    return attachSession(NextResponse.json({ ok: true }), userId)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 })
  }
}
