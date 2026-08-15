import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import PaymentGate from './components/PaymentGate'
import PlatinumGate from './components/PlatinumGate'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import CompleteEnrollment from './pages/CompleteEnrollment'
import Dashboard from './pages/Dashboard'
import Materials from './pages/Materials'
import LiveClasses from './pages/LiveClasses'
import Coding from './pages/Coding'
import CodingAttempt from './pages/CodingAttempt'
import Projects from './pages/Projects'
import ProjectAttempt from './pages/ProjectAttempt'
import Quizzes from './pages/Quizzes'
import Marksheet from './pages/Marksheet'
import Timeline from './pages/Timeline'
import Certificates from './pages/Certificates'
import Notifications from './pages/Notifications'
import Support from './pages/Support'
import SupportConversation from './pages/SupportConversation'
import Profile from './pages/Profile'
import Landing from './pages/Landing'
import PublicPage from './pages/PublicPage'
import ProgramDetail from './pages/ProgramDetail'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import ProgramsPage from './pages/ProgramsPage'
import PlatinumDetail from './pages/PlatinumDetail'
import CurriculumPage from './pages/CurriculumPage'
import InternshipDetail from './pages/InternshipDetail'
import PrivacyPolicy from './pages/PrivacyPolicy'
import CookiePolicy from './pages/CookiePolicy'
import Terms from './pages/Terms'
import NdaPolicy from './pages/NdaPolicy'
import RefundCancellationPolicy from './pages/RefundCancellationPolicy'
import Contact from './pages/Contact'
import CookieConsent from './components/CookieConsent'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnMount: true, staleTime: 0, retry: 1 },
  },
})

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [pathname])
  return null
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <CookieConsent />
            <Routes>
              <Route path="/login" element={<><SiteHeader /><Login /><SiteFooter /></>} />
              <Route path="/signup" element={<><SiteHeader /><Signup /><SiteFooter /></>} />
              <Route
                path="/complete-enrollment"
                element={
                  <ProtectedRoute>
                    <CompleteEnrollment />
                  </ProtectedRoute>
                }
              />
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route element={<PaymentGate />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/materials" element={<Materials />} />
                  <Route element={<PlatinumGate />}>
                    <Route path="/live-classes" element={<LiveClasses />} />
                  </Route>
                  <Route path="/coding" element={<Coding />} />
                  <Route path="/coding/:codingId/attempt" element={<CodingAttempt />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/projects/:projectId/attempt" element={<ProjectAttempt />} />
                  <Route path="/quizzes" element={<Quizzes />} />
                  <Route path="/marksheet" element={<Marksheet />} />
                  <Route path="/timeline" element={<Timeline />} />
                  <Route path="/certificates" element={<Certificates />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>
                <Route path="/support" element={<Support />} />
                <Route path="/support/tickets/:ticketId" element={<SupportConversation />} />
              </Route>
              <Route path="/" element={<><SiteHeader /><Landing /><SiteFooter /></>} />
              <Route path="/programs" element={<><SiteHeader /><ProgramsPage /><SiteFooter /></>} />
              <Route path="/curriculum" element={<><SiteHeader /><CurriculumPage /><SiteFooter /></>} />
              <Route path="/privacy" element={<><SiteHeader /><PrivacyPolicy /><SiteFooter /></>} />
              <Route path="/cookies" element={<><SiteHeader /><CookiePolicy /><SiteFooter /></>} />
              <Route path="/terms" element={<><SiteHeader /><Terms /><SiteFooter /></>} />
              <Route path="/refund-cancellation-policy" element={<><SiteHeader /><RefundCancellationPolicy /><SiteFooter /></>} />
              <Route path="/nda" element={<><SiteHeader /><NdaPolicy /><SiteFooter /></>} />
              <Route path="/contact" element={<><SiteHeader /><Contact /><SiteFooter /></>} />
              <Route path="/projects" element={<><SiteHeader /><PublicPage page="projects" /><SiteFooter /></>} />
              <Route path="/about" element={<><SiteHeader /><PublicPage page="about" /><SiteFooter /></>} />
              <Route path="/programs/basic" element={<><SiteHeader /><InternshipDetail program="basic" /><SiteFooter /></>} />
              <Route path="/programs/professional" element={<><SiteHeader /><InternshipDetail program="professional" /><SiteFooter /></>} />
              <Route path="/programs/premium" element={<><SiteHeader /><InternshipDetail program="premium" /><SiteFooter /></>} />
              <Route path="/programs/platinum" element={<><SiteHeader /><PlatinumDetail /><SiteFooter /></>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
