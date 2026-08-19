import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Eye } from 'lucide-react'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'
import FilePreview from '../components/ui/FilePreview'
import ProtectedContent from '../components/proctoring/ProtectedContent'

export default function Materials() {
  const [previewing, setPreviewing] = useState(null) // { id, title, file_type }

  const { data: materials, isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: () => apiClient.get('/materials').then((r) => r.data),
  })

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Learning Materials</h1>
        <p className="mt-1 text-sm text-slate-500">
          Since this is an internship program, learning material is intentionally limited. To access comprehensive
          learning resources, please enroll in our Platinum Program.
        </p>
      </div>

      {materials?.length ? (
        <div className="space-y-3">
          {materials.map((m) => (
            <Card key={m.id} className="rounded-2xl border-brand-100 bg-gradient-to-r from-white via-white to-brand-50/50 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-xl bg-brand-100 p-3 text-brand-600">
                    <FileText size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold text-brand-800">{m.title}</p>
                    <p className="text-sm font-semibold uppercase tracking-wide text-brand-500">{m.file_type}</p>
                    {m.description && <p className="mt-1 text-base text-slate-600">{m.description}</p>}
                  </div>
                </div>
                <Button variant="secondary" className="shrink-0 !px-5 !py-3 !text-base" onClick={() => setPreviewing(m)}><Eye size={18} /> Preview</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center text-sm text-slate-500">No materials assigned to you yet.</Card>
      )}

      {previewing && (
        <ProtectedContent
          key={previewing.id}
          assessmentType="material"
          assessmentId={previewing.id}
          resourceId={previewing.id}
          viewLabel="View Material"
          onCancel={() => setPreviewing(null)}
          autoEnter
        >
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{previewing.title}</h2>
          <FilePreview
            fetcher={() => apiClient.get(`/materials/${previewing.id}/download`, { responseType: 'blob' })}
            fileName={`${previewing.title}.${previewing.file_type}`}
          />
        </ProtectedContent>
      )}
    </div>
  )
}
