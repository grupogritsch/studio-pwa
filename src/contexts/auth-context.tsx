"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  initials: string;
  email: string;
  is_staff: boolean;
  is_superuser: boolean;
  groups: string[];
  company?: {
    id: number;
    name: string;
    acronym: string;
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Session management refs
  const lastActivityRef = useRef<number>(Date.now());
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isAuthenticated = !!user;

  // Configurações de sessão
  const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 horas em ms
  const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // Verifica a cada 5 minutos
  const ACTIVITY_REFRESH_INTERVAL = 30 * 60 * 1000; // Renova a cada 30 minutos

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("http://localhost:8000/auth/api/verify/", {
        method: "GET",
        credentials: "include",
      });

      const data = await response.json();

      if (data.success && data.authenticated) {
        setUser(data.user);
        // Update localStorage
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("session_key", data.session_key);
      } else {
        // Clear user data if not authenticated
        setUser(null);
        localStorage.removeItem("user");
        localStorage.removeItem("session_key");
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("session_key");
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch("http://localhost:8000/auth/api/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("session_key", data.session_key);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  // Função para renovar a sessão
  const refreshSession = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      await fetch("http://localhost:8000/auth/api/verify/", {
        method: "GET",
        credentials: "include",
      });
    } catch (error) {
      console.error("Erro ao renovar sessão:", error);
    }
  }, [isAuthenticated]);

  // Função para registrar atividade do usuário
  const registerActivity = useCallback(() => {
    if (!isAuthenticated) return;

    const now = Date.now();
    lastActivityRef.current = now;

    // Limpar timeout anterior
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    // Definir novo timeout para logout por inatividade
    activityTimeoutRef.current = setTimeout(() => {
      console.log("Usuário inativo por 2 horas - fazendo logout");
      logout();
    }, INACTIVITY_TIMEOUT);

    // Renovar sessão se passou tempo suficiente
    const timeSinceLastRefresh = now - (window as any).__lastSessionRefresh || 0;
    if (timeSinceLastRefresh > ACTIVITY_REFRESH_INTERVAL) {
      (window as any).__lastSessionRefresh = now;
      refreshSession();
    }
  }, [isAuthenticated, refreshSession]);

  // Verificar periodicamente se a sessão ainda é válida
  const startSessionCheck = useCallback(() => {
    if (!isAuthenticated) return;

    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
    }

    sessionCheckIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch("http://localhost:8000/auth/api/verify/", {
          method: "GET",
          credentials: "include",
        });

        const data = await response.json();

        if (!data.success || !data.authenticated) {
          console.log("Sessão expirou no servidor - fazendo logout");
          logout();
        }
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
      }
    }, SESSION_CHECK_INTERVAL);
  }, [isAuthenticated]);

  const logout = async () => {
    try {
      await fetch("http://localhost:8000/auth/api/logout/", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear timers
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }

      // Clear user data
      setUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("session_key");
      router.push("/login");
    }
  };

  // Setup dos event listeners para detectar atividade
  useEffect(() => {
    if (!isAuthenticated) return;

    // Eventos que indicam atividade do usuário
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Throttle para evitar muitas chamadas
    let throttleTimer: NodeJS.Timeout | null = null;
    const throttledRegisterActivity = () => {
      if (throttleTimer) return;

      throttleTimer = setTimeout(() => {
        registerActivity();
        throttleTimer = null;
      }, 1000); // Throttle de 1 segundo
    };

    // Adicionar listeners
    events.forEach(event => {
      document.addEventListener(event, throttledRegisterActivity, true);
    });

    // Registrar atividade inicial e iniciar verificação
    registerActivity();
    startSessionCheck();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledRegisterActivity, true);
      });
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
    };
  }, [isAuthenticated, registerActivity, startSessionCheck]);

  // Cleanup geral ao desmontar
  useEffect(() => {
    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}