export default function Modal({ open, onClose, title, children, footer, fullScreen = false }) {
  if (!open) return null
  return (
    <div className={`fixed inset-0 z-50 flex bg-black/40 ${fullScreen ? '' : 'items-center justify-center p-4'}`}>
      <div className={`w-full bg-white shadow-xl ${fullScreen ? 'flex h-full flex-col' : 'max-w-lg rounded-xl'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </div>
        <div className={fullScreen ? 'flex-1 overflow-hidden px-6 py-5 sm:px-10' : 'max-h-[70vh] overflow-y-auto px-5 py-4'}>{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}
