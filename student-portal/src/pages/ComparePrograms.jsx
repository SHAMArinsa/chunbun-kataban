import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check, Minus, Plus, Scale, X } from 'lucide-react'
import apiClient from '../api/client'
import { PROGRAM_DETAILS } from '../content/programDetails'
import { feeNote, hasActiveOffer, priceLabel } from '../utils/programOffers'
import './ComparePrograms.css'

const ORDER = ['basic', 'professional', 'advanced', 'career', 'career_accelerator']

// One row per comparison point. Values: true / false / text.
const ROWS = [
  ['Best for', { basic: 'Beginners & first-timers', professional: 'Building bigger projects', advanced: 'Real assigned work experience', career: 'Experience + getting a job', career_accelerator: 'A complete path into an AI career' }],
  ['Duration', { basic: '2 weeks', professional: '4 weeks', advanced: '12 weeks', career: '24 weeks', career_accelerator: '1 year' }],
  ['Format', { basic: 'Online · self-paced', professional: 'Online · self-paced', advanced: 'Online · assigned work', career: 'Online · assigned work', career_accelerator: 'Course + internship' }],
  ['Suggested time', { basic: '1–2 hrs/day', professional: '~2 hrs/day', advanced: '2–3 hrs/day', career: '2–3 hrs/day', career_accelerator: 'Consistent daily effort' }],
  ['No coding background needed', { basic: true, professional: 'Helpful, not required', advanced: 'Some foundation', career: 'Some foundation', career_accelerator: true }],
  ['Learning materials', { basic: true, professional: true, advanced: false, career: false, career_accelerator: 'Video lessons + materials' }],
  ['Online assessment (MCQ)', { basic: true, professional: true, advanced: false, career: false, career_accelerator: false }],
  ['Practical work', { basic: 'Guided project', professional: 'Larger projects', advanced: 'Assigned tasks & projects', career: 'Assigned tasks & projects', career_accelerator: 'Assignments + real-world projects' }],
  ['Work matched to your interest', { basic: false, professional: false, advanced: true, career: true, career_accelerator: false }],
  ['Reviewer feedback', { basic: true, professional: true, advanced: true, career: true, career_accelerator: true }],
  ['AI / ML depth', { basic: 'Intro level', professional: 'Intro level', advanced: 'If you choose an AI track', career: 'If you choose an AI track', career_accelerator: 'Python → GenAI → Agentic AI' }],
  ['Internship experience', { basic: false, professional: false, advanced: true, career: true, career_accelerator: 'Including a full-time phase' }],
  ['Mock interviews', { basic: false, professional: false, advanced: false, career: '1', career_accelerator: '3' }],
  ['Resume support', { basic: false, professional: false, advanced: false, career: true, career_accelerator: true }],
  ['Job assistance', { basic: false, professional: false, advanced: false, career: true, career_accelerator: true }],
  ['Placement guarantee*', { basic: false, professional: false, advanced: false, career: false, career_accelerator: 'Subject to eligibility' }],
  ['Certificates', { basic: 'Welcome + Completion', professional: 'Welcome + Completion', advanced: 'Welcome + Completion', career: 'Welcome + Completion', career_accelerator: 'Welcome + Completion' }],
]

function Cell({ v }) {
  if (v === true) return <span className="cmp-yes"><Check /></span>
  if (v === false) return <span className="cmp-no"><Minus /></span>
  return <span className="cmp-text">{v}</span>
}

