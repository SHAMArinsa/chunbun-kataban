import apiClient from '../api/client'

// Client-side throttle only exists to avoid flooding the network with duplicate requests for
// the exact same (violation_type, resource) pair in quick succession (e.g. a user mashing a
// keyboard shortcut). It is NOT a security control — the backend is the sole authority on
// severity/suspension and re-dedupes independently server-side.
const recentlySent = new Map()
const CLIENT_THROTTLE_MS = 800

function throttleKey(violationType, resourceId, assessmentId) {
  return `${violationType}::${resourceId ?? ''}::${assessmentId ?? ''}`
}

/**
 * Reports a proctoring violation to the backend. Fire-and-forget from the caller's perspective,
 * but returns the response so callers (useProctoringGuard) can react to `suspended: true`.
 */
export async function reportViolation({
  violationType,
  assessmentType = null,
  assessmentId = null,
  attemptId = null,
  resourceId = null,
  sessionCode = null,
  metadata = {},
}) {
  const key = throttleKey(violationType, resourceId, assessmentId)
  const now = Date.now()
  const last = recentlySent.get(key)
  if (last && now - last < CLIENT_THROTTLE_MS) {
    return null
  }
  recentlySent.set(key, now)

  try {
    const { data } = await apiClient.post('/proctoring/violation', {
      violation_type: violationType,
      assessment_type: assessmentType,
      assessment_id: assessmentId,
      attempt_id: attemptId,
      resource_id: resourceId,
      session_code: sessionCode,
      route: window.location.pathname,
      metadata,
    })
    return data
  } catch {
    // Never let a proctoring report failure interrupt the student's assessment flow.
    return null
  }
}

/**
 * Starts a server-recorded watermark session the moment protected content becomes visible —
 * mints the short code (e.g. "A8F2K91") embedded in the on-screen watermark, so a leaked
 * screenshot/recording can be traced back via Admin → Proctoring → Search Session. Best-effort:
 * if this fails, the watermark still shows the student's name/email/ID, just without a session
 * code — never blocks the student from seeing their content.
 */
export async function startWatermarkSession({ assessmentType = null, assessmentId = null, resourceId = null }) {
  try {
    const { data } = await apiClient.post('/proctoring/session/start', {
      assessment_type: assessmentType,
      assessment_id: assessmentId,
      resource_id: resourceId,
      route: window.location.pathname,
    })
    return data?.session_code ?? null
  } catch {
    return null
  }
}

/** Fire-and-forget close of a watermark session (e.g. on unmount). Never awaited by the caller. */
export function endWatermarkSession(sessionCode) {
  if (!sessionCode) return
  apiClient.post(`/proctoring/session/${sessionCode}/end`).catch(() => {})
}
