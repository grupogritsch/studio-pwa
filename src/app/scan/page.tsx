"use client";

import { ScanForm } from '@/components/scan-form-clean';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AuthGuard from '@/components/auth-guard';
import { Suspense } from 'react';

export default function ScanPage() {
  const router = useRouter();

  const handleBackToList = () => {
    router.push('/');
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen w-full flex-col bg-secondary">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between gap-4 px-4 shadow-sm md:px-6" style={{backgroundColor: '#222E3C'}}>
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Image
              src="/logistik-dark.png"
              alt="Logistik"
              width={140}
              height={32}
              priority
            />
          </div>
        </header>
        <main className="flex flex-1 flex-col overflow-y-auto">
          <Suspense fallback={<div className="flex items-center justify-center h-96">Carregando...</div>}>
            <ScanForm onBackToList={handleBackToList} mode="scan" />
          </Suspense>
        </main>
      </div>
    </AuthGuard>
  );
}
