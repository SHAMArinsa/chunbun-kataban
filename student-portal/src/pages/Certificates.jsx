import { useQuery } from '@tanstack/react-query'
import { Award, Download, FileText, ReceiptText } from 'lucide-react'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'

const TYPE_META = {
  invoice: { label: 'Invoice', icon: ReceiptText },
  welcome_certificate: { label: 'Welcome Certificate', icon: Award },
  certificate: { label: 'Certificate', icon: Award },
}

export default function Certificates() {
  const { data: documents, isLoading } = useQuery({
    queryKey: ['student-documents', 'me'],
    queryFn: () => apiClient.get('/student-documents/me').then((r) => r.data),
  })

  const download = async (document) => {
    const res = await apiClient.get(`/student-documents/${document.id}/download`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(res.data)
    const link = window.document.createElement('a')
    link.href = url
    link.download = document.file_name
    link.click()
    window.URL.revokeObjectURL(url)
  }

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Certificates &amp; Invoices</h1>
        <p className="text-sm text-slate-500">Documents personally uploaded for you by the ARINSA AI MINDS administration.</p>
      </div>

      {documents?.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => {
            const meta = TYPE_META[doc.document_type] ?? { label: 'Document', icon: FileText }
            const Icon = meta.icon
            return (
              <Card key={doc.id} className="flex min-h-52 flex-col gap-3 p-5">
                <div className="w-fit rounded-lg bg-brand-50 p-2 text-brand-600"><Icon size={20} /></div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{meta.label}</p>
                  <h2 className="mt-1 text-base font-semibold text-slate-900">{doc.title}</h2>
                  <p className="mt-2 text-xs text-slate-500">Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</p>
                </div>
                <Button variant="secondary" className="mt-auto" onClick={() => download(doc)}><Download size={15} /> Download PDF</Button>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="p-10 text-center">
          <FileText className="mx-auto mb-3 text-slate-300" size={32} />
          <p className="text-sm font-medium text-slate-700">No documents available yet</p>
          <p className="mt-1 text-sm text-slate-500">Your invoices and certificates will appear here after an administrator uploads them for you.</p>
        </Card>
      )}
    </div>
  )
}
