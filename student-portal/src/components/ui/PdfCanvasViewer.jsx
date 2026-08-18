import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
// Vite's `?worker` import gives back a ready-to-use Worker constructor with module semantics
// already resolved for dev and prod builds — pdfjs's own `.mjs` worker needs `{ type: "module" }`,
// which a plain `workerSrc = <url>` string assignment does not reliably get right under Vite.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'
import Spinner from './Spinner'
import { FileWarning } from 'lucide-react'
import useKeyboardOnlyScroll from '../../hooks/useKeyboardOnlyScroll'

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker()

/**
 * Renders a PDF as a stack of `<canvas>` pages instead of a native `<iframe>` PDF viewer, with
 * all mouse interaction disabled — navigation is keyboard-only (Arrow Up/Down, Page Up/Down,
 * Home/End, Escape to release focus).
 *
 * Why no iframe: an `<iframe>` PDF preview is a separate browsing context. Its right-click menu
 * and Ctrl+S are handled entirely inside that context — events never bubble out to this page's
 * `document`, so proctoring's document-level listeners can't see or block them, and "Save As"
 * stays available regardless of `#toolbar=0`. A canvas is ordinary same-document pixels we
 * control directly.
 *
 * Why no mouse at all: `pointer-events: none` on the scroll container means it is never a valid
 * target for click, right-click, wheel, or drag — the browser skips it during hit-testing
 * entirely, so there is no mouse-driven path to open a context menu, scroll-and-screen-record
 * frame-by-frame, or drag content out. Keyboard scrolling is wired up manually so the content
 * stays fully readable.
 */
export default function PdfCanvasViewer({ url, fileName, className = '' }) {
  const containerRef = useRef(null)
  const [state, setState] = useState({ loading: true, error: null })
  const [fullscreenActive, setFullscreenActive] = useState(() => !!document.fullscreenElement)

  useEffect(() => {
    const onFullscreenChange = () => setFullscreenActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    let renderTasks = []
    setState({ loading: true, error: null })

    async function render() {
      try {
        // pdf.js v6's getDocument() requires an explicit `{ url }` (or `{ data }`) object —
        // it does not accept a bare URL string, despite older versions/examples suggesting so.
        const loadingTask = pdfjsLib.getDocument({ url })
        const pdf = await loadingTask.promise
        if (cancelled || !containerRef.current) return

        containerRef.current.innerHTML = ''
        const containerWidth = containerRef.current.clientWidth || 700

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return
          const page = await pdf.getPage(pageNum)
          const unscaledViewport = page.getViewport({ scale: 1 })
          const scale = containerWidth / unscaledViewport.width
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = 'mx-auto mb-3 block rounded border border-slate-200 shadow-sm'
          containerRef.current.appendChild(canvas)

          const task = page.render({ canvasContext: canvas.getContext('2d'), viewport })
          renderTasks.push(task)
          await task.promise
        }

        if (!cancelled) setState({ loading: false, error: null })
      } catch (err) {
        console.error('PdfCanvasViewer failed to render', fileName, err)
        if (!cancelled) setState({ loading: false, error: 'Could not load this document.' })
      }
    }

    render()

    return () => {
      cancelled = true
      renderTasks.forEach((t) => t.cancel?.())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  useEffect(() => {
    if (!state.loading && !state.error) containerRef.current?.focus()
  }, [state.loading, state.error])

  useKeyboardOnlyScroll(containerRef, { enabled: !state.loading && !state.error, lockWhenFullscreen: true })

  return (
    <div className={`relative ${className}`}>
      {state.loading && (
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 py-16">
          <Spinner />
        </div>
      )}
      {state.error && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-10 text-sm text-slate-500">
          <FileWarning size={20} className="text-slate-400" />
          {state.error}
        </div>
      )}
      <div
        ref={containerRef}
        aria-label={fileName}
        tabIndex={0}
        role="document"
        className={`select-none overflow-y-auto rounded-lg border border-slate-200 bg-slate-100 p-3 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${state.loading || state.error ? 'hidden' : ''}`}
        style={fullscreenActive ? { height: 'calc(100dvh - 8rem)', pointerEvents: 'none' } : { maxHeight: '70vh', pointerEvents: 'none' }}
      />
      {!state.loading && !state.error && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg border border-indigo-300 bg-slate-950 px-4 py-2.5 text-center text-sm font-bold text-white shadow-lg shadow-indigo-950/30">
          {fullscreenActive ? (
            <>
              <span className="text-indigo-200">Navigate with:</span>
              <kbd className="rounded border border-indigo-300/70 bg-indigo-700 px-1.5 py-0.5 text-xs text-white">↑</kbd>
              <kbd className="rounded border border-indigo-300/70 bg-indigo-700 px-1.5 py-0.5 text-xs text-white">↓</kbd>
              <kbd className="rounded border border-indigo-300/70 bg-indigo-700 px-1.5 py-0.5 text-xs text-white">←</kbd>
              <kbd className="rounded border border-indigo-300/70 bg-indigo-700 px-1.5 py-0.5 text-xs text-white">→</kbd>
              <span className="text-indigo-200">· Press</span>
              <kbd className="rounded border border-lime-300 bg-lime-400 px-1.5 py-0.5 text-xs font-extrabold text-slate-950">Esc</kbd>
              <span className="text-indigo-100">to exit fullscreen</span>
            </>
          ) : (
            <span>Use ↑ / ↓ / Page Up / Page Down / Home / End to scroll. Mouse interaction is disabled on protected content.</span>
          )}
        </div>
      )}
    </div>
  )
}
