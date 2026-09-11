/** Intrinsic size of both logo files. They share one canvas, so swapping
 *  themes can never shift the layout around them. */
const ASPECT = 553 / 128

const HEIGHTS = { sm: 16, md: 21, lg: 28 } as const

/**
 * Both files are always in the DOM and CSS hides one, rather than picking in
 * JavaScript: ThemeScript stamps `data-theme` before first paint, so the right
 * logo is painted immediately with no flash and no hydration mismatch. The
 * hidden one is `display:none`, which also removes it from the a11y tree —
 * hence the same alt text on both, only ever one of which is exposed.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const height = HEIGHTS[size]
  const width = Math.round(height * ASPECT)

  return (
    <span className="inline-flex shrink-0 items-center" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-dark.png"
        alt="Bellbrief"
        width={width}
        height={height}
        className="bb-logo-dark block h-full w-auto"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-light.png"
        alt="Bellbrief"
        width={width}
        height={height}
        className="bb-logo-light block h-full w-auto"
      />
    </span>
  )
}
