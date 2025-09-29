"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { WifiOff, Wifi, Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/db';
import { apiService } from '@/lib/api';
import { Package, Calendar, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouteProtection } from '@/hooks/use-route-protection';

type Roteiro = {
  id: number;
  startDate: string;
  endDate: string;
  totalOccurrences: number;
  syncedOccurrences: number;
  vehiclePlate?: string;
  startKm?: number;
};

export default function Home() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);
  const [roteiros, setRoteiros] = useState<Roteiro[]>([]);
  const [activeRoteiro, setActiveRoteiro] = useState<any>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [startKm, setStartKm] = useState('');
  const [isCreatingRoteiro, setIsCreatingRoteiro] = useState(false);
  const { toast } = useToast();
  const { hasActiveRoteiro, isLoading, redirectToRoteiro } = useRouteProtection();

  // Redirecionar para /roteiro se houver roteiro ativo
  useEffect(() => {
    if (!isLoading && hasActiveRoteiro) {
      redirectToRoteiro();
    }
  }, [hasActiveRoteiro, isLoading, redirectToRoteiro]);

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

    // Carregar roteiros finalizados e roteiro ativo
    async function loadData() {
      if (typeof window !== 'undefined') {
        console.log('Carregando roteiros...');
        const savedRoteiros = await db.getAllRoteiros();
        console.log('Roteiros carregados:', savedRoteiros);
        setRoteiros(savedRoteiros.reverse());

        // Carregar roteiro ativo baseado no localStorage
        const roteiroData = localStorage.getItem('currentRoteiroData');
        if (roteiroData) {
          const data = JSON.parse(roteiroData);
          // Só considerar roteiro ativo se tem apiRoteiroId (criado via API)
          if (data.apiRoteiroId) {
            const activeOccurrences = await db.getActiveOccurrences();
            const syncedCount = activeOccurrences.filter(occ => occ.synced).length;

            setActiveRoteiro({
              occurrences: activeOccurrences,
              totalOccurrences: activeOccurrences.length,
              syncedOccurrences: syncedCount,
              vehiclePlate: data.vehiclePlate || 'Roteiro Ativo',
              apiRoteiroId: data.apiRoteiroId
            });
          } else {
            // Dados inválidos no localStorage, limpar
            localStorage.removeItem('currentRoteiroData');
            setActiveRoteiro(null);
          }
        } else {
          setActiveRoteiro(null);
        }
      }
    }

    loadData();

    // Recarregar roteiros quando a página volta ao foco (após finalizar roteiro)
    const handleFocus = () => {
      console.log('Página ganhou foco, recarregando roteiros...');
      loadData();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Recarregar sempre que a página for visitada (incluindo navegação)
  useEffect(() => {
    async function reloadData() {
      if (typeof window !== 'undefined') {
        console.log('Recarregando dados via navegação...');
        const savedRoteiros = await db.getAllRoteiros();
        console.log('Roteiros recarregados:', savedRoteiros);
        setRoteiros(savedRoteiros.reverse());

        // Carregar roteiro ativo baseado no localStorage
        const roteiroData = localStorage.getItem('currentRoteiroData');
        if (roteiroData) {
          const data = JSON.parse(roteiroData);
          // Só considerar roteiro ativo se tem apiRoteiroId (criado via API)
          if (data.apiRoteiroId) {
            const activeOccurrences = await db.getActiveOccurrences();
            const syncedCount = activeOccurrences.filter(occ => occ.synced).length;

            setActiveRoteiro({
              occurrences: activeOccurrences,
              totalOccurrences: activeOccurrences.length,
              syncedOccurrences: syncedCount,
              vehiclePlate: data.vehiclePlate || 'Roteiro Ativo',
              apiRoteiroId: data.apiRoteiroId
            });
          } else {
            // Dados inválidos no localStorage, limpar
            localStorage.removeItem('currentRoteiroData');
            setActiveRoteiro(null);
          }
        } else {
          setActiveRoteiro(null);
        }
      }
    }
    reloadData();
  }, [router]);

  const handleStartNewRoteiro = () => {
    setShowStartDialog(true);
  };

  const handleStartRoteiroSubmit = async () => {
    if (!vehiclePlate.trim() || !startKm.trim()) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha a placa do veículo e a quilometragem inicial."
      });
      return;
    }

    // Verificar se está online
    if (!isOnline) {
      toast({
        variant: "destructive",
        title: "Sem conexão",
        description: "É necessário estar online para iniciar um novo roteiro."
      });
      return;
    }

    setIsCreatingRoteiro(true);

    try {
      // Criar roteiro na API primeiro
      const roteiroData = {
        vehiclePlate: vehiclePlate.trim(),
        startKm: parseInt(startKm),
        startDate: new Date().toISOString()
      };

      const result = await apiService.createRoteiro(roteiroData);

      if (result.success && result.id) {
        // Salvar dados do roteiro com o ID da API
        localStorage.setItem('currentRoteiroData', JSON.stringify({
          ...roteiroData,
          apiRoteiroId: result.id
        }));

        setShowStartDialog(false);
        setVehiclePlate('');
        setStartKm('');
        router.push('/roteiro');
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao criar roteiro",
          description: result.error || "Não foi possível criar o roteiro na API."
        });
      }
    } catch (error) {
      console.error('Erro ao criar roteiro:', error);
      toast({
        variant: "destructive",
        title: "Erro de conexão",
        description: "Não foi possível conectar com o servidor."
      });
    } finally {
      setIsCreatingRoteiro(false);
    }
  };

  const handleFinishRoteiro = async () => {
    if (!activeRoteiro || typeof window === 'undefined') return;

    const totalOccurrences = activeRoteiro.totalOccurrences;
    const syncedOccurrences = activeRoteiro.syncedOccurrences;

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
        for (const occurrence of activeRoteiro.occurrences) {
          await db.updateOccurrenceWithRoteiro(occurrence.id, roteiroId as number, occurrence.synced || false);
        }
      }

      // Limpar dados do localStorage
      localStorage.removeItem('currentRoteiroData');

      // Recarregar dados
      const savedRoteiros = await db.getAllRoteiros();
      setRoteiros(savedRoteiros.reverse());
      setActiveRoteiro(null);

    } catch (error) {
      console.error('Erro ao salvar roteiro:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível finalizar o roteiro."
      });
    }
  };

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
          {!isOnline ? (
            <WifiOff className="h-5 w-5 text-white" />
          ) : (
            <Wifi className="h-5 w-5 text-white" />
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center p-4 text-center pb-24">

        <div className="w-full max-w-2xl space-y-6">
          {/* Roteiro ativo */}
          {activeRoteiro && (
            <div className="space-y-4">
              <Card
                className="text-left cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => router.push('/roteiro')}
              >
                <CardHeader className="p-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary"/>
                    {activeRoteiro.vehiclePlate || 'Roteiro Ativo'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground"/>
                      <span className="text-sm text-muted-foreground">
                        {new Date().toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {activeRoteiro.syncedOccurrences}/{activeRoteiro.totalOccurrences}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Roteiros finalizados */}
          {roteiros.length > 0 && (
            <div className="space-y-4">
              {roteiros.map((roteiro) => (
                <Card
                  key={roteiro.id}
                  className="text-left cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => router.push(`/roteiro/${roteiro.id}`)}
                >
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="h-5 w-5 text-primary"/>
                        {roteiro.vehiclePlate || `Roteiro #${roteiro.id}`}
                      </div>
                      <div className="text-sm text-green-600 font-bold">
                        Finalizado
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground"/>
                        <span className="text-sm text-muted-foreground">
                          {new Date(roteiro.endDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {roteiro.syncedOccurrences}/{roteiro.totalOccurrences}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Mensagem quando não há roteiros */}
          {!activeRoteiro && roteiros.length === 0 && (
            <div className="text-muted-foreground">
              Nenhum roteiro ainda.
            </div>
          )}
        </div>
      </main>

      <footer className="sticky bottom-0 z-10 flex justify-center items-center gap-4 border-t p-4" style={{backgroundColor: '#222E3C'}}>
        <Button
          onClick={handleStartNewRoteiro}
          size="icon"
          className="h-16 w-48 rounded-full shadow-lg text-black text-lg font-semibold"
          style={{ backgroundColor: activeRoteiro || !isOnline ? '#FFBB66' : '#FFA500' }}
          disabled={!!activeRoteiro || !isOnline}
        >
          Iniciar Roteiro
        </Button>
      </footer>

      {/* Modal para iniciar roteiro */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Iniciar Roteiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="vehiclePlate">Placa do Veículo</Label>
              <Input
                id="vehiclePlate"
                placeholder="Ex: ABC-1234"
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                className="uppercase input-custom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startKm">Quilometragem Inicial</Label>
              <Input
                id="startKm"
                type="number"
                placeholder="Ex: 12000"
                value={startKm}
                onChange={(e) => setStartKm(e.target.value)}
                className="input-custom"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowStartDialog(false);
                setVehiclePlate('');
                setStartKm('');
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleStartRoteiroSubmit}
              style={{ backgroundColor: '#FFA500' }}
              disabled={isCreatingRoteiro || !isOnline}
            >
              {isCreatingRoteiro ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-black" />
                  Criando...
                </>
              ) : (
                'Iniciar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}