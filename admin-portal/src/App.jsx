import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import SuperAdminGate from './components/SuperAdminGate'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Programs from './pages/Programs'
import Payments from './pages/Payments'
import PaymentDetail from './pages/PaymentDetail'
import Materials from './pages/Materials'
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
import Reports from './pages/Reports'
import Announcements from './pages/Announcements'
import Support from './pages/Support'
import SupportConversation from './pages/SupportConversation'
import Proctoring from './pages/Proctoring'
import Settings from './pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnMount: true, staleTime: 0, retry: 1 },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/students" element={<Students />} />
                <Route element={<SuperAdminGate />}>
                  <Route path="/programs" element={<Programs />} />
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/payments/:paymentId" element={<PaymentDetail />} />
                </Route>
                <Route path="/materials" element={<Materials />} />
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
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/support" element={<Support />} />
                <Route path="/support/tickets/:ticketId" element={<SupportConversation />} />
                <Route path="/proctoring" element={<Proctoring />} />
                <Route element={<SuperAdminGate />}>
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
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
