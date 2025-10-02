
"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { QrCode, Package, Clock, WifiOff, Edit3, Clock4, CheckCircle, RefreshCw, Wifi, Menu, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import Image from 'next/image';
import { ScannerCamera } from '@/components/scanner-camera';
import { ScanForm } from '@/components/scan-form-clean';
import { Suspense } from 'react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { apiService } from '@/lib/api';
import AuthGuard from '@/components/auth-guard';


type Occurrence = {
  id: number;
  scannedCode: string;
  occurrence: string;
  timestamp: string;
  receiverName?: string;
  receiverDocument?: string;
  synced?: boolean;
};

// Define a interface para o evento de instalação
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}


type ViewMode = 'list' | 'scan' | 'manual';

export default function Home() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [offlineOccurrencesCount, setOfflineOccurrencesCount] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { logout, user } = useAuth();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    updateOnlineStatus();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncPendingData = async () => {
    if (!isOnline || isSyncing) return;

    const activeOccurrences = await db.getActiveOccurrences();
    const unsyncedOccurrences = activeOccurrences.filter(occ => !occ.synced);

    if (unsyncedOccurrences.length === 0) return;

    setIsSyncing(true);
    console.log(`Sincronizando automaticamente ${unsyncedOccurrences.length} ocorrência(s) pendente(s)...`);

    try {
      const idsToSync = new Set(unsyncedOccurrences.map(occ => occ.id));
      setSyncingIds(idsToSync);

      const { successes, failures } = await apiService.syncMultipleOccurrences(unsyncedOccurrences);

      // Update sync status for successful ones
      for (let i = 0; i < unsyncedOccurrences.length; i++) {
        const occurrence = unsyncedOccurrences[i];
        if (successes > 0) {
          await db.updateOccurrenceSync(occurrence.id, true);
        }
      }

      setSyncingIds(new Set());

      if (successes > 0) {
        toast({
          title: `${successes} ocorrência(s) sincronizada(s)!`,
          description: failures > 0 ? `${failures} falharam.` : undefined,
        });
      }
    } catch (error) {
      console.error('Erro na sincronização automática:', error);
      setSyncingIds(new Set());
    } finally {
      setIsSyncing(false);
    }
  };

  const loadData = async () => {
    if (typeof window !== 'undefined') {
      const activeOccurrences = await db.getActiveOccurrences();
      setOccurrences(activeOccurrences.reverse());

      const offlineCount = activeOccurrences.filter(occ => !occ.synced).length;
      setOfflineOccurrencesCount(offlineCount);

      // NÃO sincronizar automaticamente - usuário controla quando sincronizar
    }
  };

  useEffect(() => {
    // Limpar dados antigos de roteiro
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentRoteiroData');
    }
    loadData();
  }, []);

  // Recarregar quando a página ganhar foco (quando voltar de adicionar ocorrência)
  useEffect(() => {
    const handleFocus = () => {
      loadData();

      // Verificar se há código escaneado no localStorage
      if (typeof window !== 'undefined') {
        const scannedCode = localStorage.getItem('scannedCode');
        if (scannedCode) {
          // Limpar do localStorage
          localStorage.removeItem('scannedCode');
          // Abrir formulário manual
          setViewMode('manual');
        }
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadData();

        // Verificar se há código escaneado no localStorage
        if (typeof window !== 'undefined') {
          const scannedCode = localStorage.getItem('scannedCode');
          if (scannedCode) {
            // Limpar do localStorage
            localStorage.removeItem('scannedCode');
            // Abrir formulário manual
            setViewMode('manual');
          }
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Interceptar botão/gesto de voltar do dispositivo
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Se voltou e estava em scan ou manual, volta para list
      if (viewMode === 'scan' || viewMode === 'manual') {
        handleBackToList();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [viewMode]);

  const handleNewOccurrence = () => {
    setViewMode('scan');
    // Adiciona entrada no histórico para permitir voltar com botão/gesto do dispositivo
    window.history.pushState({ viewMode: 'scan' }, '');
  };

  const handleManualEntry = () => {
    setViewMode('manual');
    // Adiciona entrada no histórico para permitir voltar com botão/gesto do dispositivo
    window.history.pushState({ viewMode: 'manual' }, '');
  };

  const handleBackToList = () => {
    // Verificar se há código escaneado no localStorage
    if (typeof window !== 'undefined') {
      const scannedCode = localStorage.getItem('scannedCode');
      if (scannedCode) {
        // Não limpar ainda - deixar para o formulário pegar
        // Abrir formulário manual
        setViewMode('manual');
        return;
      }
    }

    setViewMode('list');
    // Recarregar dados quando voltar para lista
    loadData();
  };

  const handleDeleteOccurrence = async (id: number) => {
    try {
      await db.deleteOccurrence(id);
      toast({
        title: "Ocorrência excluída",
        description: "A ocorrência foi removida do dispositivo.",
      });
      loadData(); // Recarregar lista
    } catch (error) {
      console.error('Erro ao excluir ocorrência:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a ocorrência.",
      });
    }
  };

  const handleSyncAll = useCallback(async () => {
    if (isSyncing) return;

    setIsSyncing(true);

    try {
      // Verificar conexão testando a API
      const hasConnection = await apiService.checkConnection();

      if (!hasConnection) {
        toast({
          variant: "destructive",
          title: "Sem conexão",
          description: "Não há conexão com a internet. Verifique sua rede e tente novamente.",
        });
        setIsSyncing(false);
        return;
      }

      const activeOccurrences = await db.getActiveOccurrences();
      const unsyncedOccurrences = activeOccurrences.filter(occ => !occ.synced);

      if (unsyncedOccurrences.length === 0) {
        toast({
          title: "Tudo sincronizado!",
        });
        setIsSyncing(false);
        return;
      }

      toast({
        title: "Sincronizando...",
        description: `Enviando ${unsyncedOccurrences.length} ocorrência(s) para o servidor.`,
      });

      let successCount = 0;
      let failureCount = 0;

      // Sincronizar uma por vez
      for (const occurrence of unsyncedOccurrences) {
        // Marcar como sincronizando
        setSyncingIds(new Set([occurrence.id]));

        try {
          const result = await apiService.syncOccurrence(occurrence);

          if (result.success) {
            // SUCESSO: Excluir do IndexDB
            await db.deleteOccurrence(occurrence.id);
            successCount++;

            // Recarregar lista para mostrar que foi removido
            await loadData();
          } else {
            // FALHOU: Manter no IndexDB
            failureCount++;
          }
        } catch (error) {
          console.error(`Erro ao sincronizar ocorrência ${occurrence.id}:`, error);
          failureCount++;
        }
      }

      // Limpar estado de sincronização
      setSyncingIds(new Set());
      await loadData();

      // Mostrar resultado
      if (successCount > 0) {
        toast({
          title: `${successCount} ocorrência(s) sincronizada(s)!`,
          description: failureCount > 0 ? `${failureCount} falharam e permaneceram na lista.` : "Todas as ocorrências foram enviadas com sucesso.",
        });
      }

      if (failureCount > 0 && successCount === 0) {
        toast({
          variant: "destructive",
          title: "Erro na sincronização",
          description: "Não foi possível sincronizar as ocorrências. Verifique sua conexão.",
        });
      }

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro na sincronização",
        description: "Ocorreu um erro durante a sincronização.",
      });
      setSyncingIds(new Set());
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, toast]);


  const handleInstallClick = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      toast({
        title: 'App instalado!',
        description: 'O ScanTracker foi adicionado à sua tela inicial.',
      });
    }
    setInstallPrompt(null);
  };

  // Pull to refresh logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isSyncing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > 0 && window.scrollY === 0) {
        e.preventDefault();
        const distance = Math.min(diff * 0.5, 120);
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling || isSyncing) return;

      setIsPulling(false);

      if (pullDistance >= 80) {
        await handleSyncAll();
      }

      setPullDistance(0);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, isSyncing, pullDistance, handleSyncAll]);

  const getOccurrenceLabel = (value: string) => {
    switch (value) {
      case 'entregue': return 'Entregue';
      case 'avaria': return 'Avaria';
      case 'extravio': return 'Extravio';
      case 'devolucao': return 'Devolução';
      case 'recusado': return 'Recusado';
      case 'feriado': return 'Feriado';
      case 'outros': return 'Outros';
      default: return value;
    }
  };

  const shouldShowIndicator = isPulling || isSyncing;
  const getIndicatorText = () => {
    if (isSyncing) return "Sincronizando...";
    if (pullDistance >= 80) return "Solte para sincronizar";
    return "Puxe para sincronizar";
  };

  // Header unificado
  const renderHeader = () => (
    <header className="sticky top-0 z-10 flex h-20 items-center justify-between gap-4 px-4 shadow-sm md:px-6" style={{backgroundColor: '#222E3C'}}>
      <div className="flex items-center gap-4">
        {viewMode === 'list' && (
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-white hover:bg-white/10 rounded transition-colors"
          >
            <Menu className="h-8 w-8" />
          </button>
        )}
      </div>
      <div className="absolute left-1/2 transform -translate-x-1/2">
        <Image
          src="/logistik-dark.png"
          alt="Logistik"
          width={140}
          height={32}
          priority
        />
      </div>
      <div className="flex items-center gap-2">
        {offlineOccurrencesCount > 0 && (
          <button
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Sincronizar ocorrências"
          >
            <RefreshCw className={`h-5 w-5 text-white ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );

  // Renderizar modo Scanner
  if (viewMode === 'scan') {
    return (
      <AuthGuard>
        <ScannerCamera onBackToList={handleBackToList} />
      </AuthGuard>
    );
  }

  // Renderizar modo Manual
  if (viewMode === 'manual') {
    return (
      <AuthGuard>
        <div className="flex min-h-screen w-full flex-col bg-secondary">
          {renderHeader()}
          <main className="flex flex-1 flex-col overflow-y-auto">
            <Suspense fallback={<div className="flex items-center justify-center h-96">Carregando...</div>}>
              <ScanForm onBackToList={handleBackToList} />
            </Suspense>
          </main>
        </div>
      </AuthGuard>
    );
  }

  // Renderizar modo Lista (padrão)
  return (
    <AuthGuard>
    <div ref={containerRef} className="flex min-h-screen w-full flex-col bg-secondary relative">
      {/* Pull to refresh indicator */}
      {shouldShowIndicator && (
        <div
          className="absolute top-0 left-0 right-0 z-20 flex flex-col items-center justify-center bg-secondary border-b shadow-sm transition-all duration-200"
          style={{
            height: `${Math.max(pullDistance, 60)}px`,
            transform: `translateY(-${Math.max(60 - pullDistance, 0)}px)`,
            opacity: Math.min(pullDistance / 80, 1)
          }}
        >
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
            ) : (
              <div
                className="transition-transform duration-200"
                style={{ transform: `scale(${Math.min(0.5 + (pullDistance / 80) * 0.5, 1)})` }}
              >
                <RefreshCw className="h-5 w-5 text-blue-500" />
              </div>
            )}
            <span className="text-sm text-muted-foreground">{getIndicatorText()}</span>
          </div>
        </div>
      )}

      {renderHeader()}
      <main className="flex flex-1 flex-col items-center p-4 text-center pb-24">
        {occurrences.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <h2 className="text-xl text-muted-foreground">
              Nenhuma ocorrência registrada ainda.
            </h2>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-4">
            {occurrences.map((occ, index) => (
               <Card key={index} className="text-left relative">
                <CardHeader className="p-4">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary"/>
                      {getOccurrenceLabel(occ.occurrence)}
                    </div>
                    <div className="flex items-center gap-2">
                      {syncingIds.has(occ.id) ? (
                        <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" title="Sincronizando..." />
                      ) : occ.synced ? (
                        <CheckCircle className="h-5 w-5 text-green-500" title="Sincronizado" />
                      ) : (
                        <Clock4 className="h-5 w-5 text-yellow-500" title="Aguardando sincronização" />
                      )}
                      <button
                        onClick={() => handleDeleteOccurrence(occ.id)}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                        title="Excluir ocorrência"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-muted-foreground break-all">
                    <b>Código:</b> {occ.scannedCode}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4"/>
                    {new Date(occ.timestamp).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <footer className="fixed bottom-0 left-0 right-0 z-10 flex justify-center items-center gap-4 border-t p-4" style={{backgroundColor: '#222E3C'}}>
        <Button
          variant="default"
          size="icon"
          className="h-16 w-16 rounded-full shadow-lg"
          style={{ backgroundColor: '#FFA500' }}
          onClick={handleNewOccurrence}
          aria-label="Nova Ocorrência"
        >
          <QrCode className="h-10 w-10 text-black" />
        </Button>
        <Button
          variant="default"
          size="icon"
          className="h-16 w-16 rounded-full shadow-lg"
          style={{ backgroundColor: '#FFA500' }}
          onClick={handleManualEntry}
          aria-label="Entrada Manual"
        >
          <Edit3 className="h-10 w-10 text-black" />
        </Button>
      </footer>

      {/* Sidebar */}
      <div className="fixed inset-0 z-50 flex pointer-events-none" style={{top: '80px'}}>
        {/* Overlay */}
        <div
          className={`absolute inset-0 bg-black transition-opacity duration-300 ease-in-out ${
            isSidebarOpen ? 'opacity-50 pointer-events-auto' : 'opacity-0'
          }`}
          onClick={() => setIsSidebarOpen(false)}
        />

        {/* Sidebar */}
        <div
          className={`relative mr-auto w-80 shadow-xl transition-transform duration-300 ease-in-out pointer-events-auto ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{backgroundColor: '#222E3C', height: 'calc(100vh - 80px)'}}
        >
          <div className="flex flex-col h-full p-6">
            {/* User Info */}
            {user && (
              <div className="mb-8">
                <div className="flex items-center gap-4">
                  {/* Initials Circle */}
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{backgroundColor: '#FFA500'}}>
                    {user.initials}
                  </div>
                  <div>
                    <div className="text-white font-semibold text-lg">
                      {user.full_name}
                    </div>
                    <div className="text-gray-300 text-sm">
                      {user.email}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Spacer to push footer to bottom */}
            <div className="flex-1"></div>

            {/* Footer with Logout */}
            <div className="border-t border-white/20 pt-4">
              <button
                onClick={() => {
                  logout();
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 p-4 text-left text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                </div>
                <span className="text-lg">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </AuthGuard>
  );
}
