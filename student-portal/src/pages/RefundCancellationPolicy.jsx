import './PrivacyPolicy.css'

const sections = [
  ['No-refund policy', 'All program enrollment and registration payments are final and non-refundable, except for a verified duplicate payment caused by a technical or payment-processing issue.'],
  ['Duplicate payments', 'Only the duplicate or excess transaction may be refunded after ARINSA AI MINDS verifies the participant, program, amount, transaction IDs, payment records and any requested supporting evidence. The original payment remains non-refundable.'],
  ['Program cancellation', 'A participant may request cancellation of an existing registration, including when they wish to move to another program. Cancellation does not entitle the participant to a refund.'],
  ['Changing programs', 'A payment from one program is not automatically transferred, credited or adjusted toward another program. A new registration, separate payment and, where required, a different email address may be needed.'],
  ['Access to digital materials', 'Receiving or not receiving access to learning materials, assessments, projects, datasets or other resources does not change the no-refund policy.'],
  ['Suspension or termination', 'No refund is provided where access is suspended or terminated for misconduct, impersonation, account sharing, unauthorised distribution of materials, NDA violations, fraud, abuse or security violations.'],
  ['Career outcomes', 'Enrollment does not guarantee employment, salary, placement, interviews, selection or any particular career outcome.'],
  ['Verified refund process', 'Approved duplicate-payment refunds ordinarily return through the original payment method. Processing time can depend on the payment gateway, bank, card issuer or UPI provider.'],
  ['Statutory rights and law', 'Nothing in this policy excludes a refund, remedy or consumer right that ARINSA AI MINDS is legally required to provide. The policy is governed by Indian law, subject to applicable consumer protections and mandatory jurisdictional rights.'],
]

export default function RefundCancellationPolicy() {
  return <main className="privacy-page"><p>ARINSA AI MINDS · EFFECTIVE DATE: 15 AUGUST 2026</p><h1>Refund &<br/><em>Cancellation.</em></h1><span>This policy applies to paid ARINSA AI MINDS programs, training, assessments and related services.</span><section>{sections.map(([heading, text], index) => <article key={heading}><h2>{index + 1}. {heading}</h2><p>{text}</p></article>)}</section><small>By registering, making payment or electronically accepting this policy, you acknowledge the no-refund policy and the verified duplicate-payment exception.</small></main>
}
