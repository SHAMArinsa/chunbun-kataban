import { useEffect, useRef, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import useProctoringGuard from '../../hooks/useProctoringGuard'
import { endWatermarkSession, startWatermarkSession } from '../../services/proctoringService'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import DynamicWatermark from './DynamicWatermark'
import SuspensionModal from './SuspensionModal'

const PROHIBITED_ACTIONS = [
  'Copying, cutting, printing, or right-clicking this content',
  'Taking a screenshot (Print Screen, Snip & Sketch, etc.)',
  'Opening browser Developer Tools',
  'Leaving fullscreen, switching tabs/windows, or Alt+Tabbing away',
]

/**
 * Wraps a single protected surface — an MCQ/coding/project assessment, or a protected document
 * viewer — with proctoring detection + watermark. Scoped to exactly its children: mounting this
 * only around the assessment content (not the whole page/layout) means the guard's listeners
 * are attached and torn down with the assessment itself.
 *
 * Every entry point (Preview button, "View Question", opening an assessment page) is gated by a
 * confirmation popup listing exactly what's prohibited and that a confirmed violation may
 * suspend the account — the student must click "I Understand, Proceed" before the watermark,
 * fullscreen, or any protected content ever appears. That same click is also the user gesture the
 * Fullscreen API requires, so it does double duty as the entry trigger.
 *
 * Content visibility (`contentVisible`) and actual OS fullscreen (`fullscreenActive`) are tracked
 * separately: fullscreen is a best-effort enhancement, not a gate the student can get stuck
 * behind. When it succeeds, Escape is the only way out — a real browser guarantee this page can't
 * override. When the browser refuses it (some setups won't grant a deferred `requestFullscreen()`
 * call reliably), the content still shows normally rather than leaving the student stuck.
 *
 */
export default function ProtectedContent({
  children,
  assessmentType = null,
  assessmentId = null,
  attemptId = null,
  resourceId = null,
  sessionId = null,
  className = '',
  viewLabel = 'View Question',
  onCancel = null,
}) {
  const { user } = useAuth()
  const containerRef = useRef(null)
  const wasFullscreenRef = useRef(false)
  const [contentVisible, setContentVisible] = useState(false)
  const [fullscreenActive, setFullscreenActive] = useState(false)
  const [watermarkSessionCode, setWatermarkSessionCode] = useState(null)
  const { suspended } = useProctoringGuard({
    enabled: contentVisible,
    assessmentType,
    assessmentId,
    attemptId,
    resourceId,
    sessionCode: watermarkSessionCode,
    fullscreenActive,
  })

  // Mints a server-recorded session the moment the content actually becomes visible (not while
  // the warning popup is still up — that popup itself isn't protected content) and closes it
  // again whenever content is hidden, whether by Escape, unmount, or navigating away. The code
  // shown in the watermark (and only that code) is what an admin needs to trace a leaked
  // screenshot back to this exact viewing — see Admin → Proctoring → Search Session.
  useEffect(() => {
    if (!contentVisible) return undefined
    let cancelled = false
    let code = null
    startWatermarkSession({ assessmentType, assessmentId, resourceId }).then((c) => {
      if (cancelled) return
      code = c
      setWatermarkSessionCode(c)
    })
    return () => {
      cancelled = true
      setWatermarkSessionCode(null)
      endWatermarkSession(code)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentVisible, assessmentType, assessmentId, resourceId])

  useEffect(() => {
    const onFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement === containerRef.current
      setFullscreenActive(isFullscreen)
      // Only react to an actual *exit* (was fullscreen, now isn't) — not the initial
      // not-fullscreen state before entry was ever attempted, and not the entry transition
      // itself. This is what makes Escape close the content: fullscreen exiting is the only
      // event source for this, since there's no on-screen close button while engaged.
      if (wasFullscreenRef.current && !isFullscreen) {
        // Escape closes the protected preview. Parents unmount it through onCancel, so the
        // acknowledgement notice never remains visible over the underlying page.
        setContentVisible(false)
        onCancel?.()
      }
      wasFullscreenRef.current = isFullscreen
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const acknowledgeAndEnter = () => {
    setContentVisible(true)
    // Fire-and-forget: if the browser denies this (unsupported, permissions policy, a deferred
    // call outside the strict gesture window), the content is already visible above regardless
    // — fullscreen is a bonus, not a requirement to see the content. In that denied case there is
    // no fullscreenchange event to close it again later, so it stays open until `onCancel`.
    containerRef.current?.requestFullscreen?.().catch(() => {})
  }

  // Keep the fullscreen root edge-to-edge. Padding lives on the protected inner surface so the
  // watermark spans every visible pixel, including the area around short assessments.
  return (
    <section
      ref={containerRef}
      className={`protected-content ${fullscreenActive ? 'fixed inset-0 z-[100] h-[100dvh] w-[100dvw] overflow-y-auto overscroll-contain bg-slate-100' : className}`}
    >
      <Modal
        open={!contentVisible}
        onClose={() => onCancel?.()}
        title="Protected Assessment Notice"
        footer={
          <>
            {onCancel && (
              <Button variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button onClick={acknowledgeAndEnter}>I Understand, Proceed</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p className="flex items-start gap-2">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <span>
              This content is monitored and individually watermarked with your name, email, and student ID. If any
              of the following are detected, your account may be <strong>immediately suspended</strong>:
            </span>
          </p>
          <ul className="list-disc space-y-1 pl-9 text-slate-700">
            {PROHIBITED_ACTIONS.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Normal use — scrolling, clicking, selecting answers, typing, and submitting — is never affected. This
            assessment opens in fullscreen mode; press Escape at any time to exit.
          </p>
        </div>
      </Modal>

      {contentVisible && (
        <div
          className={`relative z-30 w-full transition-[filter] ${
            fullscreenActive ? 'min-h-[100dvh] p-6' : ''
          } ${suspended ? 'pointer-events-none select-none blur-xl' : ''}`}
        >
          {children}
          <DynamicWatermark
            studentName={user?.full_name}
            studentEmail={user?.email}
            studentId={user?.student_id}
            sessionId={watermarkSessionCode ?? sessionId}
            nationalIdType={user?.national_id_type}
            nationalIdNumber={user?.national_id_number}
          />
        </div>
      )}
      <SuspensionModal open={suspended} />
    </section>
  )
}
