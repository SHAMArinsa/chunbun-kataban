import { useEffect } from 'react'

const LINE_STEP = 80

/**
 * Scrolls a container via Arrow Up/Down, Page Up/Down, Home, End only — paired with
 * `pointer-events: none` on that same container (applied by the caller), this makes the
 * container fully unreachable by mouse: no click, right-click, wheel, drag, or scrollbar drag
 * can hit it, since the browser skips it entirely during pointer hit-testing. Escape blurs it.
 *
 * Listens at the window level rather than requiring the container to hold DOM focus: since the
 * container can't be focused by a mouse click (pointer-events: none blocks that), relying on
 * focus would leave it permanently unscrollable if focus ever landed elsewhere. Skips normal
 * typing targets (input/textarea/select/contenteditable) so it never hijacks arrow-key use
 * inside actual form fields elsewhere on the page.
 */
export default function useKeyboardOnlyScroll(containerRef, { enabled = true, lockWhenFullscreen = false } = {}) {
  useEffect(() => {
    if (!enabled) return undefined

    const isEditableTarget = (target) =>
      !!target?.closest?.('input, textarea, select, [contenteditable="true"]')

    const onKeyDown = (e) => {
      const el = containerRef.current
      if (!el) return
      if (isEditableTarget(e.target)) return

      // Fullscreen document previews are read-only: navigation is restricted to the arrow keys
      // and Escape. This option is only enabled by FilePreview/PdfCanvasViewer, never forms.
      const fullscreenLockActive = lockWhenFullscreen && !!document.fullscreenElement
      const arrowKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      const permittedFullscreenKey = (arrowKey || e.key === 'Escape') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey
      if (fullscreenLockActive && !permittedFullscreenKey) {
        e.preventDefault()
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          el.scrollTop += LINE_STEP
          break
        case 'ArrowUp':
          e.preventDefault()
          el.scrollTop -= LINE_STEP
          break
        case 'ArrowRight':
          e.preventDefault()
          el.scrollLeft += LINE_STEP
          break
        case 'ArrowLeft':
          e.preventDefault()
          el.scrollLeft -= LINE_STEP
          break
        case 'PageDown':
          if (fullscreenLockActive) break
          e.preventDefault()
          el.scrollTop += el.clientHeight * 0.9
          break
        case 'PageUp':
          if (fullscreenLockActive) break
          e.preventDefault()
          el.scrollTop -= el.clientHeight * 0.9
          break
        case 'Home':
          if (fullscreenLockActive) break
          e.preventDefault()
          el.scrollTop = 0
          break
        case 'End':
          if (fullscreenLockActive) break
          e.preventDefault()
          el.scrollTop = el.scrollHeight
          break
        case 'Escape':
          el.blur()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [containerRef, enabled])
}
