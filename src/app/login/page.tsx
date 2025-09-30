"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const success = await login(username, password);

      if (success) {
        // Redirect to home page
        router.push("/");
      } else {
        setError("Credenciais inválidas");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Erro interno. Tente novamente mais tarde.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style jsx>{`
        .login-container {
          display: flex;
          width: 100%;
          min-height: 100vh;
          background-color: #f8f9fa;
        }
        .login-wrapper {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
        }
        .login-content {
          display: flex;
          height: 100vh;
          align-items: center;
          justify-content: center;
        }
        .login-card {
          background: white;
          border-radius: 0.375rem;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
          width: 100%;
          max-width: 400px;
          padding: 2rem;
        }
        .logo-container {
          text-align: center;
          margin-top: 1rem;
          margin-bottom: 2rem;
        }
        .title-container {
          text-align: center;
          margin-bottom: 2rem;
        }
        .title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #6b7280;
          margin-bottom: 0.5rem;
        }
        .subtitle {
          font-size: 1.125rem;
          color: #6b7280;
        }
        .form-group {
          margin-bottom: 1.5rem;
        }
        .form-label {
          display: block;
          font-size: 1.125rem;
          color: #6b7280;
          margin-bottom: 0.5rem;
        }
        .form-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 1rem;
          transition: border-color 0.15s ease-in-out;
        }
        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .error-message {
          color: #dc2626;
          font-size: 0.875rem;
          margin-top: 0.25rem;
          margin-bottom: 1rem;
        }
        .submit-button {
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-size: 1.125rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s ease-in-out;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .submit-button:hover:not(:disabled) {
          background-color: #2563eb;
        }
        .submit-button:disabled {
          background-color: #9ca3af;
          cursor: not-allowed;
        }
        .footer {
          text-align: center;
          margin-top: 1rem;
        }
        .footer-text {
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 0.25rem;
        }
        .footer-link {
          color: #3b82f6;
          text-decoration: none;
        }
        .footer-link:hover {
          text-decoration: underline;
        }
      `}</style>
      <main className="login-container" role="main" aria-label="Página de autenticação">
        <div className="login-wrapper">
          <div className="login-content">
            <article className="login-card" role="form" aria-labelledby="auth-title">
              <header className="logo-container">
                <Image
                  src="/logistik-light.png"
                  alt="Logistik"
                  width={200}
                  height={40}
                  priority
                />
              </header>
              <div className="title-container">
                <h1 id="auth-title" className="title">
                  Bem-vindo(a)
                </h1>
                <p className="subtitle" role="doc-subtitle">
                  Faça login para acessar o sistema
                </p>
              </div>
              <section aria-label="Formulário de autenticação">
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label htmlFor="username" className="form-label">
                      Usuário
                    </label>
                    <input
                      id="username"
                      type="text"
                      className="form-input"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="password" className="form-label">
                      Senha
                    </label>
                    <input
                      id="password"
                      type="password"
                      className="form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  {error && (
                    <div className="error-message" role="alert" aria-live="polite">
                      {error}
                    </div>
                  )}
                  <button
                    className="submit-button"
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? "Entrando..." : "Entrar"}
                  </button>
                </form>
                <footer className="footer">
                  <p className="footer-text">
                    Um produto <a href="https://www.gritsch.com.br" target="_blank" rel="noopener" className="footer-link">Gritsch</a>
                  </p>
                  <p className="footer-text">
                    © Copyright 2025. Todos os direitos reservados
                  </p>
                </footer>
              </section>
            </article>
          </div>
        </div>
      </main>
    </>
  );
}
