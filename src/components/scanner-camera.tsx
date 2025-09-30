"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';

export function ScannerCamera() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);

  // Função para extrair código CTe da URL
  const extractCTeCode = (scannedText: string): string => {
    try {
      // Verificar se é uma URL CTe que sempre inicia com http
      if (scannedText.startsWith('http') && scannedText.includes('chCTe=')) {
        // Extrair usando regex para pegar o valor do parâmetro chCTe
        const match = scannedText.match(/chCTe=([^&]+)/);
        if (match && match[1]) {
          console.log('CTe code extracted from URL:', match[1]);
          return match[1];
        }
      }

      // Se não for URL CTe, retorna o código original
      console.log('Using original scanned code:', scannedText);
      return scannedText;
    } catch (error) {
      console.error('Error extracting CTe code:', error);
      return scannedText;
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

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          const codeReader = new BrowserQRCodeReader();

          setTimeout(async () => {
            if (videoRef.current) {
              const controls = await codeReader.decodeFromVideoElement(videoRef.current, (result, error) => {
                if (result) {
                  scannerControlsRef.current?.stop();
                  scannerControlsRef.current = null;

                  // Extrair código CTe se for uma URL de CTe
                  const rawCode = result.getText();
                  const extractedCode = extractCTeCode(rawCode);

                  // Redireciona para o formulário com o código extraído
                  router.push(`/ocorrencia?code=${encodeURIComponent(extractedCode)}`);
                }
                // Silently ignore reading errors - just keep trying
              });
              scannerControlsRef.current = controls;
            }
          }, 1000);
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
      }
    };

    getCameraPermission();

    return () => {
      if (scannerControlsRef.current) {
        scannerControlsRef.current.stop();
        scannerControlsRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [router]);

  const handleGoBack = () => {
    router.push('/');
  };

  return (
    <div className="fixed inset-0 bg-black">
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

      <Button
          variant="secondary"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          onClick={handleGoBack}
      >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
      </Button>
    </div>
  );
}