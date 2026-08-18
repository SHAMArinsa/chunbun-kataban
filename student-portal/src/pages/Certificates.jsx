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

      <Card className="border-brand-100 bg-brand-50/40 p-5 text-sm text-slate-700">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(290px,360px)]">
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-slate-900">After Joining Your Internship/Program</h2>
              <p className="mt-2">After successfully joining the ARINSA AI MINDS internship/program, you will receive your <strong>Welcome Certificate within 24 hours.</strong></p>
              <p className="mt-2 text-xs text-slate-600">The <strong>Welcome Certificate confirms your participation and joining in the program.</strong> It is not an Internship Completion Certificate and does not indicate successful completion of the program.</p>
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">What You Need to Do</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                <li>Receive your <strong>Welcome Certificate</strong> after joining the program.</li>
                <li>Share your <strong>Welcome Certificate on LinkedIn</strong> along with a genuine review of your ARINSA AI MINDS internship/program experience.</li>
                <li>Take a <strong>screenshot</strong> of your published LinkedIn post.</li>
                <li>Email the screenshot to <a className="font-medium text-brand-700 underline" href="mailto:recruitment@arinsaaiminds.com">recruitment@arinsaaiminds.com</a> for verification.</li>
                <li>Successfully complete all required <strong>tasks, assignments, projects, and program requirements.</strong></li>
                <li>After successful completion and participation verification, ARINSA AI MINDS will issue your <strong>Internship Completion Certificate.</strong></li>
                <li>Your <strong>Internship Completion Certificate</strong> will be sent directly to your registered email address.</li>
              </ol>
            </div>
            <div className="rounded-lg bg-white/70 p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">Certificate Process</p>
              <p className="mt-1 font-medium text-brand-700">Join the Program → Receive Welcome Certificate → Share on LinkedIn → Submit Screenshot → Complete the Program → Verification → Receive Internship Completion Certificate by Email</p>
            </div>
            <p className="text-xs text-slate-600"><strong>Important:</strong> The Welcome Certificate is proof of joining the program. The Internship Completion Certificate is issued only after successful completion of the required program activities and verification.</p>
          </div>

          <aside className="flex flex-col gap-4 lg:border-l lg:border-brand-100 lg:pl-6">
            {documents?.length ? documents.map((doc) => {
              const meta = TYPE_META[doc.document_type] ?? { label: 'Document', icon: FileText }
              const Icon = meta.icon
              return (
                <Card key={doc.id} className="flex flex-col gap-3 bg-white p-5 shadow-sm">
                  <div className="w-fit rounded-lg bg-brand-50 p-2 text-brand-600"><Icon size={20} /></div>
                  <div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{meta.label}</p><h2 className="mt-1 text-base font-semibold text-slate-900">{doc.title}</h2><p className="mt-2 text-xs text-slate-500">Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</p></div>
                  <Button variant="secondary" className="mt-auto" onClick={() => download(doc)}><Download size={15} /> Download PDF</Button>
                </Card>
              )
            }) : (
              <div className="rounded-lg border border-dashed border-brand-200 bg-white/60 p-6 text-center"><FileText className="mx-auto mb-3 text-slate-300" size={32} /><p className="text-sm font-medium text-slate-700">No documents available yet</p><p className="mt-1 text-xs text-slate-500">Your invoices and certificates will appear here after an administrator uploads them for you.</p></div>
            )}
          </aside>
        </div>
      </Card>
    </div>
  )
}
