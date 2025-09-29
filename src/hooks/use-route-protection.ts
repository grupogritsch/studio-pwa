"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useRouteProtection() {
  const router = useRouter();
  const [hasActiveRoteiro, setHasActiveRoteiro] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkActiveRoteiro = () => {
      try {
        const roteiroData = localStorage.getItem('currentRoteiroData');
        if (roteiroData) {
          const data = JSON.parse(roteiroData);
          // Só considerar roteiro ativo se tem apiRoteiroId (criado via API)
          const isActive = !!data.apiRoteiroId;
          setHasActiveRoteiro(isActive);
        } else {
          setHasActiveRoteiro(false);
        }
      } catch (error) {
        console.error('Erro ao verificar roteiro ativo:', error);
        setHasActiveRoteiro(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkActiveRoteiro();

    // Verificar mudanças no localStorage
    const handleStorageChange = () => {
      checkActiveRoteiro();
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const redirectToHome = () => {
    router.replace('/');
  };

  const redirectToRoteiro = () => {
    router.replace('/roteiro');
  };

  return {
    hasActiveRoteiro,
    isLoading,
    redirectToHome,
    redirectToRoteiro
  };
}