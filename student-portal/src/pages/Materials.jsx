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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m) => (
            <Card key={m.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-50 p-2 text-brand-600">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.title}</p>
                  <p className="text-xs uppercase text-slate-400">{m.file_type}</p>
                </div>
              </div>
              {m.description && <p className="text-xs text-slate-500">{m.description}</p>}
              <Button variant="secondary" className="mt-auto" onClick={() => setPreviewing(m)}>
                <Eye size={15} /> Preview
              </Button>
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
