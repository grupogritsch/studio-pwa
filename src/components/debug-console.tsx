"use client";

import { useEffect, useState } from 'react';

export function DebugConsole() {
  const [clickCount, setClickCount] = useState(0);
  const [showConsole, setShowConsole] = useState(false);

  useEffect(() => {
    // Resetar contador após 2 segundos
    const timer = setTimeout(() => {
      setClickCount(0);
    }, 2000);

    // Ativar console após 5 cliques
    if (clickCount >= 5 && !showConsole) {
      setShowConsole(true);
      loadEruda();
    }

    return () => clearTimeout(timer);
  }, [clickCount, showConsole]);

  const loadEruda = () => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.onload = () => {
      // @ts-ignore
      if (window.eruda) {
        // @ts-ignore
        window.eruda.init();
      }
    };
    document.head.appendChild(script);
  };

  return (
    <div
      onClick={() => setClickCount(prev => prev + 1)}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        backgroundColor: 'transparent',
        zIndex: 9999,
      }}
    />
  );
}
