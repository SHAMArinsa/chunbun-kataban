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
import VideosRoute, { MaterialsRoute } from './pages/v2/VideosRoute'
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
import ApplyPage from './pages/ApplyPage'
import VerifyCredential from './pages/VerifyCredential'
import ComparePrograms from './pages/ComparePrograms'
import AboutPage from './pages/AboutPage'
import PlacementGuarantee from './pages/PlacementGuarantee'
import FaqPage from './pages/FaqPage'
import { IndustryProjectsLibrary, IndustryProjectDetail } from './pages/IndustryProjects'
import CurriculumPage from './pages/CurriculumPage'
import InternshipDetail from './pages/InternshipDetail'
import PrivacyPolicy from './pages/PrivacyPolicy'
import CookiePolicy from './pages/CookiePolicy'
import Terms from './pages/Terms'
import NdaPolicy from './pages/NdaPolicy'
import RefundCancellationPolicy from './pages/RefundCancellationPolicy'
import Contact from './pages/Contact'
import CookieConsent from './components/CookieConsent'
import PortalSwitch from './components/PortalSwitch'
import V2Dashboard from './pages/v2/Dashboard'
import V2Certificates from './pages/v2/Certificates'
import ProjectSelection from './pages/v2/ProjectSelection'
import Work from './pages/v2/Work'
import InternshipForm from './pages/v2/InternshipForm'
import MockInterviews from './pages/v2/MockInterviews'
import Eligibility from './pages/v2/Eligibility'
import ForgotPassword from './pages/v2/ForgotPassword'

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
              <Route path="/signup/*" element={<><SiteHeader /><Signup /><SiteFooter /></>} />
              <Route path="/forgot-password" element={<><SiteHeader /><ForgotPassword /><SiteFooter /></>} />
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
                  <Route path="/dashboard" element={<PortalSwitch v2={<V2Dashboard />} legacy={<Dashboard />} />} />
                  {/* Portal V2 (Basic, Professional, Advanced, Career, Career Accelerator) */}
                  <Route path="/project-selection" element={<ProjectSelection />} />
                  <Route path="/work" element={<Work />} />
                  <Route path="/internship-form" element={<InternshipForm />} />
                  <Route path="/mock-interviews" element={<MockInterviews />} />
                  <Route path="/eligibility" element={<Eligibility />} />
                  <Route path="/materials" element={<MaterialsRoute />} />
                  <Route path="/videos" element={<VideosRoute />} />
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
                  <Route path="/certificates" element={<PortalSwitch v2={<V2Certificates />} legacy={<Certificates />} />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>
                <Route path="/support" element={<Support />} />
                <Route path="/support/tickets/:ticketId" element={<SupportConversation />} />
              </Route>
              <Route path="/" element={<><SiteHeader /><Landing /><SiteFooter /></>} />
              <Route path="/industry-projects" element={<><SiteHeader /><IndustryProjectsLibrary /><SiteFooter /></>} />
              <Route path="/industry-projects/:slug" element={<><SiteHeader /><IndustryProjectDetail /><SiteFooter /></>} />
              <Route path="/faq" element={<><SiteHeader /><FaqPage /><SiteFooter /></>} />
              <Route path="/job-guarantee" element={<><SiteHeader /><PlacementGuarantee /><SiteFooter /></>} />
              <Route path="/verify" element={<><SiteHeader /><VerifyCredential /><SiteFooter /></>} />
              <Route path="/verify/:credentialId" element={<><SiteHeader /><VerifyCredential /><SiteFooter /></>} />
              <Route path="/apply" element={<><SiteHeader /><ApplyPage /><SiteFooter /></>} />
              <Route path="/programs" element={<><SiteHeader /><ProgramsPage /><SiteFooter /></>} />
              <Route path="/curriculum" element={<><SiteHeader /><CurriculumPage /><SiteFooter /></>} />
              <Route path="/privacy" element={<><SiteHeader /><PrivacyPolicy /><SiteFooter /></>} />
              <Route path="/cookies" element={<><SiteHeader /><CookiePolicy /><SiteFooter /></>} />
              <Route path="/terms" element={<><SiteHeader /><Terms /><SiteFooter /></>} />
              <Route path="/refund-cancellation-policy" element={<><SiteHeader /><RefundCancellationPolicy /><SiteFooter /></>} />
              <Route path="/nda" element={<><SiteHeader /><NdaPolicy /><SiteFooter /></>} />
              <Route path="/contact" element={<><SiteHeader /><Contact /><SiteFooter /></>} />
              <Route path="/projects" element={<><SiteHeader /><PublicPage page="projects" /><SiteFooter /></>} />
              <Route path="/about" element={<><SiteHeader /><AboutPage /><SiteFooter /></>} />
              <Route path="/programs/compare" element={<><SiteHeader /><ComparePrograms /><SiteFooter /></>} />
              <Route path="/programs/basic" element={<><SiteHeader /><InternshipDetail program="basic" /><SiteFooter /></>} />
              <Route path="/programs/professional" element={<><SiteHeader /><InternshipDetail program="professional" /><SiteFooter /></>} />
              <Route path="/programs/advanced" element={<><SiteHeader /><InternshipDetail program="advanced" /><SiteFooter /></>} />
              <Route path="/programs/career" element={<><SiteHeader /><InternshipDetail program="career" /><SiteFooter /></>} />
              <Route path="/programs/career_accelerator" element={<><SiteHeader /><InternshipDetail program="career_accelerator" /><SiteFooter /></>} />
              {/* Premium / Platinum are closed for new signups; old links go to the catalogue. */}
              <Route path="/programs/premium" element={<Navigate to="/programs" replace />} />
              <Route path="/programs/platinum" element={<Navigate to="/programs" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
