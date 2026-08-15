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
        <p className="text-sm text-slate-500">Download certificates issued by Admin.</p>
      </div>

      {certificates?.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((c) => (
            <Card key={c.id} className="flex flex-col gap-2 p-5">
              <div className="rounded-lg bg-brand-50 p-2 text-brand-600 w-fit">
                <Award size={18} />
              </div>
              <p className="text-sm font-medium capitalize text-slate-900">{c.certificate_type.replace(/_/g, ' ')}</p>
              <p className="text-xs text-slate-400">No. {c.certificate_number}</p>
              <p className="text-xs text-slate-400">Issued {c.issued_date}</p>
              <Button variant="secondary" className="mt-auto" onClick={() => download(c.id, c.certificate_number)}>
                <Download size={15} /> Download
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center text-sm text-slate-500">No certificates issued yet. Complete your program to earn certificates.</Card>
      )}
    </div>
  )
}
