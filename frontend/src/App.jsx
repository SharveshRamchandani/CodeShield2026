import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

import HomePage from "./pages/HomePage";
import ProblemStatementsPage from "./pages/ProblemStatementsPage";
import RegistrationPage from "./pages/RegistrationPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import LoginPage from "./pages/LoginPage";
import JudgePage from "./pages/JudgePage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import StubPage from "./pages/StubPage";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="min-h-screen bg-base text-content flex flex-col justify-between selection:bg-cyan/30 selection:text-content transition-colors">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/problem-statements" element={<ProblemStatementsPage />} />
              <Route path="/register" element={<RegistrationPage />} />
              <Route path="/confirm/:token" element={<ConfirmationPage />} />
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

              {/* Protected Judge Route */}
              <Route
                path="/judge"
                element={
                  <ProtectedRoute requiredRole="judge">
                    <JudgePage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin Route */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRole="admin">
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
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
