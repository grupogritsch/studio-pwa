
import { Suspense } from 'react';
import { ScanForm } from '@/components/scan-form-clean';

function ScanFormWithSuspense() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96">Carregando...</div>}>
      <ScanForm />
    </Suspense>
  );
}

export default function OcorrenciaPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-secondary">
      <main className="flex flex-1 flex-col items-center justify-center">
        <ScanFormWithSuspense />
      </main>
    </div>
  );
}
