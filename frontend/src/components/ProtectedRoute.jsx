import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles, requiredRole }) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] w-full flex flex-col items-center justify-center font-mono text-xs text-muted p-8">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 border-2 border-cyan border-t-transparent animate-spin" />
          <span className="text-cyan">// VERIFYING ACCESS CREDENTIALS...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Normalize allowed roles list
  let roles = [];
  if (allowedRoles) {
    roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  } else if (requiredRole) {
    roles = [requiredRole];
  }

  const isRoleAllowed = roles.length === 0 || (user?.role && roles.includes(user.role));

  if (!isRoleAllowed) {
    return (
      <div className="w-full max-w-3xl mx-auto px-6 py-24 min-h-[65vh] flex flex-col items-start font-mono">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 border border-hairline bg-panel text-xs text-amber font-medium">
          <span className="w-1.5 h-1.5 bg-amber" />
          <span>ACCESS DENIED // 403 FORBIDDEN</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-content mb-4">
          Unauthorized Portal Access
        </h1>

        <p className="text-sm text-muted leading-relaxed max-w-xl mb-8">
          Your current account is authenticated as{" "}
          <strong className="text-cyan font-semibold">{user?.role}</strong> (
          {user?.email}), but this portal requires{" "}
          <strong className="text-amber font-semibold">{roles.join(" or ")}</strong> role privileges.
        </p>

        <div className="p-4 border border-hairline bg-panel/60 w-full mb-8 space-y-2 text-xs text-subtle">
          <div>USER IDENTIFIER: {user?.name || user?.email}</div>
          <div>GRANTED ROLE: {user?.role}</div>
          <div>REQUIRED ROLE(S): {roles.join(", ")}</div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Link
            to={
              user?.role === "admin"
                ? "/admin"
                : user?.role === "judge"
                ? "/judge"
                : "/dashboard"
            }
            className="px-5 py-2.5 text-xs font-bold text-zinc-950 bg-cyan hover:bg-cyan-hover transition-colors"
          >
            &rarr; Go to My Portal
          </Link>

          <button
            type="button"
            onClick={logout}
            className="px-5 py-2.5 text-xs text-content border border-hairline bg-panel hover:bg-panel/80 transition-colors"
          >
            Switch Account / Logout
          </button>
        </div>
      </div>
    );
  }

  return children;
}

