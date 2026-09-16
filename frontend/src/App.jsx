import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import ComingSoonPage from "./pages/ComingSoonPage";
import StubPage from "./pages/StubPage";

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-base text-content flex flex-col justify-between selection:bg-cyan selection:text-base transition-colors">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/coming-soon" element={<ComingSoonPage />} />
            <Route
              path="/register"
              element={
                <StubPage
                  title="Registration Portal"
                  description="Registrations for CodeShield 2026 will open shortly once final dates and team quotas are released."
                  statusTag="Registrations Opening Soon"
                />
              }
            />
            <Route
              path="/problem-statements"
              element={
                <StubPage
                  title="Problem Statements"
                  description="Challenge briefs and problem domains covering Cybersecurity and Innovation & Emerging Technologies will be released prior to the event kickoff."
                  statusTag="Tracks Defined &middot; Briefs Pending"
                />
              }
            />
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
    </ThemeProvider>
  );
}
