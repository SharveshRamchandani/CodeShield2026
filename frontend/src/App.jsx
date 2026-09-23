import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ServerWakeBanner from "./components/ServerWakeBanner";
import ProtectedRoute from "./components/ProtectedRoute";
import ChatWidget from "./components/ChatWidget";
import { Analytics } from "@vercel/analytics/react";
import { wakeBackend } from "./api/client";

import HomePage from "./pages/HomePage";
import ProblemStatementsPage from "./pages/ProblemStatementsPage";
import RegistrationPage from "./pages/RegistrationPage";
import LoginPage from "./pages/LoginPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import JudgePage from "./pages/JudgePage";
import TeamDashboardPage from "./pages/TeamDashboardPage";
import LeaderDashboardPage from "./pages/LeaderDashboardPage";
import MemberDashboardPage from "./pages/MemberDashboardPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import FAQPage from "./pages/FAQPage";
import StubPage from "./pages/StubPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    wakeBackend();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ScrollToTop />
        <div className="min-h-screen bg-base text-content flex flex-col justify-between selection:bg-cyan/30 selection:text-content transition-colors">
          <ServerWakeBanner />
          <Navbar />
          <main className="flex-grow overflow-x-hidden">
            <div key={location.pathname} className="page-transition min-h-full">
              <Routes location={location}>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/problem-statements" element={<ProblemStatementsPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/register" element={<RegistrationPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/coming-soon" element={<ComingSoonPage />} />
              <Route
                path="/schedule"
                element={
                  <StubPage
                    title="Event Schedule"
                    description="The 36-hour hackathon timeline, checkpoints, mentoring rounds, and presentation schedule will be posted here."
                    statusTag="Schedule Date TBA"
                  />
                }
              />

              {/* Protected Team Dashboards (Smart auto-routing) */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["leader", "member"]}>
                    <TeamDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Individual Team Leader Route */}
              <Route
                path="/leader"
                element={
                  <ProtectedRoute allowedRoles={["leader"]}>
                    <LeaderDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Individual Team Member Route */}
              <Route
                path="/member"
                element={
                  <ProtectedRoute allowedRoles={["member", "leader"]}>
                    <MemberDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Judge Route */}
              <Route
                path="/judge"
                element={
                  <ProtectedRoute allowedRoles={["judge"]}>
                    <JudgePage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin Route */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* 404 Route */}
              <Route
                path="*"
                element={
                  <StubPage
                    title="404 — Page Not Found"
                    description="The requested page does not exist or has been relocated."
                    statusTag="Error 404"
                  />
                }
              />
              </Routes>
            </div>
          </main>
          <ChatWidget />
          <Footer />
          <Analytics />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

