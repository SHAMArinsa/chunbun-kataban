import { useQuery } from '@tanstack/react-query'
import apiClient from '../api/client'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'
import { Check, Flag, Map, Sparkles, X } from 'lucide-react'
import './AcademicProgress.css'

const TYPE_COLOR = { assessment: 'blue', coding_test: 'yellow', project: 'green', live_class: 'slate', capstone: 'red', mock_interview: 'red' }

export default function Timeline() {
  const { data: enrollments, isLoading: loadingEnrollments } = useQuery({
    queryKey: ['enrollments', 'me'],
    queryFn: () => apiClient.get('/enrollments/me').then((r) => r.data),
  })
  const activeEnrollment = enrollments?.find((e) => e.status === 'active') ?? enrollments?.[0]

  const { data: program, isLoading: loadingProgram } = useQuery({
    queryKey: ['program', activeEnrollment?.program_id],
    queryFn: () => apiClient.get(`/programs/${activeEnrollment.program_id}`).then((r) => r.data),
    enabled: !!activeEnrollment,
  })

  if (loadingEnrollments || loadingProgram) return <Spinner />

  if (!activeEnrollment) return <Card className="academic-empty-state"><Map size={28} /><h1>Your learning roadmap is waiting</h1><p>Enroll in a program to see your week-by-week plan.</p></Card>

  const milestones = [...(program?.milestones ?? [])].sort((a, b) => a.week_number - b.week_number || a.order_index - b.order_index)
  const finalMilestoneId = milestones.at(-1)?.id
  const finalOutcome = activeEnrollment.status === 'completed'
    ? 'completed'
    : ['dropped', 'suspended'].includes(activeEnrollment.status) ? 'rejected' : null

  return (
    <div className="academic-page">
      <section className="academic-hero timeline-hero">
        <div>
          <p className="academic-kicker">LEARNING ROADMAP</p>
          <h1>Timeline</h1>
          <p>{program?.name} · Week {activeEnrollment.current_week} of {program?.duration_weeks}</p>
        </div>
        <Sparkles aria-hidden="true" />
      </section>

      <section className="timeline-progress-card">
        <div className="timeline-progress-copy"><span>PROGRAM PROGRESS</span><strong>Week {activeEnrollment.current_week} <em>of {program?.duration_weeks}</em></strong></div>
        <div className="timeline-progress-track"><i style={{ width: `${Math.min(100, ((activeEnrollment.current_week ?? 0) / (program?.duration_weeks || 1)) * 100)}%` }} /></div>
      </section>

      <Card className="timeline-card">
        <div className="academic-section-heading timeline-heading"><div><p>WEEK-BY-WEEK PLAN</p><h2>Your next milestones</h2></div><Flag size={21} /></div>
        <ol className="roadmap-list">
          {milestones.map((m) => {
            const isFinal = m.id === finalMilestoneId
            const isComplete = m.week_number <= activeEnrollment.current_week && finalOutcome !== 'rejected'
            const outcomeLabel = isFinal && (finalOutcome === 'completed' ? 'Completed' : finalOutcome === 'rejected' ? 'Rejected' : 'Final review pending')
            return (
            <li key={m.id} className={`${isComplete ? 'is-complete' : ''} ${finalOutcome === 'rejected' && isFinal ? 'is-rejected' : ''}`}>
              <span className="roadmap-dot">{finalOutcome === 'rejected' && isFinal ? <X size={14} /> : isComplete ? <Check size={13} /> : m.week_number}</span>
              <div className="roadmap-item">
                <div className="roadmap-item-title"><p>Week {m.week_number}: {m.title}</p>
                <Badge color={TYPE_COLOR[m.milestone_type] ?? 'slate'}>{m.milestone_type.replace('_', ' ')}</Badge>
                {outcomeLabel && <span className={`roadmap-outcome ${finalOutcome ?? 'pending'}`}>{outcomeLabel}</span>}
                </div>
                {m.phase && <p className="roadmap-phase">{m.phase === 'phase1' ? 'Phase 1 · Learning' : 'Phase 2 · Industry Internship'}</p>}
                {m.description && <p className="roadmap-description">{m.description}</p>}
              </div>
            </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}
