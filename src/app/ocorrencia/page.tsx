
import { ScanForm } from '@/components/scan-form';

export default function OcorrenciaPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-secondary">
       <main className="flex flex-1 flex-col items-center justify-start gap-4 p-4 md:gap-8 md:p-10">
        <div className="w-full max-w-2xl">
          <ScanForm />
        </div>
      </main>
    </div>
  );
}
