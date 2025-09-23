import { ScanForm } from '@/components/scan-form';
import { ScanLine } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-secondary">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 shadow-sm md:px-6">
        <div className="flex items-center gap-3">
          <ScanLine className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">
            ScanTracker
          </h1>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-start gap-4 p-4 md:gap-8 md:p-10">
        <div className="w-full max-w-2xl">
          <ScanForm />
        </div>
      </main>
    </div>
  );
}
