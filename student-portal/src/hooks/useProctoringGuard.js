import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { reportViolation } from '../services/proctoringService'

/**
 * Scopes proctoring detection to a single mounted protected surface (an MCQ/coding/project
 * assessment, or a protected document viewer). Only ever listens for the specific, narrow
 * signals below — never generic pointer/scroll/touch handlers — so normal interaction
 * (left-click, scroll, touch, arrow keys, clicking options, uploading files, Next/Prev/Submit)
 * is never touched, intercepted, or treated as suspicious.
 *
 * Confirmed violations (immediately backend-evaluated, may suspend the student — genuinely
 * observable browser events only, never inferred from focus/visibility):
 *   COPY_ATTEMPT, RIGHT_CLICK_ATTEMPT, PRINT_ATTEMPT, SAVE_ATTEMPT,
 *   DEVTOOLS_SHORTCUT_ATTEMPT, PRINTSCREEN_KEY_ATTEMPT, PROTECTED_DOWNLOAD_ATTEMPT
 *
 * Suspicious (recorded only, never auto-suspend — inconclusive by nature; a browser cannot know
 * *why* focus or visibility changed, so these are audit signals for admin review, not proof of
 * anything):
 *   TAB_HIDDEN, WINDOW_FOCUS_LOST, FULLSCREEN_EXIT
 *
 * All keyboard/clipboard/context-menu listeners are registered in the *capture* phase
 * (`{ capture: true }`), not the default bubble phase — this means they see every relevant event
 * on its way down to the target before any nested element (e.g. a future rich-text or code-editor
 * widget) has a chance to call `stopPropagation()` and hide it from us.
 */
