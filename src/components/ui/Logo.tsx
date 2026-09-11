/** Intrinsic size of both logo files. They share one canvas, so swapping
 *  themes can never shift the layout around them. */
const WIDTH = 553
const HEIGHT = 128

/**
 * At `md` the wordmark is 147px wide, which will not sit beside the theme
 * toggle and the call to action on a 360px screen. Rather than shrink it, the
 * headers that carry it are allowed to wrap, so the size holds at every width.
 */
const HEIGHTS = {
  sm: 'h-[23px]',
  md: 'h-[34px]',
  lg: 'h-[43px]',
} as const

/**
 * Both files are always in the DOM and CSS hides one, rather than picking in
 * JavaScript: ThemeScript stamps `data-theme` before first paint, so the right
 * logo is painted immediately with no flash and no hydration mismatch. The
 * hidden one is `display:none`, which also removes it from the a11y tree —
 * hence the same alt text on both, only ever one of which is exposed.
 */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const height = HEIGHTS[size]

  return (
    <span className={`inline-flex shrink-0 items-center ${height}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-dark.png"
        alt="Bellbrief"
        width={WIDTH}
        height={HEIGHT}
        className="bb-logo-dark block h-full w-auto"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-light.png"
        alt="Bellbrief"
        width={WIDTH}
        height={HEIGHT}
        className="bb-logo-light block h-full w-auto"
      />
    </span>
  )
}
