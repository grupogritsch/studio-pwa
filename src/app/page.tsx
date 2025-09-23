
"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScanLine, PlusCircle } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  const handleNewOccurrence = () => {
    router.push('/ocorrencia');
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-secondary">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-center gap-4 border-b bg-background px-4 shadow-sm md:px-6">
        <div className="flex items-center gap-3">
          <ScanLine className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
            ScanTracker
          </h1>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-8 p-4 md:gap-8 md:p-10">
        <div className="text-center">
          <h2 className="text-xl text-muted-foreground mb-8">
            Nenhuma ocorrência registrada ainda.
          </h2>
          <Button
            size="lg"
            className="h-16 text-lg"
            onClick={handleNewOccurrence}
          >
            <PlusCircle className="mr-3 h-6 w-6" />
            Nova Ocorrência
          </Button>
        </div>
      </main>
    </div>
  );
}
