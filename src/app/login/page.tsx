"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        toast({ title: "Login successful!" });
        router.push("/");
      } else {
        const errorData = await response.json();
        toast({
          title: "Login failed",
          description: errorData.error || "Invalid username or password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "An error occurred",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="d-flex w-100" role="main" aria-label="Página de autenticação">
      <div className="container d-flex flex-column">
        <div className="row vh-100">
          <div className="col-sm-9 col-md-7 col-lg-5 col-xl-4 mx-auto d-table h-100">
            <div className="d-table-cell align-middle">
              <div className="card" role="form" aria-labelledby="auth-title">
                <div className="card-body">
                  <div className="text-center mt-4">
                    <h1 id="auth-title" className="fs-4 fw-bold text-secondary">
                      Bem-vindo(a)
                    </h1>
                    <p className="fs-5 text-secondary" role="doc-subtitle">
                      Faça login para acessar o sistema
                    </p>
                  </div>
                  <div className="m-sm-3">
                    <form onSubmit={handleSubmit}>
                      <div className="mb-3">
                        <Label htmlFor="username">Usuário</Label>
                        <Input
                          id="username"
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <Label htmlFor="password">Senha</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <div className="d-grid gap-2 mt-4 mb-2">
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? "Entrando..." : "Entrar"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
