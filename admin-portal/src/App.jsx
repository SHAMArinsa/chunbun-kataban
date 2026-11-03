import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
// Portal V2
import Dashboard from './pages/v2/Dashboard'
import TierStudents from './pages/v2/TierStudents'
import EnrollmentDetail from './pages/v2/EnrollmentDetail'
import WorkManagement, { EvaluatePage, MockInterviewsPage, EligibilityPage, SelectionsPage, McqResultsPage } from './pages/v2/WorkManagement'
import Programs from './pages/v2/Programs'
import Materials from './pages/v2/Materials'
import Certificates from './pages/v2/Certificates'
import Announcements from './pages/v2/Announcements'
import Reports from './pages/v2/Reports'
import Instructors from './pages/v2/Instructors'
import AreasOfInterest from './pages/v2/AreasOfInterest'
import EmailDeliveries from './pages/v2/EmailDeliveries'
// Preserved modules
import Payments from './pages/Payments'
import PaymentDetail from './pages/PaymentDetail'
import Support from './pages/Support'
import SupportConversation from './pages/SupportConversation'
import Proctoring from './pages/Proctoring'
import Settings from './pages/Settings'
import AdminsAccess from './pages/v2/AdminsAccess'
// Legacy (Premium / Platinum and pre-V2 enrollments)
import Students from './pages/Students'
import LiveClasses from './pages/LiveClasses'
import Quizzes from './pages/Quizzes'
import CodingAssignments from './pages/CodingAssignments'
import CodingAssignmentManage from './pages/CodingAssignmentManage'
import AssignCodingAssessment from './pages/AssignCodingAssessment'
import Projects from './pages/Projects'
import ProjectManage from './pages/ProjectManage'
import AssignProject from './pages/AssignProject'
import Evaluations from './pages/Evaluations'
import SubmissionReview from './pages/SubmissionReview'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnMount: true, staleTime: 0, retry: 1 },
  },
})

// Presentation-only guard; the API independently returns 403 to Instructors.
function AdminOnly() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/students/:tier" element={<TierStudents />} />
                <Route path="/enrollments/:enrollmentId" element={<EnrollmentDetail />} />
                <Route path="/work/:tier" element={<WorkManagement />} />
                <Route path="/evaluate/:tier" element={<EvaluatePage />} />
                <Route path="/selections/:tier" element={<SelectionsPage />} />
                <Route path="/mcq-results/:tier" element={<McqResultsPage />} />
                <Route path="/mock-interviews/:tier" element={<MockInterviewsPage />} />
                <Route path="/eligibility" element={<EligibilityPage />} />
                <Route path="/programs" element={<Programs />} />
                <Route path="/materials" element={<Materials />} />
                <Route path="/certificates" element={<Certificates />} />
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/areas-of-interest" element={<AreasOfInterest />} />
                <Route path="/support" element={<Support />} />
                <Route path="/support/tickets/:ticketId" element={<SupportConversation />} />
                <Route path="/proctoring" element={<Proctoring />} />
                <Route element={<AdminOnly />}>
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/payments/:paymentId" element={<PaymentDetail />} />
                  <Route path="/instructors" element={<Instructors />} />
                  <Route path="/email-deliveries" element={<EmailDeliveries />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/admins" element={<AdminsAccess />} />
                  <Route path="/legacy/students" element={<Students />} />
                </Route>
                {/* Legacy academic modules kept for Premium / Platinum and pre-V2 students */}
                <Route path="/live-classes" element={<LiveClasses />} />
                <Route path="/quizzes" element={<Quizzes />} />
                <Route path="/platinum-quizzes" element={<Quizzes platinumOnly />} />
                <Route path="/coding-assignments" element={<CodingAssignments />} />
                <Route path="/platinum-coding-assignments" element={<CodingAssignments platinumOnly />} />
                <Route path="/coding-assignments/:codingId/manage" element={<CodingAssignmentManage />} />
                <Route path="/coding-assignments/:codingId/assign" element={<AssignCodingAssessment />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/platinum-projects" element={<Projects platinumOnly />} />
                <Route path="/projects/:projectId/manage" element={<ProjectManage />} />
                <Route path="/projects/:projectId/assign" element={<AssignProject />} />
                <Route path="/evaluations" element={<Evaluations />} />
                <Route path="/platinum-evaluations" element={<Evaluations platinumOnly />} />
                <Route path="/evaluations/review/:kind/:submissionId" element={<SubmissionReview />} />
              </Route>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
