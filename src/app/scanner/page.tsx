import { ScannerCamera } from '@/components/scanner-camera';

export default function ScannerPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-secondary">
      <main className="flex flex-1 flex-col items-center justify-center">
        <ScannerCamera />
      </main>
    </div>
  );
}