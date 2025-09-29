"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { syncService } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Wifi, WifiOff, RefreshCw, CheckCircle } from 'lucide-react';

export function SyncStatus() {
  const [isOnline, setIsOnline] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // API URL - você pode configurar isso via environment variable
  const [apiUrl, setApiUrl] = useState<string | null>(null);

  useEffect(() => {
    // Verificar status online/offline
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Verificar dados não sincronizados
    const checkUnsyncedData = async () => {
      const unsynced = await syncService.getUnsyncedData();
      setUnsyncedCount(unsynced.length);
    };

    checkUnsyncedData();

    // Escutar eventos de dados não sincronizados
    const handleUnsyncedData = (event: CustomEvent) => {
      setUnsyncedCount(event.detail.count);
    };

    window.addEventListener('unsyncedData', handleUnsyncedData as EventListener);

    // Verificar API URL no localStorage
    const savedApiUrl = localStorage.getItem('logistik_api_url');
    setApiUrl(savedApiUrl);

    // Iniciar verificação em background
    syncService.startBackgroundSync();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('unsyncedData', handleUnsyncedData as EventListener);
    };
  }, []);

  const handleSync = async () => {
    if (!apiUrl) {
      toast({
        variant: "destructive",
        title: "API não configurada",
        description: "Configure a URL da API antes de sincronizar."
      });
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncService.syncAllData(apiUrl);

      if (result.success) {
        toast({
          title: "Sincronização concluída",
          description: result.message,
          className: "bg-green-500 text-white border-green-600",
        });
        setUnsyncedCount(0);
      } else {
        toast({
          variant: "destructive",
          title: "Erro na sincronização",
          description: result.message
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro na sincronização",
        description: "Falha ao sincronizar dados."
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfigureApi = () => {
    const url = prompt('Digite a URL da API:', apiUrl || '');
    if (url) {
      localStorage.setItem('logistik_api_url', url);
      setApiUrl(url);
      toast({
        title: "API configurada",
        description: `URL definida: ${url}`,
        className: "bg-green-500 text-white border-green-600",
      });
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-white rounded-lg shadow-sm border">
      {/* Status Online/Offline */}
      <div className="flex items-center gap-1">
        {isOnline ? (
          <Wifi className="h-4 w-4 text-green-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
        <span className={`text-sm ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Contador de itens não sincronizados */}
      {unsyncedCount > 0 && (
        <Badge variant="destructive">
          {unsyncedCount} não sincronizado{unsyncedCount !== 1 ? 's' : ''}
        </Badge>
      )}

      {/* Botão de sincronização */}
      {isOnline && unsyncedCount > 0 && apiUrl && (
        <Button
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          {isSyncing ? (
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Sincronizar
        </Button>
      )}

      {/* Indicador sincronizado */}
      {unsyncedCount === 0 && apiUrl && (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">Sincronizado</span>
        </div>
      )}

      {/* Botão configurar API */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleConfigureApi}
        className="text-xs"
      >
        {apiUrl ? 'Reconfigurar API' : 'Configurar API'}
      </Button>
    </div>
  );
}