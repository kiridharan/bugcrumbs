import { useSyncExternalStore, type ReactNode } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function subscribeToMotion(onChange: () => void) {
  const query = typeof matchMedia === 'function' ? matchMedia(REDUCED_MOTION) : undefined
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION).matches

export interface BugcrumbsLogoProps {
  /** Rendered width and height in px. */
  size?: number
  /** Animate the crumb trail and legs. Always off when the viewer prefers reduced motion. */
  animated?: boolean
}

const SHELL = '#fbbf24'
const INK = '#111827'
const LIGHT = '#f9fafb'

/**
 * The Bugcrumbs mark: a bug leaving a trail of crumbs. Animated with SVG <animate> elements
 * rather than a <style> tag, so it works under a strict style-src CSP. Decorative: the
 * surrounding control provides the accessible name.
 */
export function BugcrumbsLogo({ size = 28, animated = true }: BugcrumbsLogoProps): ReactNode {
  const reduced = useSyncExternalStore(subscribeToMotion, prefersReducedMotion, () => false)
  const animate = animated && !reduced

  // Each crumb brightens in turn, from the oldest (far) to the newest (by the bug).
  const crumbs = [
    { cx: 3.2, cy: 30, r: 1.5, begin: '0s' },
    { cx: 6.5, cy: 27.2, r: 1.8, begin: '0.3s' },
    { cx: 9.9, cy: 24.3, r: 2, begin: '0.6s' },
  ]
  const legs = (side: -1 | 1) =>
    [11, 14, 17].map((y, i) => (
      <line key={y} x1={20 + side * 4.6} y1={y} x2={20 + side * 7.6} y2={y + (i - 1) * 1.8} />
    ))

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" style={{ display: 'block', overflow: 'visible' }}>
      {crumbs.map((crumb) => (
        <circle key={crumb.cx} cx={crumb.cx} cy={crumb.cy} r={crumb.r} fill={SHELL} opacity={animate ? 0.5 : 0.85}>
          {animate && <animate attributeName="opacity" values="0.5;1;0.5" dur="1.8s" begin={crumb.begin} repeatCount="indefinite" />}
        </circle>
      ))}

      {/* Enlarged and centred; heading up and to the right, away from the trail. */}
      <g transform="translate(-1.5 2) translate(20 13) scale(1.25) translate(-20 -13)">
      <g transform="rotate(40 20 13)">
        <g stroke={LIGHT} strokeWidth={1.4} strokeLinecap="round">
          <g>
            {legs(-1)}
            {animate && <animateTransform attributeName="transform" type="translate" values="0 0;0 -0.9;0 0" dur="0.5s" repeatCount="indefinite" />}
          </g>
          <g>
            {legs(1)}
            {animate && <animateTransform attributeName="transform" type="translate" values="0 -0.9;0 0;0 -0.9" dur="0.5s" repeatCount="indefinite" />}
          </g>
          <path d="M19 5.4 Q17.6 3.4 16.4 2.8 M21 5.4 Q22.4 3.4 23.6 2.8" fill="none" />
        </g>
        <circle cx={20} cy={7} r={2.6} fill={LIGHT} />
        <ellipse cx={20} cy={14.2} rx={5.2} ry={6.4} fill={SHELL} stroke={INK} strokeWidth={0.8} />
        <line x1={20} y1={8.4} x2={20} y2={20.4} stroke={INK} strokeWidth={0.9} />
        <circle cx={17.7} cy={12.4} r={1.15} fill={INK} />
        <circle cx={22.3} cy={13.4} r={1.15} fill={INK} />
        <circle cx={17.9} cy={16.8} r={0.95} fill={INK} />
        <circle cx={22.1} cy={17.6} r={0.95} fill={INK} />
      </g>
      </g>
    </svg>
  )
}
