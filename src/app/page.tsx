
"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Check, Package, Clock, WifiOff } from 'lucide-react';
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
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';


type Occurrence = {
  scannedCode: string;
  occurrence: string;
  timestamp: string;
};

export default function Home() {
  const router = useRouter();
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [offlineOccurrencesCount, setOfflineOccurrencesCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedOccurrences = JSON.parse(localStorage.getItem('occurrences') || '[]');
      setOccurrences(savedOccurrences);

      const offlineData = JSON.parse(localStorage.getItem('offlineOccurrences') || '[]');
      setOfflineOccurrencesCount(offlineData.length);

      const handleOnline = () => {
        const offlineDataToSync = JSON.parse(localStorage.getItem('offlineOccurrences') || '[]');
        if (offlineDataToSync.length > 0) {
          // Here you would normally sync with your API.
          // For now, we'll just clear it and notify the user.
          console.log('Syncing offline data...', offlineDataToSync);
          localStorage.removeItem('offlineOccurrences');
          setOfflineOccurrencesCount(0);
          toast({
            title: "Sincronização completa!",
            description: `${offlineDataToSync.length} ocorrências offline foram enviadas.`,
          });
        }
      };

      window.addEventListener('online', handleOnline);

      return () => {
        window.removeEventListener('online', handleOnline);
      };
    }
  }, [toast]);

  const handleNewOccurrence = () => {
    router.push('/ocorrencia');
  };

  const handleFinish = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('occurrences');
      localStorage.removeItem('offlineOccurrences');
      setOccurrences([]);
      setOfflineOccurrencesCount(0);
    }
    console.log("Roteiro finalizado e dados limpos.");
  };
  
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

  return (
    <div className="flex min-h-screen w-full flex-col bg-secondary">
      <header className="sticky top-0 z-10 flex h-20 items-center justify-center gap-4 border-b bg-primary px-4 shadow-sm md:px-6">
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          fontFamily: 'Arial, Helvetica, sans-serif',
          letterSpacing: '1px',
          textAlign: 'center'
        }}>
          <span style={{color:'#ffffff'}}>LOGISTI</span><span style={{ color: '#FF914D' }}>K</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center p-4 text-center">
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
            <h2 className="text-2xl font-bold text-left">Ocorrências Registradas</h2>
            {occurrences.map((occ, index) => (
               <Card key={index} className="text-left">
                <CardHeader className="p-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary"/>
                    {getOccurrenceLabel(occ.occurrence)}
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
      <footer className="sticky bottom-0 z-10 flex justify-center items-center gap-4 bg-transparent p-4">
        <Button
          variant="default"
          size="icon"
          className="h-16 w-16 rounded-full shadow-lg"
          onClick={handleNewOccurrence}
          aria-label="Nova Ocorrência"
        >
          <Plus className="h-10 w-10" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="h-16 w-16 rounded-full shadow-lg bg-accent hover:bg-accent/90"
              aria-label="Finalizar"
              disabled={occurrences.length === 0}
            >
              <Check className="h-10 w-10" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalizar Roteiro</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que quer finalizar o roteiro? Esta ação não pode ser desfeita e limpará todas as ocorrências registradas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleFinish}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </footer>
    </div>
  );
}
