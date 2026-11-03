// Admin access areas (must match backend app/core/permissions.py)
export const AREAS = [
  ['students', 'Students'], ['work', 'Work Management'], ['mcq', 'MCQ Results'], ['selections', 'Student Selections'],
  ['evaluation', 'Submissions & Evaluation'], ['mock', 'Mock Interviews'], ['eligibility', 'Placement Eligibility'],
  ['programs', 'Programs'], ['materials', 'Study Materials'], ['certificates', 'Certificates & Invoices'],
  ['payments', 'Payments'], ['announcements', 'Announcements'], ['proctoring', 'Proctoring'], ['reports', 'Reports'],
  ['support', 'Support'], ['settings', 'Settings'],
]
export const AREA_LABEL = Object.fromEntries(AREAS)

const STUDENT_WORK = ['students', 'work', 'mcq', 'selections', 'evaluation', 'mock', 'eligibility', 'certificates']
// Page path prefix -> areas that unlock it (any one is enough).
const PAGE_RULES = [
  ['/admins', ['__super__']],
  ['/students', ['students']], ['/enrollments', STUDENT_WORK], ['/work', ['work']], ['/mcq-results', ['mcq']],
  ['/selections', ['selections']], ['/evaluate', ['evaluation']], ['/mock-interviews', ['mock']], ['/eligibility', ['eligibility']],
  ['/programs', ['programs']], ['/materials', ['materials']], ['/certificates', ['certificates']], ['/payments', ['payments']],
  ['/announcements', ['announcements']], ['/proctoring', ['proctoring']], ['/reports', ['reports']], ['/support', ['support']],
  ['/areas-of-interest', ['settings']], ['/instructors', ['settings']], ['/email-deliveries', ['settings']], ['/settings', ['settings']],
  ['/legacy', ['__super__']], ['/quizzes', ['__super__']], ['/platinum-', ['__super__']], ['/coding-assignments', ['__super__']],
  ['/projects', ['__super__']], ['/evaluations', ['__super__']], ['/live-classes', ['__super__']],
]

export function pageAreas(pathname) {
  const hit = PAGE_RULES.find(([p]) => pathname === p || pathname.startsWith(p.endsWith('-') ? p : `${p}/`) || pathname === p)
  return hit ? hit[1] : null
}
