import { Upload } from 'lucide-react'

export default function FileUpload({ label, onChange, accept = '.pdf,.docx,.zip,.jpg,.jpeg,.png', fileName, hint, multiple = false }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <div className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600">
        <Upload size={16} />
        <span>{fileName || hint || 'PDF, DOCX, ZIP, JPG, JPEG, or PNG'}</span>
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => onChange(multiple ? Array.from(e.target.files ?? []) : (e.target.files?.[0] ?? null))}
        />
      </div>
    </label>
  )
}