export default function useProctoringGuard({
  enabled = true,
  assessmentType = null,
  assessmentId = null,
  attemptId = null,
  resourceId = null,
  sessionCode = null,
  fullscreenActive = false,
} = {}) {
  const [suspended, setSuspended] = useState(false)
  const wasFullscreenRef = useRef(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Mirrors the `fullscreenActive` prop into a ref so the blur/visibility/fullscreen listeners
  // (bound once per `enabled` change, not per fullscreen toggle) always read the current value
  // without needing to re-bind every listener each time fullscreen state flips.
  const fullscreenActiveRef = useRef(fullscreenActive)
  useEffect(() => {
    fullscreenActiveRef.current = fullscreenActive
  }, [fullscreenActive])
  // The watermark session code is minted asynchronously (a beat after content becomes visible),
  // so a ref lets `report` always send whatever is current without needing to re-bind every
  // listener each time it changes.
  const sessionCodeRef = useRef(sessionCode)
  useEffect(() => {
    sessionCodeRef.current = sessionCode
  }, [sessionCode])

  const report = useCallback(
    async (violationType, metadata = {}) => {
      const result = await reportViolation({
        violationType,
        assessmentType,
        assessmentId,
        attemptId,
        resourceId,
        sessionCode: sessionCodeRef.current,
        metadata,
      })
      if (result?.suspended) {
        setSuspended(true)
        // The enrollment status flip already happened server-side — without this, PaymentGate
        // and Layout keep reading their cached ['enrollments','me'] result and never notice
        // the account is now suspended, letting the student keep interacting with the page
        // until something else happens to refetch it. Force the redirect immediately too,
        // rather than waiting on the modal's button click, so lockout is not optional.
        await queryClient.invalidateQueries({ queryKey: ['enrollments', 'me'] })
        navigate('/support', { replace: true })
      }
    },
    [assessmentType, assessmentId, attemptId, resourceId, queryClient, navigate]
  )

  useEffect(() => {
    if (!enabled) return undefined

    // Copying/right-clicking inside a form field (typing a repo link, pasting into a textarea,
    // selecting text they wrote themselves) is normal interaction with the student's own answer
    // — never the protected question/document content — so it must never be blocked or reported.
    const isEditableTarget = (target) =>
      !!target?.closest?.('input, textarea, select, [contenteditable="true"]')

    // Builds a human-readable "which keys were actually detected" string for the audit trail —
    // used on every confirmed keyboard-driven event, not just PrintScreen, per the requirement
    // that stored events include "Detected keys, when available".
    const describeKeyEvent = (e, keyLabel) => {
      const parts = []
      if (e.metaKey) parts.push('Windows')
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      parts.push(keyLabel)
      return parts.join(' + ')
    }

    const onContextMenu = (e) => {
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      report('RIGHT_CLICK_ATTEMPT')
    }

    const onCopy = (e) => {
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      report('COPY_ATTEMPT')
    }

    const onCut = (e) => {
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      report('COPY_ATTEMPT')
    }

    const onBeforePrint = () => {
      report('PRINT_ATTEMPT')
    }

    // Silent deterrent, not a logged violation — dragging text/images out of the protected area
    // (e.g. onto the desktop, or into another app) is blocked the same way normal browsers
    // already block dragging out of, say, a bank's transaction table. Doesn't touch drags that
    // originate in the student's own form fields (dragging selected text within a textarea).
    const onDragStart = (e) => {
      if (isEditableTarget(e.target)) return
      e.preventDefault()
    }

    const screenshotOrRecordingShortcut = (e) => {
      const keyLower = (e.key || '').toLowerCase()
      const hasWindowsKey = e.metaKey || e.getModifierState?.('Meta')

      if (hasWindowsKey && e.shiftKey && keyLower === 's') return 'Windows + Shift + S'
      if (hasWindowsKey && e.altKey && keyLower === 'r') return 'Windows + Alt + R'
      if (hasWindowsKey && !e.altKey && !e.ctrlKey && !e.shiftKey && keyLower === 'g') return 'Windows + G'
      return null
    }

    const onKeyDown = (e) => {
      const key = e.key
      const keyLower = key.toLowerCase()
      const ctrlOrCmd = e.ctrlKey || e.metaKey

      // Print
      if (ctrlOrCmd && keyLower === 'p') {
        e.preventDefault()
        report('PRINT_ATTEMPT', { key_combo: describeKeyEvent(e, 'P') })
        return
      }
      // Save (Ctrl+S on Windows, Cmd+S on Mac) — excludes Shift so it doesn't collide with
      // Windows+Shift+S (Snip & Sketch), handled separately below as a screenshot shortcut.
      if (ctrlOrCmd && keyLower === 's' && !e.shiftKey) {
        e.preventDefault()
        report('SAVE_ATTEMPT', { key_combo: describeKeyEvent(e, 'S') })
        return
      }
      // DevTools shortcuts: F12, Ctrl+Shift+I/J/C, Cmd+Opt+I/J/C
      if (
        key === 'F12' ||
        (ctrlOrCmd && e.shiftKey && ['i', 'j', 'c'].includes(keyLower)) ||
        (e.altKey && e.metaKey && ['i', 'j', 'c'].includes(keyLower))
      ) {
        e.preventDefault()
        report('DEVTOOLS_SHORTCUT_ATTEMPT', { key_combo: describeKeyEvent(e, key === 'F12' ? 'F12' : keyLower.toUpperCase()) })
        return
      }

      // Windows + Shift + S (Snip & Sketch), Windows + G (Xbox Game Bar), Windows + Alt + R
      // (Game Bar record toggle). These are normally claimed by Windows as global hotkeys and
      // consumed before any browser window — including this one — ever receives a keyboard
      // event for them; when that's the case, no code anywhere can see or block it, on this or
      // any other website, and this app never claims otherwise. This handler exists purely as a
      // fallback for the systems/configurations where that OS-level interception isn't active
      // and the keydown does reach the page — matched case-insensitively since the letter can
      // arrive as either case depending on Shift/Caps state.
      const shortcut = screenshotOrRecordingShortcut(e)
      if (shortcut) {
        report('PRINTSCREEN_KEY_ATTEMPT', { key_combo: shortcut })
        return
      }
      // Bare PrintScreen (and any modifier+PrintScreen combo) is handled on 'keyup' below, not
      // here — see that handler for why.
    }

    // Many Chromium-based browsers never fire a 'keydown' for the standalone PrintScreen key at
    // all (a long-standing, well-documented quirk) — only 'keyup' reliably fires for it. Modifier
    // combos (Ctrl/Alt/Shift+PrtScn) usually do fire keydown, so this keyup handler is the
    // catch-all: it fires for every case, and reportViolation's client-side throttle plus the
    // backend's own dedupe window collapse any combo that happens to fire both. Whatever
    // modifiers are still held at keyup are exactly what the browser was able to observe — combos
    // the OS intercepts as a global hotkey before any web page sees them (Win+PrtScn,
    // Win+Alt+PrtScn, Win+Shift+S, Win+G, Win+Alt+R, etc.) never reach this handler at all;
    // there's no event to special-case for those, they simply never fire, on this or any other
    // website — reported here only when the browser genuinely receives a "PrintScreen event".
    const onProtectedShortcutKeyUp = (e) => {
      // `code` identifies the physical Print Screen key and is more stable than `key` across
      // keyboard layouts. Some browsers report its translated key value as "Snapshot" instead.
      // Fn is hardware-level and is intentionally not named here: Fn+PrtSc reaches the browser
      // as the same PrintScreen event and is therefore covered by this one check.
      const isPrintScreen = e.code === 'PrintScreen' || e.key === 'PrintScreen' || e.key === 'Snapshot'
      if (isPrintScreen) {
        report('PRINTSCREEN_KEY_ATTEMPT', { key_combo: describeKeyEvent(e, 'PrintScreen') })
        return
      }

      // A few browser/keyboard combinations deliver these keys only on keyup. Treat them the
      // same as keydown; the reporting throttle prevents a duplicate report when both fire.
      const shortcut = screenshotOrRecordingShortcut(e)
      if (shortcut) report('PRINTSCREEN_KEY_ATTEMPT', { key_combo: shortcut })
    }

    // Suspicious, not confirmed: a browser genuinely cannot tell *why* it lost focus or
    // visibility — alt-tabbing to check notes, an OS notification popping up, another app
    // stealing focus, and Win+Shift+S all look identical from here. These are logged as audit
    // signals only; `enforcement` (auto-suspend) never happens for this category — see
    // proctoring_service.py's CONFIRMED_VIOLATIONS / SUSPICIOUS_EVENTS split, which is the
    // actual, server-side source of truth for what can and can't trigger suspension.
    //
    // `reportWindowLeft` additionally fires a distinct ASSESSMENT_WINDOW_LEFT event whenever any
    // of these three signals happens while the assessment is in its mandatory-fullscreen mode —
    // this is the "the student left the fullscreen assessment window" signal the policy actually
    // cares about (Alt+Tab, Task View, switching to another app/window all produce one of these
    // three observable events; JavaScript cannot and does not claim to identify Alt+Tab itself as
    // a keystroke — Windows may consume it before the browser ever sees a key event). The
    // specific TAB_HIDDEN/WINDOW_FOCUS_LOST/FULLSCREEN_EXIT type is still reported too, so the
    // audit trail keeps both the precise signal and the higher-level "left the assessment" one.
    const reportWindowLeft = (source) => {
      if (!fullscreenActiveRef.current) return
      report('ASSESSMENT_WINDOW_LEFT', {
        source,
        previous_fullscreen_state: true,
        visibility_state: document.visibilityState,
        focus_state: document.hasFocus(),
      })
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        report('TAB_HIDDEN')
        reportWindowLeft('visibilitychange')
      }
    }

    const onBlur = () => {
      report('WINDOW_FOCUS_LOST')
      reportWindowLeft('blur')
    }

    const onFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement
      if (wasFullscreenRef.current && !isFullscreen) {
        report('FULLSCREEN_EXIT')
        reportWindowLeft('fullscreenchange')
      }
      wasFullscreenRef.current = isFullscreen
    }

    // `{ capture: true }` on every keyboard/clipboard/context-menu listener: capture-phase
    // listeners run on the way *down* to the event's target, before bubble-phase listeners and
    // before anything nested could call stopPropagation() to keep the event from ever reaching a
    // bubble-phase listener on `document`. Focus/visibility/fullscreen events don't bubble in a
    // way this applies to, so those stay as simple listeners.
    document.addEventListener('contextmenu', onContextMenu, { capture: true })
    document.addEventListener('copy', onCopy, { capture: true })
    document.addEventListener('cut', onCut, { capture: true })
    document.addEventListener('dragstart', onDragStart, { capture: true })
    document.addEventListener('keydown', onKeyDown, { capture: true })
    document.addEventListener('keyup', onProtectedShortcutKeyUp, { capture: true })
    window.addEventListener('beforeprint', onBeforePrint)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFullscreenChange)

    return () => {
      document.removeEventListener('contextmenu', onContextMenu, { capture: true })
      document.removeEventListener('copy', onCopy, { capture: true })
      document.removeEventListener('cut', onCut, { capture: true })
      document.removeEventListener('dragstart', onDragStart, { capture: true })
      document.removeEventListener('keydown', onKeyDown, { capture: true })
      document.removeEventListener('keyup', onProtectedShortcutKeyUp, { capture: true })
      window.removeEventListener('beforeprint', onBeforePrint)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [enabled, report])

  const reportProtectedDownloadAttempt = useCallback(
    (metadata) => report('PROTECTED_DOWNLOAD_ATTEMPT', metadata),
    [report]
  )

  return { suspended, reportProtectedDownloadAttempt }
}
