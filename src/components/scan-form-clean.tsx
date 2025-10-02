"use client";

import { useState, useEffect, useTransition, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Camera, Loader2, Package, Send, WifiOff, Wifi, X, Trash2 } from 'lucide-react';
import { db, syncService } from '@/lib/db';
import { apiService } from '@/lib/api';
import { photoUploadService } from '@/lib/photo-upload-service';

const formSchema = z.object({
  scannedCode: z.string().optional(),
  occurrence: z.string({ required_error: "Selecione uma ocorrência." }).min(1, "Selecione uma ocorrência."),
  photos: z.array(z.string()).default([]),
  receiverName: z.string().optional(),
  receiverDocument: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.occurrence === 'troca_gelo') {
      if (!data.photos || data.photos.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Pelo menos uma foto é obrigatória para troca de gelo.",
            path: ["photos"],
        });
      }
    }
  });

interface ScanFormProps {
  onBackToList?: () => void;
  mode?: 'scan' | 'manual';
}

export function ScanForm({ onBackToList, mode = 'manual' }: ScanFormProps) {
  const [photoPreviews, setPhotoPreviews] = useState<Array<{path: string, preview: string, base64?: string}>>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isOffline, setIsOffline] = useState(false);
  const searchParams = useSearchParams();
  const isManualMode = true; // Sempre manual agora
  const codeFromUrl = searchParams.get('code');
  const router = useRouter();

  // Pegar código do localStorage ou URL
  const getInitialCodes = () => {
    if (typeof window !== 'undefined') {
      const storedCodeFull = localStorage.getItem('scannedCodeFull');
      const storedCodeDisplay = localStorage.getItem('scannedCodeDisplay');
      if (storedCodeFull && storedCodeDisplay) {
        localStorage.removeItem('scannedCodeFull');
        localStorage.removeItem('scannedCodeDisplay');
        return { fullCode: storedCodeFull, displayCode: storedCodeDisplay };
      }
    }
    const urlCode = codeFromUrl || '';
    return { fullCode: urlCode, displayCode: urlCode };
  };

  const [scannedCodeFull, setScannedCodeFull] = useState<string>('');
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [displayCode, setDisplayCode] = useState<string>('');
  const isFromScan = mode === 'scan';
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Carregar códigos do localStorage quando componente montar
  useEffect(() => {
    if (mode === 'scan') {
      const codes = getInitialCodes();
      setScannedCodeFull(codes.fullCode);
      setDisplayCode(codes.displayCode);
    }
  }, [mode]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scannedCode: '',
      occurrence: '',
      photos: [],
      receiverName: '',
      receiverDocument: '',
    },
    mode: "onChange",
  });

  const occurrenceValue = form.watch('occurrence');
  const photosValue = form.watch('photos');
  const isValid = form.formState.isValid;
  const requiresPhoto = occurrenceValue === 'troca_gelo';
  const isCameraEnabled = typeof navigator !== 'undefined' && 'mediaDevices' in navigator;

  // Lógica simplificada - usar tanto photosValue quanto photoPreviews para garantir
  const hasPhotos = (photosValue && photosValue.length > 0) || photoPreviews.length > 0;
  // Botão habilitado se tiver ocorrência selecionada E (não requer foto OU tem fotos)
  const isSendEnabled = occurrenceValue && (!requiresPhoto || hasPhotos);

  // Debug logs
  console.log('Debug - Send button state:', {
    requiresPhoto,
    hasPhotos,
    photosValue,
    photosValueLength: photosValue?.length,
    photoPreviewsLength: photoPreviews.length,
    occurrenceValue,
    isValid,
    isSendEnabled
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (typeof navigator.onLine !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getCurrentLocation = (): Promise<{latitude: number, longitude: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        resolve({ latitude: 0, longitude: 0 });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Erro ao obter localização:', error);
          // Não falhar a operação se GPS não estiver disponível
          resolve({ latitude: 0, longitude: 0 });
        },
        {
          enableHighAccuracy: false, // Mais rápido, menos preciso
          timeout: 3000, // 3 segundos no máximo
          maximumAge: 300000 // Aceita cache de até 5 minutos
        }
      );
    });
  };

  const saveOccurrence = async (values: z.infer<typeof formSchema>) => {
    if (typeof window === 'undefined') return;

    // Usar código completo para API, se disponível
    const fullCodeToUse = scannedCodeFull || values.scannedCode;
    if (!fullCodeToUse) {
      toast({ variant: "destructive", title: "Erro", description: "Código é obrigatório." });
      return;
    }

    const timestamp = new Date().toISOString();

    // Obter coordenadas GPS
    const location = await getCurrentLocation();

    // Pegar todas as fotos em base64 (SEMPRE salvar localmente)
    const photosBase64 = photoPreviews
      .filter(p => p.base64)
      .map(p => p.base64!);

    const occurrenceData = {
        scannedCode: fullCodeToUse, // Enviar código completo para API
        occurrence: values.occurrence,
        receiverName: values.receiverName,
        receiverDocument: values.receiverDocument,
        photos: photosBase64.length > 0 ? photosBase64.map((_, i) => `pending_${i}`) : [],
        photosBase64: photosBase64, // Array de todas as fotos em base64
        timestamp,
        latitude: location.latitude,
        longitude: location.longitude,
        synced: false,
        needsSync: true
    };

    try {
        // SEMPRE salvar no IndexedDB com base64 (offline-first)
        await db.addOccurrence(occurrenceData, null);

        // Salvar flag de sucesso no localStorage para mostrar mensagem na próxima tela
        if (typeof window !== 'undefined') {
          localStorage.setItem('showSuccessMessage', 'true');
        }

        // Voltar imediatamente para lista
        if (onBackToList) {
          onBackToList();
        } else {
          router.push('/');
        }
    } catch(error) {
        console.error("Failed to save occurrence to DB:", error);
        toast({
            variant: "destructive",
            title: "Erro ao salvar",
            description: "Não foi possível salvar os dados. Tente novamente.",
        });
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    startTransition(async () => {
      const fullCodeToUse = scannedCodeFull || values.scannedCode;
      if (!fullCodeToUse) {
         toast({ variant: "destructive", title: "Erro", description: "Código é obrigatório." });
         return;
      }

      await saveOccurrence(values);
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        // Upload para R2 e obter URL
        const r2Url = await uploadPhotoToR2(file, file.name);

        // Comprimir para preview local (não armazenar no IndexedDB)
        const compressedBase64 = await compressImage(file, 0.7, 1280, 720); // Preview melhor qualidade

        // Adicionar à lista de fotos
        const newPhoto = { path: r2Url, preview: compressedBase64 };
        setPhotoPreviews(prev => [...prev, newPhoto]);

        // Atualizar formulário com array de URLs do R2
        const currentPhotos = form.getValues('photos') || [];
        const newPhotos = [...currentPhotos, r2Url];
        form.setValue('photos', newPhotos, { shouldValidate: true, shouldDirty: true });

      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Erro ao processar a foto selecionada."
        });
      }
    }
  };

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      // Verificar se getUserMedia está disponível
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia não suportado neste navegador');
      }

      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false
      };

      console.log('Solicitando acesso à câmera...');
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Câmera acessada com sucesso');

      setStream(mediaStream);
      setShowCamera(true);

      // Aguardar um pouco antes de definir o stream no vídeo
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(err => {
            console.error('Erro ao reproduzir vídeo:', err);
          });
        }
      }, 100);

    } catch (error) {
      console.error('Erro ao acessar câmera:', error);

      let errorMessage = "Não foi possível acessar a câmera.";

      if (error.name === 'NotAllowedError') {
        errorMessage = "Permissão negada. Permita o acesso à câmera nas configurações do navegador.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "Nenhuma câmera encontrada no dispositivo.";
      } else if (error.name === 'NotSupportedError') {
        errorMessage = "Câmera não suportada neste navegador.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Câmera está sendo usada por outro aplicativo.";
      }

      toast({
        variant: "destructive",
        title: "Erro na Câmera",
        description: errorMessage
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        // Parar a câmera IMEDIATAMENTE após capturar a imagem
        stopCamera();

        // Converter para blob
        canvas.toBlob(async (blob) => {
          if (blob) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `ocorrencia_${timestamp}.jpg`;

            try {
              // Comprimir rapidamente para uma resolução menor (mais rápido)
              // Qualidade: 0.7 = boa qualidade mas arquivo menor
              // Tamanho: 1280x720 = HD, suficiente para documentação
              const compressedBase64 = await compressImage(blob, 0.7, 1280, 720);

              const newPhoto = {
                path: 'pending',
                preview: compressedBase64,
                base64: compressedBase64
              };
              setPhotoPreviews(prev => [...prev, newPhoto]);

              const currentPhotos = form.getValues('photos') || [];
              form.setValue('photos', [...currentPhotos, 'pending'], { shouldValidate: true, shouldDirty: true });

            } catch (error) {
              console.error('Erro ao processar foto:', error);
              toast({
                variant: "destructive",
                title: "Erro",
                description: "Erro ao processar foto."
              });
            }
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const compressImage = async (blob: Blob, quality: number = 0.85, maxWidth: number = 1920, maxHeight: number = 1080): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calcular novas dimensões mantendo proporção
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Desenhar imagem redimensionada
        ctx?.drawImage(img, 0, 0, width, height);

        // Converter para base64 comprimido
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => reject(new Error('Erro ao carregar imagem para compressão'));
      img.src = URL.createObjectURL(blob);
    });
  };

  const uploadPhotoToR2 = async (blob: Blob, filename: string): Promise<string> => {
    try {
      // Comprimir imagem antes do upload
      const compressedBase64 = await compressImage(blob, 0.85, 1920, 1080);

      console.log(`Uploading photo: ${filename}`);
      console.log(`Original size: ${(blob.size / 1024).toFixed(2)}KB`);
      console.log(`Compressed size: ${(compressedBase64.length * 0.75 / 1024).toFixed(2)}KB`);

      // Upload via Django API que fará upload para R2
      const r2Url = await photoUploadService.uploadBase64ToR2(compressedBase64, filename);

      console.log(`Photo uploaded to R2 via Django: ${r2Url}`);
      return r2Url; // Retorna a URL do R2

    } catch (error) {
      console.error('Erro ao fazer upload para R2:', error);
      throw error;
    }
  };

  const removePhoto = (index: number) => {
    const newPhotoPreviews = photoPreviews.filter((_, i) => i !== index);
    setPhotoPreviews(newPhotoPreviews);

    // Usar URLs do R2 em vez de base64
    const newPhotoUrls = newPhotoPreviews.map(photo => photo.path);
    form.setValue('photos', newPhotoUrls, { shouldValidate: true, shouldDirty: true });

    toast({
      title: "Foto removida",
      description: "Foto removida da lista.",
      variant: "default",
    });
  };

  // Limpar stream quando componente for desmontado
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="flex w-full flex-col h-full">
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Vídeo fullscreen */}
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Footer com botão centralizado */}
          <div className="fixed bottom-0 left-0 right-0 flex justify-center p-6 z-50">
            <Button
              onClick={capturePhoto}
              className="h-16 w-16 rounded-full bg-white hover:bg-gray-200 shadow-lg"
            >
              <Camera className="h-8 w-8 text-black" />
            </Button>
          </div>
        </div>
      )}

      <main className="flex flex-col items-center justify-start gap-4 p-4 md:gap-8 md:p-10 w-full pb-24">
        <div className="w-full max-w-2xl">
        <Form {...form}>
            <form id="occurrence-form" onSubmit={form.handleSubmit(onSubmit)}>
              <Card className="w-full shadow-lg">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Registrar Ocorrência</CardTitle>
                    {isOffline && <WifiOff className="h-5 w-5 text-white" />}
                  </div>
                  {!isManualMode && codeFromUrl && (
                    <p className="text-sm text-muted-foreground">
                      Código: <span className="font-bold text-foreground">{codeFromUrl}</span>
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  {isManualMode && (
                    <FormField
                      control={form.control}
                      name="scannedCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={isFromScan ? displayCode : "Digite o código manualmente"}
                              className="input-custom"
                              {...field}
                              disabled={isFromScan}
                              onChange={(e) => {
                                field.onChange(e);
                                setScannedCode(e.target.value);
                                // Quando digitar manualmente, atualizar também o código completo
                                setScannedCodeFull(e.target.value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="occurrence"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ocorrência</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="select-custom">
                              <Package className="mr-2 h-5 w-5 text-muted-foreground" />
                              <SelectValue placeholder="Selecione o tipo de ocorrência" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="troca_gelo">Troca de gelo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />


                  {requiresPhoto && (
                    <div className="space-y-4">
                      <FormLabel>Fotos Comprobatórias ({photoPreviews.length})</FormLabel>
                      {photoPreviews.length > 0 && (
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          {photoPreviews.map((photo, index) => (
                            <div key={index} className="relative">
                              <img
                                src={photo.preview}
                                alt={`Foto ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg shadow-sm border"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6 rounded-full"
                                onClick={() => removePhoto(index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                                {index + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {photoPreviews.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                          <Camera className="mx-auto h-12 w-12 mb-2" />
                          <p>Nenhuma foto anexada</p>
                          <p className="text-sm">Clique no botão da câmera para tirar fotos</p>
                        </div>
                      )}
                    </div>
                  )}

                </CardContent>
              </Card>
            </form>
          </Form>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-10 flex justify-center items-center gap-4 border-t p-4 w-full" style={{backgroundColor: '#222E3C'}}>
        <Button
            variant="default"
            className="h-16 w-16 rounded-full shadow-lg"
            style={{ backgroundColor: '#FFA500' }}
            disabled={!isCameraEnabled}
            onClick={startCamera}
            aria-label="Tirar Foto"
        >
            <Camera className="h-10 w-10 text-black" />
        </Button>

        <Button
            type="submit"
            form="occurrence-form"
            variant="default"
            className="h-16 w-16 rounded-full shadow-lg bg-accent hover:bg-accent/90 text-accent-foreground"
            disabled={!isSendEnabled || isPending}
            aria-label="Enviar Ocorrência"
        >
            {isPending ? (
                <Loader2 className="h-10 w-10 animate-spin text-black" />
            ) : (
                <Send className="h-10 w-10 text-black" />
            )}
        </Button>

        {/* Input file oculto como fallback */}
        <input
          id="photo-upload"
          type="file"
          accept="image/*"
          className="hidden"
          capture="environment"
          onChange={handleFileChange}
        />
      </footer>
    </div>
    );
}