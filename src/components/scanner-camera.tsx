"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';

interface ScannerCameraProps {
  onBackToList?: () => void;
}

export function ScannerCamera({ onBackToList }: ScannerCameraProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const extractCTeCode = (scannedText: string): { fullCode: string; displayCode: string } => {
    try {
      if (scannedText.startsWith('http') && scannedText.includes('chCTe=')) {
        const match = scannedText.match(/chCTe=([^&]+)/);
        if (match && match[1]) {
          const fullCode = match[1];
          // Pegar caracteres 25-34 (índice 24-33 em zero-based)
          const displayCode = fullCode.length >= 34 ? fullCode.substring(24, 34) : fullCode;
          return { fullCode, displayCode };
        }
      }
      // Se não for URL, retornar o código como está
      return { fullCode: scannedText, displayCode: scannedText };
    } catch (error) {
      return { fullCode: scannedText, displayCode: scannedText };
    }
  };

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });

        setHasCameraPermission(true);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          const codeReader = new BrowserQRCodeReader();

          setTimeout(async () => {
            if (videoRef.current) {
              const controls = await codeReader.decodeFromVideoElement(videoRef.current, (result, error) => {
                if (result) {
                  scannerControlsRef.current?.stop();
                  scannerControlsRef.current = null;

                  const rawCode = result.getText();
                  const { fullCode, displayCode } = extractCTeCode(rawCode);

                  // Salvar ambos os códigos no localStorage
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('scannedCodeFull', fullCode);
                    localStorage.setItem('scannedCodeDisplay', displayCode);
                  }

                  // Redirecionar para a página de scan
                  router.push('/scan');
                }
              });
              scannerControlsRef.current = controls;
            }
          }, 1000);
        }
      } catch (error: any) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setHasCameraPermission(false);
        } else {
          setTimeout(() => getCameraPermission(), 2000);
        }
      }
    };

    getCameraPermission();

    return () => {
      if (scannerControlsRef.current) {
        try {
          scannerControlsRef.current.stop();
        } catch (e) {
          // Ignore errors on cleanup
        }
        scannerControlsRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [router]);

  const handleGoBack = () => {
    router.push('/');
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (onBackToList) {
        onBackToList();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onBackToList]);

  return (
    <div className="fixed inset-0 bg-black z-50">
      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-3/4 h-1/3 border-4 border-dashed border-white/50 rounded-lg" />
      </div>

      {hasCameraPermission === null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
              <Loader2 className="h-10 w-10 animate-spin text-black mb-4" />
              <p className="text-white">Solicitando permissão da câmera...</p>
          </div>
      )}

      {hasCameraPermission === false && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4">
           <Alert variant="destructive" className="max-w-sm">
              <AlertTitle>Acesso à Câmera Necessário</AlertTitle>
              <AlertDescription>
                Você precisa permitir o acesso à câmera para escanear o código.
                Por favor, habilite a permissão nas configurações do seu navegador e atualize a página.
              </AlertDescription>
            </Alert>
        </div>
      )}
    </div>
  );
}