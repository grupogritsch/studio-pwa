
"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { QrCode, Check, Package, Clock, WifiOff, Download, Edit3, Clock4, CheckCircle, RefreshCw, Wifi, ArrowLeft } from 'lucide-react';
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

  useEffect(() => {
    async function loadData() {
      if (typeof window !== 'undefined') {
        const savedOccurrences = await db.getAllOccurrences();
        setOccurrences(savedOccurrences.reverse());

        const offlineCount = await db.countOfflineOccurrences();
        setOfflineOccurrencesCount(offlineCount);
      }
    }
    loadData();
  }, []);

  const handleNewOccurrence = () => {
    router.push('/scanner');
  };

  const handleManualEntry = () => {
    router.push('/ocorrencia?mode=manual');
  };

  const handleSyncAll = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const unsyncedOccurrences = await db.getUnsyncedOccurrences();

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
      const savedOccurrences = await db.getAllOccurrences();
      setOccurrences(savedOccurrences.reverse());

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

        toast({
          title: "Roteiro finalizado",
          description: `${totalOccurrences} ocorrências registradas.`
        });

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
          {!isOnline && <WifiOff className="h-5 w-5 text-red-500" />}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center p-4 text-center pb-24">
        {offlineOccurrencesCount > 0 && (
          <div className="w-full max-w-2xl mb-4">
            <Card className="bg-destructive/10 border-destructive/50">
              <CardContent className="p-3 flex items-center justify-center gap-2 text-destructive">
                <WifiOff className="h-5 w-5"/>
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
          variant="secondary"
          size="icon"
          className="h-16 w-16 rounded-full shadow-lg"
          onClick={handleNewOccurrence}
          aria-label="Nova Ocorrência"
        >
          <QrCode className="h-10 w-10" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-16 w-16 rounded-full shadow-lg"
          onClick={handleManualEntry}
          aria-label="Entrada Manual"
        >
          <Edit3 className="h-10 w-10" />
        </Button>
      </footer>
    </div>
  );
}
