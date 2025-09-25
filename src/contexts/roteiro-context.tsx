"use client";

import { createContext, useContext, useState, ReactNode } from 'react';

interface RoteiroContextType {
  currentRoteiroId: number | null;
  setCurrentRoteiroId: (id: number | null) => void;
}

const RoteiroContext = createContext<RoteiroContextType | undefined>(undefined);

export function RoteiroProvider({ children }: { children: ReactNode }) {
  const [currentRoteiroId, setCurrentRoteiroId] = useState<number | null>(null);

  return (
    <RoteiroContext.Provider value={{ currentRoteiroId, setCurrentRoteiroId }}>
      {children}
    </RoteiroContext.Provider>
  );
}

export function useRoteiro() {
  const context = useContext(RoteiroContext);
  if (context === undefined) {
    throw new Error('useRoteiro must be used within a RoteiroProvider');
  }
  return context;
}