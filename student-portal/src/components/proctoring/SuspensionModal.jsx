import { ShieldOff } from 'lucide-react'
import Button from '../ui/Button'
import { useNavigate } from 'react-router-dom'

/** Shown the moment the backend reports that a confirmed violation just suspended the
 * student's enrollment. Not dismissable by design — the student is routed to Support, which
 * is the one page still reachable while suspended (see Layout.jsx). */
export default function SuspensionModal({ open }) {
  const navigate = useNavigate()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <ShieldOff size={22} className="text-red-600" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Account Suspended</h2>
        <p className="mt-2 text-sm text-slate-600">
          A proctoring violation was detected during this assessment and your enrollment has been suspended. If you
          believe this is a mistake, please contact support.
        </p>
        <Button className="mt-6 w-full" onClick={() => navigate('/support')}>
          Go to Support
        </Button>
      </div>
    </div>
  )
}
