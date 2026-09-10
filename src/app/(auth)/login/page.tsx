import { Suspense } from 'react'
import { AuthForm } from '@/components/AuthForm'

// useSearchParams requires a Suspense boundary or `next build` fails.
export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  )
}
