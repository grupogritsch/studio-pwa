
"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { QrCode, Check, Package, Clock, WifiOff, Download, Edit3, Clock4, CheckCircle, RefreshCw, Wifi, Send } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { apiService } from '@/lib/api';
import { useRouteProtection } from '@/hooks/use-route-protection';


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


export default function RoteiroPage() {
  const router = useRouter();
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [offlineOccurrencesCount, setOfflineOccurrencesCount] = useState(0);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { hasActiveRoteiro, isLoading, redirectToHome } = useRouteProtection();

  // Redirecionar para home se não houver roteiro ativo
  useEffect(() => {
    if (!isLoading && !hasActiveRoteiro) {
      redirectToHome();
    }
  }, [hasActiveRoteiro, isLoading, redirectToHome]);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
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
      console.log('Carregando ocorrências ativas...');
      const activeOccurrences = await db.getActiveOccurrences();
      console.log('Ocorrências carregadas na página roteiro:', activeOccurrences);
      setOccurrences(activeOccurrences.reverse());

      const offlineCount = activeOccurrences.filter(occ => !occ.synced).length;
      setOfflineOccurrencesCount(offlineCount);

      // Sincronizar automaticamente se estiver online e houver dados pendentes
      if (isOnline && offlineCount > 0 && !isSyncing) {
        await syncPendingData();
        // Recarregar dados após sincronização
        const updatedOccurrences = await db.getActiveOccurrences();
        setOccurrences(updatedOccurrences.reverse());
        const updatedOfflineCount = updatedOccurrences.filter(occ => !occ.synced).length;
        setOfflineOccurrencesCount(updatedOfflineCount);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Recarregar quando a página ganhar foco (quando voltar de adicionar ocorrência)
  useEffect(() => {
    const handleFocus = () => {
      console.log('Página roteiro ganhou foco, recarregando...');
      loadData();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Página roteiro ficou visível, recarregando...');
        loadData();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleNewOccurrence = () => {
    router.push('/scanner');
  };

  const handleManualEntry = () => {
    router.push('/ocorrencia?mode=manual');
  };

  const handleFinishRoteiro = async () => {
    if (typeof window === 'undefined') return;

    const totalOccurrences = occurrences.length;
    const syncedOccurrences = occurrences.filter(occ => occ.synced).length;

    console.log('Finalizando roteiro:', { totalOccurrences, syncedOccurrences });

    // Recuperar dados do roteiro do localStorage
    const roteiroData = localStorage.getItem('currentRoteiroData');
    let vehiclePlate = '';
    let startKm = 0;
    let startDate = new Date().toISOString();
    let apiRoteiroId = null;

    if (roteiroData) {
      const data = JSON.parse(roteiroData);
      vehiclePlate = data.vehiclePlate || '';
      startKm = data.startKm || 0;
      startDate = data.startDate || startDate;
      apiRoteiroId = data.apiRoteiroId || null;
    }

    // Salvar resumo do roteiro
    const now = new Date().toISOString();
    const roteiroSummary = {
      startDate,
      endDate: now,
      totalOccurrences,
      syncedOccurrences,
      vehiclePlate,
      startKm
    };

    console.log('Salvando roteiro:', roteiroSummary);

    try {
      const roteiroId = await db.addRoteiro(roteiroSummary);
      console.log('Roteiro salvo com ID:', roteiroId);

      // Associar todas as ocorrências ao roteiro (usando o ID local, não o da API)
      // Se o roteiro foi criado via API, as ocorrências já devem ter o apiRoteiroId
      if (!apiRoteiroId) {
        // Fallback para roteiros antigos
        for (const occurrence of occurrences) {
          await db.updateOccurrenceWithRoteiro(occurrence.id, roteiroId as number, occurrence.synced || false);
        }
      }

      // Limpar dados do localStorage
      localStorage.removeItem('currentRoteiroData');

      // Limpar apenas as ocorrências do roteiro atual (não todas)
      setOccurrences([]);
      setOfflineOccurrencesCount(0);

      // Voltar para a página inicial
      router.push('/');
    } catch (error) {
      console.error('Erro ao salvar roteiro:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível finalizar o roteiro."
      });
    }
  };

  const handleSyncAll = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const activeOccurrences = await db.getActiveOccurrences();
      const unsyncedOccurrences = activeOccurrences.filter(occ => !occ.synced);

      if (unsyncedOccurrences.length === 0) {
        toast({
          title: "Tudo sincronizado!",
        });
        setIsSyncing(false);
        return;
      }

      // Add all IDs to syncing state
      const idsToSync = new Set(unsyncedOccurrences.map(occ => occ.id));
      setSyncingIds(idsToSync);

      toast({
        title: "Sincronizando...",
        description: `Enviando ${unsyncedOccurrences.length} ocorrência(s) para o servidor.`,
      });

      const { successes, failures, results } = await apiService.syncMultipleOccurrences(unsyncedOccurrences);

      // Update sync status for successful ones
      for (let i = 0; i < unsyncedOccurrences.length; i++) {
        const occurrence = unsyncedOccurrences[i];
        const result = results[i];
        if (result.success) {
          await db.updateOccurrenceSync(occurrence.id, true);
        }
      }

      // Clear syncing state and reload data
      setSyncingIds(new Set());
      await loadData();

      if (successes > 0) {
        toast({
          title: `${successes} ocorrência(s) sincronizada(s)!`,
          description: failures > 0 ? `${failures} falharam. Tente novamente.` : "Todas as ocorrências foram enviadas com sucesso.",
        });
      }

      if (failures > 0 && successes === 0) {
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
  }, [isOnline, isSyncing, toast]);

  const handleFinish = async () => {
    if (typeof window !== 'undefined') {
      const totalOccurrences = occurrences.length;
      const syncedOccurrences = occurrences.filter(occ => occ.synced).length;

      console.log('Finalizando roteiro:', { totalOccurrences, syncedOccurrences });

      // Salvar resumo do roteiro
      const now = new Date().toISOString();
      const roteiroSummary = {
        startDate: now, // TODO: Capturar data real de início
        endDate: now,
        totalOccurrences,
        syncedOccurrences
      };

      console.log('Salvando roteiro:', roteiroSummary);

      try {
        const roteiroId = await db.addRoteiro(roteiroSummary);
        console.log('Roteiro salvo com ID:', roteiroId);

        // Associar todas as ocorrências ao roteiro
        for (const occurrence of occurrences) {
          await db.updateOccurrenceWithRoteiro(occurrence.id, roteiroId as number, occurrence.synced || false);
        }

        // Limpar apenas as ocorrências do roteiro atual (não todas)
        setOccurrences([]);
        setOfflineOccurrencesCount(0);

        // Voltar para a página inicial
        router.push('/');
      } catch (error) {
        console.error('Erro ao salvar roteiro:', error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível finalizar o roteiro."
        });
      }
    }
  };

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

  // Mostrar loading enquanto verifica
  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-secondary">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between gap-4 border-b px-4 shadow-sm md:px-6" style={{backgroundColor: '#222E3C'}}>
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            fontFamily: 'Roboto Bold',
            letterSpacing: '1px',
          }}>
            <span style={{color:'#ffffff'}}>LOGISTI</span><span style={{ color: '#FFA500' }}>K</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-white" />
          </div>
        </header>
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

      <header className="sticky top-0 z-10 flex h-20 items-center justify-between gap-4 border-b px-4 shadow-sm md:px-6" style={{backgroundColor: '#222E3C'}}>
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          fontFamily: 'Roboto Bold',
          letterSpacing: '1px',
        }}>
          <span style={{color:'#ffffff'}}>LOGISTI</span><span style={{ color: '#FFA500' }}>K</span>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <WifiOff className="h-5 w-5 text-white" />
          ) : (
            <Wifi className="h-5 w-5 text-white" />
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center p-4 text-center pb-24">
        {offlineOccurrencesCount > 0 && (
          <div className="w-full max-w-2xl mb-4">
            <Card className="bg-destructive/10 border-destructive/50">
              <CardContent className="p-3 flex items-center justify-center gap-2 text-destructive">
                <WifiOff className="h-5 w-5 text-white"/>
                <p className="font-semibold">{offlineOccurrencesCount} ocorrência(s) aguardando para sincronizar.</p>
              </CardContent>
            </Card>
          </div>
        )}
        {occurrences.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <h2 className="text-xl text-muted-foreground">
              Nenhuma ocorrência registrada ainda.
            </h2>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-4">
            {occurrences.map((occ, index) => (
               <Card key={index} className="text-left">
                <CardHeader className="p-4">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary"/>
                      {getOccurrenceLabel(occ.occurrence)}
                    </div>
                    {syncingIds.has(occ.id) ? (
                      <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" title="Sincronizando..." />
                    ) : occ.synced ? (
                      <CheckCircle className="h-5 w-5 text-green-500" title="Sincronizado" />
                    ) : (
                      <Clock4 className="h-5 w-5 text-yellow-500" title="Aguardando sincronização" />
                    )}
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
      <footer className="sticky bottom-0 z-10 flex justify-center items-center gap-4 border-t p-4" style={{backgroundColor: '#222E3C'}}>
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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-16 w-16 rounded-full shadow-lg text-black border-white/20 hover:bg-white/10"
              aria-label="Finalizar Roteiro"
            >
              <Send className="h-10 w-10 text-black" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalizar Roteiro</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que quer finalizar o roteiro? Esta ação não pode ser desfeita e o roteiro será movido para o histórico.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFinishRoteiro}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </footer>
    </div>
  );
}
