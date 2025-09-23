
import { ScanForm } from '@/components/scan-form';

export default function OcorrenciaPage() {
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
       <main className="flex flex-1 flex-col items-center justify-start gap-4 p-4 md:gap-8 md:p-10">
        <div className="w-full max-w-2xl">
          <ScanForm />
        </div>
      </main>
    </div>
  );
}