export default function ComparePrograms() {
  const [params, setParams] = useSearchParams()
  const { data: programs } = useQuery({ queryKey: ['public-programs'], queryFn: () => apiClient.get('/public/programs').then((r) => r.data) })

  const selected = useMemo(() => {
    const raw = (params.get('p') || '').split(',').filter((c) => ORDER.includes(c))
    const uniq = [...new Set(raw)]
    if (uniq.length >= 2) return ORDER.filter((c) => uniq.includes(c))
    // sensible defaults: the given one plus its neighbour, or Career vs Career Accelerator
    if (uniq.length === 1) { const i = ORDER.indexOf(uniq[0]); return ORDER.filter((c, j) => j === i || j === (i === ORDER.length - 1 ? i - 1 : i + 1)) }
    return ['career', 'career_accelerator']
  }, [params])

  const setSel = (codes) => setParams({ p: ORDER.filter((c) => codes.includes(c)).join(',') }, { replace: true })
  const toggle = (code) => {
    if (selected.includes(code)) { if (selected.length > 2) setSel(selected.filter((c) => c !== code)) }
    else setSel([...selected, code])
  }
  const live = (code) => programs?.find((p) => p.code === code)
  const differs = (vals) => new Set(vals.map((v) => JSON.stringify(v))).size > 1

  return (
    <main className="cmp">
      <section className="cmp-hero">
        <p><Scale /> COMPARE PROGRAMMES</p>
        <h1>See the programmes <span>side by side.</span></h1>
        <span>Select two or more programmes. Rows where they differ are highlighted so you can decide quickly.</span>
      </section>

      <section className="cmp-picker">
        {ORDER.map((code) => {
          const on = selected.includes(code)
          const locked = on && selected.length <= 2
          return (
            <button key={code} type="button" className={`${on ? 'on' : ''} ${code === 'career_accelerator' ? 'flag' : ''}`} onClick={() => toggle(code)} disabled={locked} title={locked ? 'Keep at least two programmes selected' : ''}>
              <i>{on ? <Check /> : <Plus />}</i>
              <span><b>{PROGRAM_DETAILS[code].name}</b><small>{PROGRAM_DETAILS[code].facts[0][0]}</small></span>
            </button>
          )
        })}
        <div className="cmp-quick">
          <span>Quick compare:</span>
          <button type="button" onClick={() => setSel(['basic', 'professional'])}>Basic vs Professional</button>
          <button type="button" onClick={() => setSel(['advanced', 'career'])}>Advanced vs Career</button>
          <button type="button" onClick={() => setSel(['career', 'career_accelerator'])}>Career vs Accelerator</button>
          <button type="button" onClick={() => setSel(ORDER)}>All five</button>
        </div>
      </section>

      <section className="cmp-wrap">
        <table className={`cmp-table cols${selected.length}`}>
          <thead>
            <tr>
              <th className="cmp-rowhead"><span>{selected.length} programmes selected</span></th>
              {selected.map((code) => {
                const p = live(code)
                const offer = hasActiveOffer(p)
                return (
                  <th key={code} className={code === 'career_accelerator' ? 'flag' : ''}>
                    {selected.length > 2 && <button type="button" className="cmp-remove" onClick={() => toggle(code)} aria-label={`Remove ${PROGRAM_DETAILS[code].name}`}><X /></button>}
                    {code === 'career_accelerator' && <em className="cmp-badge">FLAGSHIP</em>}
                    <small>{code === 'career_accelerator' ? 'COURSE + INTERNSHIP' : PROGRAM_DETAILS[code].kicker.split('·')[0].trim()}</small>
                    <h2>{PROGRAM_DETAILS[code].name}</h2>
                    {p && <div className="cmp-price"><b>{offer ? priceLabel(p.offer_price_inr, p.offer_price_usd) : priceLabel(p.price_inr, p.price_usd)}</b><span>{feeNote(p).split(' | ')[0]}</span></div>}
                    <div className="cmp-btns">
                      <Link className="cmp-apply" to={`/signup?program=${code}`}>Apply</Link>
                      <Link className="cmp-more" to={`/programs/${code}`}>Details <ArrowRight /></Link>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, vals]) => {
              const v = selected.map((c) => vals[c])
              return (
                <tr key={label} className={differs(v) ? 'diff' : ''}>
                  <th scope="row">{label}</th>
                  {selected.map((c, i) => <td key={c} className={c === 'career_accelerator' ? 'flag' : ''}><Cell v={v[i]} /></td>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="cmp-foot">
        <div className="cmp-legend"><span><i className="cmp-yes"><Check /></i> Included</span><span><i className="cmp-no"><Minus /></i> Not included</span><span><i className="cmp-swatch" /> Differs between selected programmes</span></div>
        <p>Each programme is independent — you don’t need to complete one before joining another.</p>
        <p>*Placement guarantee is subject to successful completion of applicable programme eligibility requirements and terms.</p>
        <Link className="cmp-back" to="/programs">Back to all programmes <ArrowRight /></Link>
      </section>
    </main>
  )
}
