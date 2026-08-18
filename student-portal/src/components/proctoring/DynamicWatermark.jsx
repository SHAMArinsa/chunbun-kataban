import { useEffect, useId, useState } from 'react'

// A small fixed set of subtly different rotation/offset combinations the watermark cycles
// through over time — makes a static overlay harder to line up and paint out across multiple
// frames of a screen recording, without ever moving so much that it becomes distracting or
// obscures the content underneath.
const PATTERNS = [
  { rotate: -30, offsetX: 0, offsetY: 0 },
  { rotate: -26, offsetX: 40, offsetY: -20 },
  { rotate: -34, offsetX: -30, offsetY: 26 },
  { rotate: -28, offsetX: 16, offsetY: 34 },
]
const PATTERN_INTERVAL_MS = 20000
const TIMESTAMP_INTERVAL_MS = 15000
const TILE_WIDTH = 320
const TILE_HEIGHT = 210

/**
 * Tiled, diagonal, semi-transparent confidentiality watermark identifying the viewing student —
 * and, when available, the server-recorded session code an admin can look up to trace a leaked
 * screenshot/recording back to exactly this viewing. Purpose is traceability, not access control:
 * `pointer-events: none` is load-bearing — this overlay must never block clicks, scrolling, text
 * selection inside inputs, or any other normal interaction with the content beneath it. It must
 * never attach event listeners or report violations of its own.
 *
 * Built as an SVG `<pattern>` (not a finite CSS grid of divs) specifically so it repeats
 * infinitely across whatever height the protected content actually renders at — a fixed number
 * of tiles only covers the first screenful and leaves the watermark missing once a student
 * scrolls a long page (MCQ list, long document, etc.) past that point. A pattern tiles the full
 * `<rect>` it fills, however tall that turns out to be, with no gaps.
 *
 * Deliberately shows the student's real registered email (not masked) — the whole point is that
 * a leaked copy is attributable to the exact account that accessed it.
 */
export default function DynamicWatermark({ studentName, studentEmail, studentId, sessionId, nationalIdType, nationalIdNumber }) {
  const [now, setNow] = useState(() => new Date())
  const [patternIndex, setPatternIndex] = useState(0)
  const patternId = useId()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TIMESTAMP_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setPatternIndex((i) => (i + 1) % PATTERNS.length), PATTERN_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  const timestamp = now.toLocaleString()
  const pattern = PATTERNS[patternIndex]
  const lines = [
    { text: 'ARINSA AI MINDS PVT LTD', weight: 800, size: 11, opacity: 0.09 },
    { text: 'CONFIDENTIAL', weight: 800, size: 13, opacity: 0.13 },
    { text: studentName || '', weight: 600, size: 10, opacity: 0.08 },
    { text: studentEmail || '', weight: 500, size: 10, opacity: 0.08 },
    { text: `STUDENT ID: ${studentId ?? '—'}`, weight: 500, size: 10, opacity: 0.08 },
    ...(nationalIdType && nationalIdNumber
      ? [{ text: `${nationalIdType}: ${nationalIdNumber}`, weight: 500, size: 10, opacity: 0.08 }]
      : []),
    ...(sessionId ? [{ text: `SESSION: ${sessionId}`, weight: 700, size: 10, opacity: 0.09 }] : []),
    { text: timestamp, weight: 400, size: 9, opacity: 0.07 },
  ]

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
      style={{ pointerEvents: 'none', zIndex: 20 }}
    >
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={TILE_WIDTH}
          height={TILE_HEIGHT}
          patternTransform={`rotate(${pattern.rotate}) translate(${pattern.offsetX} ${pattern.offsetY})`}
        >
          <text x={TILE_WIDTH / 2} textAnchor="middle" fill="#0f172a" fontFamily="sans-serif">
            {lines.map((line, i) => (
              <tspan
                key={i}
                x={TILE_WIDTH / 2}
                y={24 + i * 20}
                fontSize={line.size}
                fontWeight={line.weight}
                opacity={line.opacity}
                style={{ textTransform: i < 2 ? 'uppercase' : 'none' }}
              >
                {line.text}
              </tspan>
            ))}
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
