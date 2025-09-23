
"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  const handleNewOccurrence = () => {
    router.push('/ocorrencia');
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
      <main className="flex flex-1 flex-col items-center justify-center p-4 text-center">
        <h2 className="text-xl text-muted-foreground">
          Nenhuma ocorrência registrada ainda.
        </h2>
      </main>
      <footer className="sticky bottom-0 z-10 flex justify-center bg-transparent p-4">
        <Button
          variant="default"
          size="icon"
          className="h-16 w-16 rounded-full shadow-lg"
          onClick={handleNewOccurrence}
          aria-label="Nova Ocorrência"
        >
          <Plus className="h-10 w-10" />
        </Button>
      </footer>
    </div>
  );
}
