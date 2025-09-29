
"use client";

import { Suspense, useEffect } from 'react';
import { ScanForm } from '@/components/scan-form-clean';
import { useRouteProtection } from '@/hooks/use-route-protection';

function ScanFormWithSuspense() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96">Carregando...</div>}>
      <ScanForm />
    </Suspense>
  );
}

export default function OcorrenciaPage() {
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
    <div className="flex min-h-screen w-full flex-col bg-secondary">
      <main className="flex flex-1 flex-col items-center justify-center">
        <ScanFormWithSuspense />
      </main>
    </div>
  );
}
