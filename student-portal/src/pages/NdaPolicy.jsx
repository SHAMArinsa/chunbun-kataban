import './PrivacyPolicy.css'

const sections = [
  ['Purpose', 'ARINSA AI MINDS may provide access to confidential learning materials, software, products, business processes, client information and proprietary technologies during the internship.'],
  ['Confidential information', 'Confidential Information includes source code, APIs, databases, prompts, AI models and workflows, client requirements, product designs, internal documentation, research, business strategies, training materials, financial information, credentials and security information.'],
  ['Your obligations', 'Keep confidential information strictly confidential; use it only for the internship; do not copy, distribute, publish, sell or disclose it without written permission; protect credentials; and promptly report any unauthorized access or security incident.'],
  ['Exclusions', 'Information is not confidential when it is publicly available without your breach, lawfully known before disclosure, lawfully received from a third party without confidentiality obligations, or independently developed without using Company information.'],
  ['Intellectual property and student work', 'Company materials and applicable work created using Company resources or Confidential Information remain the property of ARINSA AI MINDS PRIVATE LIMITED or the relevant client, unless agreed otherwise in writing.'],
  ['Return or deletion', 'On completion, termination or request, you must return or permanently delete Company Confidential Information, including digital copies, credentials and downloaded materials.'],
  ['Continuing obligations', 'Confidentiality obligations continue after the internship. Violation may result in suspension or termination, cancellation of certificates, recovery of Company property and legal action.'],
  ['Governing law', 'This Agreement is governed by the laws of India. Disputes are subject to the jurisdiction of competent courts in Kolkata, West Bengal.'],
]

export default function NdaPolicy() {
  return <main className="privacy-page"><p>ARINSA AI MINDS · AGREEMENT</p><h1>Internship<br/><em>NDA.</em></h1><span>This Confidentiality Agreement applies to internship participants and electronic acceptance has the same effect as a handwritten signature.</span><section>{sections.map(([heading, text], index) => <article key={heading}><h2>{index + 1}. {heading}</h2><p>{text}</p></article>)}</section></main>
}
