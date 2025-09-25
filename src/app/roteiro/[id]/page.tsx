"use client";

import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Package, Clock, CheckCircle, Clock4, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/db';

type Occurrence = {
  id: number;
  scannedCode: string;
  occurrence: string;
  timestamp: string;
  receiverName?: string;
  receiverDocument?: string;
  synced?: boolean;
  roteiroId?: number;
};

type Roteiro = {
  id: number;
  startDate: string;
  endDate: string;
  totalOccurrences: number;
  syncedOccurrences: number;
};

export default function RoteiroDetailPage() {
  const router = useRouter();
  const params = useParams();
  const roteiroId = parseInt(params.id as string);
  const [roteiro, setRoteiro] = useState<Roteiro | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    updateOnlineStatus();
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));

    return () => {
      window.removeEventListener('online', () => setIsOnline(true));
      window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, []);

  useEffect(() => {
    async function loadData() {
      if (typeof window !== 'undefined' && roteiroId) {
        // Carregar dados do roteiro
        const allRoteiros = await db.getAllRoteiros();
        const currentRoteiro = allRoteiros.find(r => r.id === roteiroId);

        if (currentRoteiro) {
          setRoteiro(currentRoteiro);
        }

        // Carregar ocorrências do roteiro
        const roteiroOccurrences = await db.getOccurrencesByRoteiro(roteiroId);
        setOccurrences(roteiroOccurrences.reverse());
      }
    }
    loadData();
  }, [roteiroId]);

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

  const handleBack = () => {
    router.push('/');
  };

  if (!roteiro) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-secondary">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-center gap-4 border-b px-4 shadow-sm md:px-6" style={{backgroundColor: '#222E3C'}}>
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            fontFamily: 'Roboto Bold',
            letterSpacing: '1px',
          }}>
            <span style={{color:'#ffffff'}}>LOGISTI</span><span style={{ color: '#FFA500' }}>K</span>
          </div>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center p-4">
          <p>Carregando...</p>
        </main>
      </div>
    );
  }

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
          {!isOnline && <WifiOff className="h-5 w-5 text-red-500" />}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center p-4 text-center pb-24">
        {/* Card do roteiro */}
        <div className="w-full max-w-2xl mb-6">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-6 w-6 text-primary"/>
                  Roteiro #{roteiro.id}
                </div>
                <div className="text-lg font-bold">
                  {roteiro.syncedOccurrences}/{roteiro.totalOccurrences}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Finalizado em: {new Date(roteiro.endDate).toLocaleDateString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  {roteiro.totalOccurrences} ocorrência{roteiro.totalOccurrences !== 1 ? 's' : ''}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de ocorrências */}
        <div className="w-full max-w-2xl">
          <h2 className="text-xl font-semibold mb-4 text-left">Ocorrências</h2>
          {occurrences.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma ocorrência encontrada para este roteiro.
            </div>
          ) : (
            <div className="space-y-4">
              {occurrences.map((occ) => (
                <Card key={occ.id} className="text-left">
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary"/>
                        {getOccurrenceLabel(occ.occurrence)}
                      </div>
                      {occ.synced ? (
                        <CheckCircle className="h-5 w-5 text-green-500" title="Sincronizado" />
                      ) : (
                        <Clock4 className="h-5 w-5 text-yellow-500" title="Não sincronizado" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-sm text-muted-foreground break-all">
                      <b>Código:</b> {occ.scannedCode}
                    </p>
                    {occ.receiverName && (
                      <p className="text-sm text-muted-foreground">
                        <b>Recebedor:</b> {occ.receiverName}
                      </p>
                    )}
                    {occ.receiverDocument && (
                      <p className="text-sm text-muted-foreground">
                        <b>Documento:</b> {occ.receiverDocument}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4"/>
                      {new Date(occ.timestamp).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}