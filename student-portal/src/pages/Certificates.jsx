import Card from '../components/ui/Card'

export default function Certificates() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Certificates &amp; Invoices</h1>
        <p className="text-sm text-slate-500">Documents personally uploaded for you by the ARINSA AI MINDS administration.</p>
      </div>

      <Card className="border-brand-100 bg-brand-50/40 p-5 text-sm text-slate-700">
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
                <li>Your <strong>certificates and invoices</strong> will be sent directly to your registered email address.</li>
              </ol>
            </div>
            <div className="rounded-lg bg-white/70 p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">Certificate Process</p>
              <p className="mt-1 font-medium text-brand-700">Join the Program → Receive Welcome Certificate by Email → Share on LinkedIn → Submit Screenshot → Complete the Program → Verification → Receive Completion Certificate by Email</p>
            </div>
            <p className="text-xs text-slate-600"><strong>Important:</strong> All certificates and invoices are delivered to your registered email address. The Internship Completion Certificate is issued only after successful completion of the required program activities and verification.</p>
        </div>
      </Card>
    </div>
  )
}
