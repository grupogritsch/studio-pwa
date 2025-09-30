"use client";

import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('Conexão estabelecida');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('Conexão perdida');
      setIsOnline(false);
    };

    // Atualizar status inicial
    setIsOnline(navigator.onLine);

    // Adicionar event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
