import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiClient, TOKEN_STORAGE_KEY } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const hydrateUser = useCallback(async (authToken) => {
    if (!authToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const profile = await apiClient.get("/api/auth/me");
      setUser(profile);
    } catch {
      // Token invalid or expired
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    hydrateUser(token);
  }, [token, hydrateUser]);

  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
    };

    window.addEventListener("codeshield-auth-expired", handleAuthExpired);
    return () => {
      window.removeEventListener("codeshield-auth-expired", handleAuthExpired);
    };
  }, [logout]);

  const login = async (email, password) => {
    const data = await apiClient.post("/api/auth/login", { email, password });
    if (data && data.access_token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
      setToken(data.access_token);
      setUser({
        email,
        role: data.role,
        name: data.name,
      });
      hydrateUser(data.access_token);
      return data;
    }
    throw new Error("Invalid token response from server");
  };

  const loginWithToken = (tokenData) => {
    if (tokenData && tokenData.access_token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
      setToken(tokenData.access_token);
      setUser({
        email: tokenData.email,
        role: tokenData.role || "leader",
        name: tokenData.name,
        team_code: tokenData.team_code,
        team_name: tokenData.team_name,
      });
      hydrateUser(tokenData.access_token);
      return tokenData;
    }
    throw new Error("Invalid token payload provided to loginWithToken");
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    loginWithToken,
    logout,
    refreshUser: () => hydrateUser(token),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
