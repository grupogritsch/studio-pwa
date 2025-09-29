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
import { Camera, Loader2, Package, Send, WifiOff, ArrowLeft, X } from 'lucide-react';
import { db } from '@/lib/db';

const formSchema = z.object({
  scannedCode: z.string().optional(),
  occurrence: z.string({ required_error: "Selecione uma ocorrência." }).min(1, "Selecione uma ocorrência."),
  photo: z.union([
    z.string().min(1, "Foto é obrigatória.").optional(),
    z.instanceof(Blob).optional(),
  ]),
  receiverName: z.string().optional(),
  receiverDocument: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.occurrence === 'troca_gelo') {
      if (!data.photo) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Foto é obrigatória para troca de gelo.",
            path: ["photo"],
        });
      }
    }
  });

export function ScanForm() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
      receiverName: '',
      receiverDocument: '',
    },
    mode: "onChange",
  });

  const occurrenceValue = form.watch('occurrence');
  const photoValue = form.watch('photo');
  const isValid = form.formState.isValid;
  const requiresPhoto = occurrenceValue === 'troca_gelo';
  const isCameraEnabled = typeof navigator !== 'undefined' && 'mediaDevices' in navigator;
  const isSendEnabled = requiresPhoto && photoValue && isValid;

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

  const saveOccurrence = async (values: z.infer<typeof formSchema>) => {
    if (typeof window === 'undefined') return;

    const codeToUse = isManualMode ? values.scannedCode : scannedCode;
    if (!codeToUse) {
      toast({ variant: "destructive", title: "Erro", description: "Código é obrigatório." });
      return;
    }

    const timestamp = new Date().toISOString();

    const occurrenceData = {
        scannedCode: codeToUse,
        occurrence: values.occurrence,
        receiverName: values.receiverName,
        receiverDocument: values.receiverDocument,
        timestamp,
        synced: false
    };

    try {
        await db.addOccurrence(occurrenceData);

        toast({
            title: "Registrado com sucesso",
            variant: "default",
            className: "bg-green-500 text-white border-green-600",
        });

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
        // Salvar o arquivo no dispositivo
        const photoPath = await savePhotoToDevice(file, file.name);

        // Converter para base64 para preview
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setImagePreview(result);

          // Salvar apenas o path da foto no formulário para o IndexDB
          form.setValue('photo', photoPath);
        };
        reader.readAsDataURL(file);

        toast({
          title: "Foto selecionada",
          description: "Foto salva no dispositivo com sucesso!",
          variant: "default",
          className: "bg-green-500 text-white border-green-600",
        });
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
              // Salvar foto usando File System Access API (se disponível) ou fallback
              const photoPath = await savePhotoToDevice(blob, filename);

              // Converter para base64 para preview
              const reader = new FileReader();
              reader.onload = (e) => {
                const result = e.target?.result as string;
                setImagePreview(result);

                // Salvar apenas o path da foto no formulário para o IndexDB
                form.setValue('photo', photoPath);
              };
              reader.readAsDataURL(blob);

              stopCamera();

              toast({
                title: "Foto capturada",
                description: "Foto salva no dispositivo com sucesso!",
                variant: "default",
                className: "bg-green-500 text-white border-green-600",
              });
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

  const savePhotoToDevice = async (blob: Blob, filename: string): Promise<string> => {
    try {
      // Verificar se File System Access API está disponível
      if ('showSaveFilePicker' in window) {
        try {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'Imagens JPEG',
              accept: { 'image/jpeg': ['.jpg', '.jpeg'] }
            }]
          });

          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          return fileHandle.name; // Retorna o nome do arquivo salvo
        } catch (err) {
          if (err.name === 'AbortError') {
            throw new Error('Usuário cancelou o salvamento');
          }
          throw err;
        }
      } else {
        // Fallback: usar download automático
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;

        // Adicionar ao DOM temporariamente
        document.body.appendChild(link);
        link.click();

        // Limpar
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return filename; // Retorna o nome do arquivo
      }
    } catch (error) {
      console.error('Erro ao salvar foto:', error);
      throw error;
    }
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/roteiro')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
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
                    {isOffline && <WifiOff className="h-5 w-5 text-destructive" />}
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
                            <SelectTrigger>
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
                      <FormLabel>Foto Comprobatória</FormLabel>
                      {imagePreview && (
                        <div className="mt-4">
                          <img src={imagePreview} alt="Preview" className="max-w-full h-auto rounded-lg shadow-sm" />
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
            variant="outline"
            className="h-16 w-16 rounded-full shadow-lg"
            disabled={!isCameraEnabled}
            onClick={startCamera}
            aria-label="Tirar Foto"
        >
            <Camera className="h-10 w-10" />
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
                <Loader2 className="h-10 w-10 animate-spin" />
            ) : (
                <Send className="h-10 w-10" />
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