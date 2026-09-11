import { AuthForm } from '@/components/AuthForm'

/**
 * `next` is read here rather than with `useSearchParams` inside the form. A
 * statically rendered page forces any subtree using that hook to render on the
 * client alone, which left these pages serving an empty shell.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return <AuthForm mode="login" next={next} />
}
