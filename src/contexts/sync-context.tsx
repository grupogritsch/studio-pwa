"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { syncService, SyncStatus } from '@/lib/sync-service';
import { useToast } from '@/hooks/use-toast';

interface SyncContextType extends SyncStatus {
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
  });
  const { toast } = useToast();

  useEffect(() => {
    // Listener para atualizações de status
    const handleStatusUpdate = (status: SyncStatus) => {
      setSyncStatus(status);
    };

    syncService.addSyncListener(handleStatusUpdate);

    // Iniciar sincronização em background a cada 5 minutos
    syncService.startBackgroundSync(5);

    // Sincronização automática quando voltar online
    const handleOnline = async () => {
      console.log('Conexão restabelecida - verificando dados pendentes');
      const pendingCount = await syncService.getPendingCount();

      if (pendingCount > 0) {
        toast({
          title: "Conexão restabelecida",
          description: `Sincronizando ${pendingCount} item(ns) pendente(s)...`,
        });

        const result = await syncService.syncAll();

        if (result.success) {
          toast({
            title: "Sincronização concluída",
            description: result.message,
          });
        } else if (result.errorCount > 0) {
          toast({
            variant: "destructive",
            title: "Erro na sincronização",
            description: result.message,
          });
        }
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      syncService.removeSyncListener(handleStatusUpdate);
      window.removeEventListener('online', handleOnline);
    };
  }, [toast]);

  const syncNow = async () => {
    const result = await syncService.syncAll();

    if (result.syncedCount > 0) {
      toast({
        title: "Sincronização concluída",
        description: result.message,
      });
    } else if (result.errorCount > 0) {
      toast({
        variant: "destructive",
        title: "Erro na sincronização",
        description: result.message,
      });
    } else if (result.pendingCount === 0) {
      toast({
        title: "Tudo sincronizado",
        description: "Não há dados pendentes para sincronizar.",
      });
    }
  };

  return (
    <SyncContext.Provider value={{ ...syncStatus, syncNow }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncStatus() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSyncStatus must be used within a SyncProvider');
  }
  return context;
}
