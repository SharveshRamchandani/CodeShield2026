import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="w-full border-t border-hairline bg-base text-xs font-mono text-muted transition-colors">
      <div className="w-full px-6 sm:px-10 lg:px-12 py-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-content font-semibold text-sm">
            <span>CodeShield 2026</span>
            <span className="text-hairline">/</span>
            <span className="text-xs font-normal text-muted">Cyber Club BIT</span>
          </div>
          <p className="text-xs text-subtle max-w-sm">
            Annual collegiate cybersecurity and emerging technology hackathon. Date TBA.
          </p>
        </div>

        <div className="flex flex-wrap gap-8 text-xs">
          <div className="flex flex-col gap-2">
            <span className="text-content font-medium">Navigation</span>
            <Link to="/problem-statements" className="hover:text-cyan transition-colors">Problem Statements</Link>
            <Link to="/faq" className="hover:text-cyan transition-colors">FAQ</Link>
            <Link to="/schedule" className="hover:text-cyan transition-colors">Schedule</Link>
            <Link to="/register" className="hover:text-cyan transition-colors">Registration</Link>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-content font-medium">Organizer</span>
            <span>Cyber Club, BIT</span>
            <a
              href="mailto:cyberclub@bitsathy.ac.in"
              className="hover:text-cyan transition-colors"
            >
              cyberclub@bitsathy.ac.in
            </a>
          </div>
        </div>
      </div>

      <div className="w-full px-6 sm:px-10 lg:px-12 py-4 border-t border-hairline/60 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-subtle">
        <span>&copy; 2026 Cyber Club BIT. All rights reserved.</span>
        <span>Bannari Amman Institute of Technology</span>
      </div>
    </footer>
  );
}
