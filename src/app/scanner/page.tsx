"use client";

import { ScannerCamera } from '@/components/scanner-camera';
import { useEffect } from 'react';
import { useRouteProtection } from '@/hooks/use-route-protection';
import AuthGuard from '@/components/auth-guard';

export default function ScannerPage() {
  const { hasActiveRoteiro, isLoading, redirectToHome } = useRouteProtection();

  // Redirecionar para home se não houver roteiro ativo
  useEffect(() => {
    if (!isLoading && !hasActiveRoteiro) {
      redirectToHome();
    }
  }, [hasActiveRoteiro, isLoading, redirectToHome]);

  // Mostrar loading enquanto verifica
  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-secondary">
        <main className="flex flex-1 flex-col items-center justify-center">
          <div className="flex items-center justify-center h-96">Verificando roteiro...</div>
        </main>
      </div>
    );
  }

  // Não renderizar se não há roteiro ativo (será redirecionado)
  if (!hasActiveRoteiro) {
    return null;
  }
  return (
    <AuthGuard>
      <div className="flex min-h-screen w-full flex-col bg-secondary">
        <main className="flex flex-1 flex-col items-center justify-center">
          <ScannerCamera />
        </main>
      </div>
    </AuthGuard>
  );
}