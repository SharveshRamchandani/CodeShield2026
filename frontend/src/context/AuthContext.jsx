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

  const login = async (email, password, type = "staff") => {
    const endpoint = type === "team" ? "/api/auth/team/login" : "/api/auth/staff/login";
    const data = await apiClient.post(endpoint, { email, password });
    if (data && data.access_token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
      setToken(data.access_token);
      setUser({
        email,
        role: data.role,
        name: data.name,
        type: data.type || type,
        team_code: data.team_code,
        team_name: data.team_name,
      });
      await hydrateUser(data.access_token);
      return data;
    }
    throw new Error("Invalid token response from server");
  };

  const loginWithToken = async (tokenDataOrJwt) => {
    let rawToken = "";
    let initialUser = null;

    if (typeof tokenDataOrJwt === "string") {
      rawToken = tokenDataOrJwt;
    } else if (tokenDataOrJwt && tokenDataOrJwt.access_token) {
      rawToken = tokenDataOrJwt.access_token;
      initialUser = {
        email: tokenDataOrJwt.email,
        role: tokenDataOrJwt.role,
        name: tokenDataOrJwt.name,
        team_code: tokenDataOrJwt.team_code,
        team_name: tokenDataOrJwt.team_name,
        type: tokenDataOrJwt.type,
      };
    }

    if (rawToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, rawToken);
      setToken(rawToken);
      if (initialUser) {
        setUser(initialUser);
      }
      await hydrateUser(rawToken);
      return tokenDataOrJwt;
    }
    throw new Error("Invalid token provided to loginWithToken");
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

