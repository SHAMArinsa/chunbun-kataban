import { useEffect, useRef, useState } from 'react'
import { FileWarning } from 'lucide-react'
import Spinner from './Spinner'
import PdfCanvasViewer from './PdfCanvasViewer'
import useProctoringGuard from '../../hooks/useProctoringGuard'
import useKeyboardOnlyScroll from '../../hooks/useKeyboardOnlyScroll'
import DynamicWatermark from '../proctoring/DynamicWatermark'
import { useAuth } from '../../context/AuthContext'

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const SHEET_EXTS = ['xlsx', 'xls', 'csv']

function extOf(name) {
  return (name || '').toLowerCase().split('.').pop()
}

/** Fetches a file via `fetcher` (must return an axios-style response with `data` as a Blob) and
 * renders an inline preview matching the file type — no download step.
 *
 * Pass `protect` (plus `assessmentType`/`assessmentId`/`attemptId`/`resourceId`) when this
 * preview is standalone protected content (not already nested inside a `ProtectedContent`
 * wrapper) — it turns on copy/right-click/print/save/devtools detection and a watermark overlay
 * for as long as this component stays mounted. Defaults to false so unrelated, non-assessment
 * usages (e.g. course materials) are completely unaffected. */
export default function FilePreview({
  fetcher,
  fileName,
  className = '',
  protect = false,
  assessmentType = null,
  assessmentId = null,
  attemptId = null,
  resourceId = null,
}) {
  const [state, setState] = useState({ loading: true, error: null, kind: null, payload: null })
  const objectUrlRef = useRef(null)
  const scrollRef = useRef(null)
  const { user } = useAuth()
  useProctoringGuard({
    enabled: protect,
    assessmentType,
    assessmentId,
    attemptId,
    resourceId: resourceId ?? fileName,
  })
  // Non-PDF kinds (image/sheet/docx/text) get the same no-mouse, keyboard-only-scroll treatment
  // as PdfCanvasViewer — every real usage of FilePreview sits inside a fullscreen
  // ProtectedContent wrapper, so consistent mouse lockout is expected everywhere here, not just
  // for PDFs. The 'pdf' kind handles this itself inside PdfCanvasViewer.
  useKeyboardOnlyScroll(scrollRef, {
    enabled: !state.loading && !state.error && state.kind !== 'pdf',
    lockWhenFullscreen: true,
  })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, error: null, kind: null, payload: null })

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    const ext = extOf(fileName)

    fetcher()
      .then(async (res) => {
        if (cancelled) return
        const blob = res.data

        if (ext === 'pdf') {
          const url = URL.createObjectURL(blob)
          objectUrlRef.current = url
          setState({ loading: false, error: null, kind: 'pdf', payload: url })
          return
        }

        if (IMAGE_EXTS.includes(ext)) {
          const url = URL.createObjectURL(blob)
          objectUrlRef.current = url
          setState({ loading: false, error: null, kind: 'image', payload: url })
          return
        }

        if (SHEET_EXTS.includes(ext)) {
          const XLSX = await import('xlsx')
          const buf = await blob.arrayBuffer()
          const workbook = XLSX.read(buf, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, blankrows: false })
          if (cancelled) return
          setState({ loading: false, error: null, kind: 'sheet', payload: rows })
          return
        }

        if (ext === 'docx') {
          const mammoth = await import('mammoth')
          const buf = await blob.arrayBuffer()
          const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf })
          if (cancelled) return
          setState({ loading: false, error: null, kind: 'docx', payload: html })
          return
        }

        if (ext === 'txt') {
          const text = await blob.text()
          if (cancelled) return
          setState({ loading: false, error: null, kind: 'text', payload: text })
          return
        }

        setState({ loading: false, error: null, kind: 'unsupported', payload: null })
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, error: 'Could not load this file.', kind: null, payload: null })
      })

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName])

  if (state.loading) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 py-16 ${className}`}>
        <Spinner />
      </div>
    )
  }

  if (state.error) {
    return (
      <div className={`flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-10 text-sm text-slate-500 ${className}`}>
        <FileWarning size={20} className="text-slate-400" />
        {state.error}
      </div>
    )
  }

  if (state.kind === 'pdf') {
    // Always rendered via PdfCanvasViewer (pdf.js -> <canvas>), never a native <iframe> viewer:
    // an iframe is a separate browsing context whose own right-click "Save As" and Ctrl+S are
    // handled inside it, invisible to this page's proctoring listeners — #toolbar=0 only hides
    // chrome, it doesn't block those actions (nor two-finger-tap "save" gestures some trackpads
    // map to it). A canvas is ordinary same-document pixels, so this page's document-level
    // contextmenu/keydown handlers (active whenever a parent enables `protect`, e.g. via the
    // surrounding ProtectedContent wrapper) already cover it, and there's no "Save Image As" the
    // way there is for an <img>.
    return (
      <div className="relative">
        <PdfCanvasViewer url={state.payload} fileName={fileName} className={className} />
        {protect && (
          <DynamicWatermark studentName={user?.full_name} studentEmail={user?.email} studentId={user?.student_id} nationalIdType={user?.national_id_type} nationalIdNumber={user?.national_id_number} />
        )}
      </div>
    )
  }

  if (state.kind === 'image') {
    return (
      <div className="relative">
        <div
          ref={scrollRef}
          tabIndex={0}
          role="document"
          aria-label={fileName}
          className={`overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${className}`}
          style={{ pointerEvents: 'none' }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={state.payload}
            alt={fileName}
            draggable={false}
            className="mx-auto max-h-[70vh] max-w-full select-none"
          />
        </div>
        {protect && (
          <DynamicWatermark studentName={user?.full_name} studentEmail={user?.email} studentId={user?.student_id} nationalIdType={user?.national_id_type} nationalIdNumber={user?.national_id_number} />
        )}
        <p className="mt-1 text-center text-[11px] text-slate-400">
          Use ↑ / ↓ / Page Up / Page Down / Home / End to scroll. Mouse interaction is disabled on protected content.
        </p>
      </div>
    )
  }

  if (state.kind === 'sheet') {
    const [header, ...body] = state.payload
    return (
      <div>
        <div
          ref={scrollRef}
          tabIndex={0}
          role="document"
          aria-label={fileName}
          className={`max-h-[70vh] select-none overflow-auto rounded-lg border border-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${className}`}
          style={{ pointerEvents: 'none' }}
          onContextMenu={(e) => e.preventDefault()}
          onCopy={(e) => e.preventDefault()}
        >
          <table className="w-full border-collapse text-sm">
            {header && (
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  {header.map((cell, i) => (
                    <th key={i} className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">{cell ?? ''}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="odd:bg-white even:bg-slate-50/60">
                  {(header ?? row).map((_, ci) => (
                    <td key={ci} className="border border-slate-200 px-3 py-1.5 text-slate-700">{row[ci] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-center text-[11px] text-slate-400">
          Use ↑ / ↓ / Page Up / Page Down / Home / End to scroll. Mouse interaction is disabled on protected content.
        </p>
      </div>
    )
  }

  if (state.kind === 'docx') {
    return (
      <div>
        <div
          ref={scrollRef}
          tabIndex={0}
          role="document"
          aria-label={fileName}
          className={`prose prose-sm max-h-[70vh] max-w-none select-none overflow-auto rounded-lg border border-slate-200 bg-white p-5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${className}`}
          style={{ pointerEvents: 'none' }}
          onContextMenu={(e) => e.preventDefault()}
          onCopy={(e) => e.preventDefault()}
          dangerouslySetInnerHTML={{ __html: state.payload }}
        />
        <p className="mt-1 text-center text-[11px] text-slate-400">
          Use ↑ / ↓ / Page Up / Page Down / Home / End to scroll. Mouse interaction is disabled on protected content.
        </p>
      </div>
    )
  }

  if (state.kind === 'text') {
    return (
      <div>
        <pre
          ref={scrollRef}
          tabIndex={0}
          role="document"
          aria-label={fileName}
          className={`max-h-[70vh] select-none overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${className}`}
          style={{ pointerEvents: 'none' }}
          onContextMenu={(e) => e.preventDefault()}
          onCopy={(e) => e.preventDefault()}
        >
          {state.payload}
        </pre>
        <p className="mt-1 text-center text-[11px] text-slate-400">
          Use ↑ / ↓ / Page Up / Page Down / Home / End to scroll. Mouse interaction is disabled on protected content.
        </p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-10 text-sm text-slate-500 ${className}`}>
      <FileWarning size={20} className="text-slate-400" />
      Preview not available for this file type ({fileName}).
    </div>
  )
}
