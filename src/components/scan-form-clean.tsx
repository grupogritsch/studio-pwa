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

export function ScanForm() {
  const [photoPreviews, setPhotoPreviews] = useState<Array<{path: string, preview: string}>>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isOffline, setIsOffline] = useState(false);
  const searchParams = useSearchParams();
  const isManualMode = searchParams.get('mode') === 'manual';
  const codeFromUrl = searchParams.get('code');
  const router = useRouter();
  const [scannedCode, setScannedCode] = useState<string | null>(codeFromUrl);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scannedCode: codeFromUrl || '',
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
  const isSendEnabled = requiresPhoto && hasPhotos && occurrenceValue;

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
        reject(new Error('Geolocalização não suportada'));
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
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  };

  const saveOccurrence = async (values: z.infer<typeof formSchema>) => {
    if (typeof window === 'undefined') return;

    const codeToUse = isManualMode ? values.scannedCode : scannedCode;
    if (!codeToUse) {
      toast({ variant: "destructive", title: "Erro", description: "Código é obrigatório." });
      return;
    }

    const timestamp = new Date().toISOString();

    // Obter dados do veículo do localStorage
    let vehiclePlate = '';
    let vehicleKm = 0;

    const currentRoteiroData = localStorage.getItem('currentRoteiroData');
    if (currentRoteiroData) {
      const data = JSON.parse(currentRoteiroData);
      vehiclePlate = data.vehiclePlate || '';
      vehicleKm = data.vehicleKm || 0;
    }

    // Obter coordenadas GPS
    const location = await getCurrentLocation();

    const occurrenceData = {
        scannedCode: codeToUse,
        occurrence: values.occurrence,
        receiverName: values.receiverName,
        receiverDocument: values.receiverDocument,
        photos: values.photos || [], // Array de paths das fotos
        timestamp,
        vehiclePlate,
        vehicleKm,
        latitude: location.latitude,
        longitude: location.longitude,
        synced: false,
        needsSync: true // Marcar para sincronização
    };

    try {
        console.log('Tentando salvar ocorrência:', occurrenceData);

        // Sempre salvar no IndexedDB primeiro
        const result = await db.addOccurrence(occurrenceData);
        console.log('Resultado do salvamento local:', result);

        // Se estiver online, tentar sincronizar imediatamente
        if (navigator.onLine && !isOffline) {
          console.log('Online - tentando sincronizar imediatamente...');

          try {
            const syncResult = await apiService.syncOccurrence(occurrenceData);

            if (syncResult.success) {
              // Marcar como sincronizado no IndexedDB
              await db.updateOccurrenceSync(result as number, true);
              console.log('Ocorrência sincronizada imediatamente com a API');

            } else {
              console.log('Falha na sincronização imediata:', syncResult.error);
            }
          } catch (syncError) {
            console.error('Erro na sincronização imediata:', syncError);
          }
        } else {
          console.log('Offline - salvando apenas localmente');
        }

        // Verificar se foi salvo realmente
        const savedOccurrences = await db.getActiveOccurrences();
        console.log('Ocorrências ativas após salvamento:', savedOccurrences);

        router.push('/roteiro');
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
      const codeToUse = isManualMode ? values.scannedCode : scannedCode;
      if (!codeToUse) {
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
        // Comprimir e salvar no IndexedDB
        const compressedBase64 = await savePhotoToIndexedDB(file, file.name);

        // Adicionar à lista de fotos
        const newPhoto = { path: file.name, preview: compressedBase64 };
        setPhotoPreviews(prev => [...prev, newPhoto]);

        // Atualizar formulário com array de base64 comprimidos
        const currentPhotos = form.getValues('photos') || [];
        const newPhotos = [...currentPhotos, compressedBase64];
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

        // Converter para blob para salvar como arquivo real
        canvas.toBlob(async (blob) => {
          if (blob) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `ocorrencia_${timestamp}.jpg`;

            try {
              // Comprimir e salvar no IndexedDB
              const compressedBase64 = await savePhotoToIndexedDB(blob, filename);

              // Adicionar à lista de fotos
              const newPhoto = { path: filename, preview: compressedBase64 };
              setPhotoPreviews(prev => [...prev, newPhoto]);

              // Atualizar formulário com array de base64 comprimidos
              const currentPhotos = form.getValues('photos') || [];
              const newPhotos = [...currentPhotos, compressedBase64];
              form.setValue('photos', newPhotos, { shouldValidate: true, shouldDirty: true });

              stopCamera();

            } catch (error) {
              console.error('Erro ao salvar foto:', error);
              toast({
                variant: "destructive",
                title: "Erro",
                description: "Erro ao salvar foto no dispositivo."
              });
            }
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const compressImage = async (blob: Blob, quality: number = 0.7, maxWidth: number = 1280, maxHeight: number = 720): Promise<string> => {
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

  const savePhotoToIndexedDB = async (blob: Blob, filename: string): Promise<string> => {
    try {
      // Comprimir imagem antes de armazenar
      const compressedBase64 = await compressImage(blob, 0.7, 1280, 720);

      console.log(`Foto comprimida: ${filename}`);
      console.log(`Tamanho original: ${(blob.size / 1024).toFixed(2)}KB`);
      console.log(`Tamanho comprimido: ${(compressedBase64.length * 0.75 / 1024).toFixed(2)}KB`);

      return compressedBase64; // Retorna o base64 comprimido
    } catch (error) {
      console.error('Erro ao comprimir/salvar foto:', error);
      throw error;
    }
  };

  const removePhoto = (index: number) => {
    const newPhotoPreviews = photoPreviews.filter((_, i) => i !== index);
    setPhotoPreviews(newPhotoPreviews);

    // Usar data URLs em vez de paths
    const newPhotoDataUrls = newPhotoPreviews.map(photo => photo.preview);
    form.setValue('photos', newPhotoDataUrls, { shouldValidate: true, shouldDirty: true });

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
    <div className="flex min-h-screen w-full flex-col">
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex justify-between items-center p-4 bg-black/50">
            <h3 className="text-white text-lg font-semibold">Tirar Foto</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={stopCamera}
              className="text-white hover:bg-white/10"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="flex justify-center p-6 bg-black/50">
            <Button
              onClick={capturePhoto}
              className="h-16 w-16 rounded-full bg-white hover:bg-gray-200 text-black shadow-lg"
            >
              <Camera className="h-8 w-8" />
            </Button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-10 flex h-20 items-center justify-between gap-4 border-b px-4 shadow-sm md:px-6 w-full" style={{backgroundColor: '#222E3C'}}>
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          fontFamily: 'Roboto Bold',
          letterSpacing: '1px',
        }}>
          <span style={{color:'#ffffff'}}>LOGISTI</span><span style={{ color: '#FFA500' }}>K</span>
        </div>
        <div className="flex items-center gap-2">
          {isOffline ? (
            <WifiOff className="h-5 w-5 text-white" />
          ) : (
            <Wifi className="h-5 w-5 text-white" />
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-start gap-4 p-4 md:gap-8 md:p-10 w-full pb-24 min-h-0">
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
                              placeholder="Digite o código manualmente"
                              className="input-custom"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                setScannedCode(e.target.value);
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

      <footer className="sticky bottom-0 left-0 right-0 z-10 flex justify-center items-center gap-4 border-t p-4 w-full" style={{backgroundColor: '#222E3C'}}>
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

        <Button
            variant="outline"
            className="h-16 w-16 rounded-full shadow-lg text-black border-white/20 hover:bg-white/10"
            onClick={() => router.push('/roteiro')}
            aria-label="Fechar"
        >
            <X className="h-10 w-10 text-black" />
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