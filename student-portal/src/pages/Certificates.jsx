import { useQuery } from '@tanstack/react-query'
import { Award, Download } from 'lucide-react'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Button from '../components/ui/Button'

export default function Certificates() {
  const { data: certificates, isLoading } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => apiClient.get('/certificates').then((r) => r.data),
  })

  const download = async (id, certNumber) => {
    const res = await apiClient.get(`/certificates/${id}/download`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${certNumber}.pdf`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Certificates</h1>
        <p className="text-sm text-slate-500">Your Welcome Certificate is available here once your paid enrollment is active.</p>
      </div>

      <Card className="space-y-3 border-brand-100 bg-brand-50/40 p-5 text-sm text-slate-700">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="space-y-3">
          <p className="font-semibold text-slate-900">After Joining Your Internship/Program</p>
          <p className="mt-1">After successfully joining the ARINSA AI MINDS internship/program, you will receive your <strong>Welcome Certificate</strong>.</p>
          <p className="mt-2 text-xs text-slate-600">The <strong>Welcome Certificate confirms your participation and joining in the program</strong>. It is not an Internship Completion Certificate and does not indicate successful completion of the program.</p>
        <div>
          <p className="font-semibold text-slate-900">What You Need to Do</p>
        </div>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Receive your <strong>Welcome Certificate</strong> after joining the program.</li>
          <li>Share your <strong>Welcome Certificate on LinkedIn</strong> along with a genuine review of your ARINSA AI MINDS internship/program experience.</li>
          <li>Take a <strong>screenshot</strong> of your published LinkedIn post.</li>
          <li>Email the screenshot to <a className="font-medium text-brand-700 underline" href="mailto:recruitment@arinsaaiminds.com">recruitment@arinsaaiminds.com</a> for verification.</li>
          <li>Successfully complete all required <strong>tasks, assignments, projects, and program requirements</strong>.</li>
          <li>After successful completion and participation verification, ARINSA AI MINDS will issue your <strong>Internship Completion Certificate</strong>.</li>
          <li>Your <strong>Internship Completion Certificate</strong> will be sent directly to your registered email address.</li>
        </ol>
        <div className="rounded-lg bg-white/70 p-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">Certificate Process</p>
          <p className="mt-1 font-medium text-brand-700">Join the Program → Receive Welcome Certificate → Share on LinkedIn → Submit Screenshot → Complete the Program → Verification → Receive Internship Completion Certificate by Email</p>
        </div>
        <p className="text-xs text-slate-600"><strong>Important:</strong> The Welcome Certificate is proof of joining the program. The Internship Completion Certificate is issued only after successful completion of the required program activities and verification.</p>
        </div>

        <aside className="flex self-start flex-col gap-4 lg:border-l lg:border-brand-100 lg:pl-6">
          {certificates?.length ? certificates.map((c) => (
            <Card key={c.id} className="flex flex-col gap-2 bg-white p-5 shadow-sm">
              <div className="w-fit rounded-lg bg-brand-50 p-2 text-brand-600">
                <Award size={18} />
              </div>
              <p className="text-sm font-medium capitalize text-slate-900">{c.certificate_type === 'welcome' ? 'Welcome Certificate' : c.certificate_type.replace(/_/g, ' ')}</p>
              <p className="text-xs text-slate-400">No. {c.certificate_number}</p>
              <p className="text-xs text-slate-400">Issued {c.issued_date}</p>
              <Button variant="secondary" className="mt-auto" onClick={() => download(c.id, c.certificate_number)}>
                <Download size={15} /> Download {c.certificate_type === 'welcome' ? 'Welcome Certificate' : 'Certificate'}
              </Button>
            </Card>
          )) : (
            <div className="rounded-lg border border-dashed border-brand-200 bg-white/60 p-6 text-center text-sm text-slate-500">Your Welcome Certificate will appear here as soon as your paid enrollment is active.</div>
          )}
        </aside>
        </div>
      </Card>
    </div>
  )
}
