import { useAuth } from "../context/AuthContext";
import LeaderDashboardPage from "./LeaderDashboardPage";
import MemberDashboardPage from "./MemberDashboardPage";

export default function TeamDashboardPage() {
  const { user } = useAuth();

  if (user?.role === "leader") {
    return <LeaderDashboardPage />;
  }

  return <MemberDashboardPage />;
}
