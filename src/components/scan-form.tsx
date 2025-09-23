
"use client";

import { useState, useEffect, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { submitOccurrence } from '@/lib/actions';
import { Camera, FileText, Loader2, Package, ScanLine, Send, User, WifiOff, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { IScannerControls } from '@zxing/browser';


const formSchema = z.object({
  scannedCode: z.string({ required_error: "Código é obrigatório." }).min(1, "Código é obrigatório."),
  occurrence: z.string({ required_error: "Selecione uma ocorrência." }).min(1, "Selecione uma ocorrência."),
  photo: z.union([
    z.instanceof(File, { message: "Foto é obrigatória." }).refine(file => file.size > 0, "Foto é obrigatória."),
    z.string().min(1, "Foto é obrigatória.") // for data URI
  ]),
  receiverName: z.string().optional(),
  receiverDocument: z.string().optional(),
}).refine(
  (data) => {
    if (data.occurrence === 'entregue') {
      return data.receiverName && data.receiverName.length > 0;
    }
    return true;
  },
  {
    message: "Nome do recebedor é obrigatório para entrega.",
    path: ["receiverName"],
  }
).refine(
  (data) => {
    if (data.occurrence === 'entregue') {
      return data.receiverDocument && data.receiverDocument.length > 0;
    }
    return true;
  },
  {
    message: "Documento do recebedor é obrigatório para entrega.",
    path: ["receiverDocument"],
  }
);

export function ScanForm() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [isOffline, setIsOffline] = useState(false);
  const [step, setStep] = useState<'scan' | 'form'>('scan');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const router = useRouter();
  const scannerControlsRef = useRef<IScannerControls | null>(null);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scannedCode: '',
      occurrence: '',
      receiverName: '',
      receiverDocument: '',
    },
  });

  const dataURItoFile = async (dataURI: string, fileName: string): Promise<File> => {
    const res = await fetch(dataURI);
    const blob = await res.blob();
    return new File([blob], fileName, { type: blob.type });
  };
  
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
  
    const handleOnline = () => {
      setIsOffline(false);
      toast({
        title: "Conexão reestabelecida!",
        description: "Sincronizando dados pendentes...",
      });
      syncOfflineData();
    };
  
    const handleOffline = () => {
      setIsOffline(true);
      toast({
        variant: "destructive",
        title: "Você está offline",
        description: "Os dados serão salvos localmente e enviados quando a conexão voltar.",
      });
    };
  
    const syncOfflineData = async () => {
      if (typeof window.localStorage === 'undefined') return;
      const offlineData = JSON.parse(localStorage.getItem('offlineOccurrences') || '[]');
      if (offlineData.length > 0 && navigator.onLine) {
        startTransition(async () => {
          let allSucceeded = true;
          const remainingData = [];
          for (const data of offlineData) {
            try {
              const photoFile = await dataURItoFile(data.photo, 'offline_photo.jpeg');
              const result = await submitOccurrence({ ...data, photo: photoFile });
              if (!result.success) {
                allSucceeded = false;
                remainingData.push(data);
              }
            } catch (error) {
              allSucceeded = false;
              remainingData.push(data);
              console.error("Erro ao sincronizar:", error);
            }
          }
  
          if (allSucceeded) {
            localStorage.removeItem('offlineOccurrences');
            toast({
              title: "Sincronização Completa!",
              description: `${offlineData.length} ocorrência(s) pendente(s) foi/foram enviada(s).`,
            });
          } else {
            localStorage.setItem('offlineOccurrences', JSON.stringify(remainingData));
            toast({
              variant: "destructive",
              title: "Falha na Sincronização",
              description: "Alguns dados não puderam ser enviados. Tente novamente mais tarde.",
            });
          }
        });
      }
    };
  
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  
    // Initial state
    if (typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);
      if (navigator.onLine) {
        syncOfflineData();
      }
    }
  
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);
  
  useEffect(() => {
    if (step === 'scan') {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setHasCameraPermission(true);

          const startScanner = async () => {
            if (videoRef.current) {
              try {
                const zxing = await import('@zxing/browser');
                const { BrowserQRCodeReader } = zxing;
                const codeReader = new BrowserQRCodeReader();
                
                scannerControlsRef.current = await codeReader.decodeFromVideoElement(videoRef.current, (result, error, ctrls) => {
                  if (result) {
                    ctrls.stop();
                    scannerControlsRef.current = null;
                    form.setValue('scannedCode', result.getText());
                    setStep('form');
                  }
                  if (error && error.name !== 'NotFoundException') {
                     toast({
                        variant: "destructive",
                        title: "Erro de Scanner",
                        description: `Ocorreu um erro: ${error.message}`,
                    });
                  }
                });
              } catch (err) {
                 toast({
                    variant: "destructive",
                    title: "Erro de Scanner",
                    description: `Não foi possível iniciar o leitor.`,
                });
              }
            }
          }
          startScanner();
        })
        .catch(err => {
          console.error("Failed to get camera permission:", err);
          setHasCameraPermission(false);
          toast({
            variant: "destructive",
            title: "Câmera não autorizada",
            description: "Você precisa permitir o acesso à câmera para continuar.",
          });
        });
    }
    return () => {
      scannerControlsRef.current?.stop();
    };
  }, [step, toast, form]);

  const occurrenceValue = form.watch('occurrence');
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        form.setValue('photo', result, { shouldValidate: true });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveForOffline = async (values: z.infer<typeof formSchema>) => {
    if (typeof window.localStorage === 'undefined') return;
    const offlineData = JSON.parse(localStorage.getItem('offlineOccurrences') || '[]');
    
    let photoDataUrl = values.photo;
    if (values.photo instanceof File) {
      photoDataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(values.photo as File);
      });
    }

    offlineData.push({ ...values, photo: photoDataUrl });
    localStorage.setItem('offlineOccurrences', JSON.stringify(offlineData));

    toast({
      title: "Salvo para envio posterior",
      description: "A ocorrência foi salva e será enviada quando houver conexão.",
    });
    form.reset();
    setImagePreview(null);
    router.push('/');
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    startTransition(async () => {
      if (isOffline) {
        await saveForOffline(values);
        return;
      }
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error("Geolocalização não é suportada por este navegador."));
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        
        const { latitude, longitude } = position.coords;
        let photoFile: File;
        if(typeof values.photo === 'string') {
            photoFile = await dataURItoFile(values.photo, "photo.jpg");
        } else {
            photoFile = values.photo;
        }

        const result = await submitOccurrence({ ...values, photo: photoFile, latitude, longitude });

        if (result.success) {
          toast({
            title: "Sucesso!",
            description: result.message,
          });
          form.reset();
          setImagePreview(null);
          router.push('/');
        } else {
          throw new Error(result.message || "Ocorreu um erro desconhecido.");
        }
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Erro ao registrar ocorrência",
          description: error.message || "Não foi possível obter a localização ou enviar os dados.",
        });
      }
    });
  };

  const handleGoBack = () => {
    if (scannerControlsRef.current) {
        scannerControlsRef.current.stop();
        scannerControlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    router.push('/');
  };

  if (step === 'scan') {
    return (
      <div className="fixed inset-0 bg-black">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-3/4 h-1/3 border-4 border-dashed border-white/50 rounded-lg" />
        </div>
        
        {hasCameraPermission === null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                <Loader2 className="h-10 w-10 animate-spin text-white mb-4" />
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

  return (
    <>
      <header className="sticky top-0 z-10 flex h-20 items-center justify-center gap-4 border-b bg-primary px-4 shadow-sm md:px-6 w-full">
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
      <div className="flex-1 flex flex-col items-center justify-start gap-4 p-4 md:gap-8 md:p-10 w-full">
        <div className="w-full max-w-2xl">
          <Card className="w-full shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Registrar Ocorrência</CardTitle>
                {isOffline && <WifiOff className="h-5 w-5 text-destructive" />}
              </div>
              <CardDescription>Preencha os dados da ocorrência e anexe uma foto.</CardDescription>
            </CardHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="scannedCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código de Barras / CTE</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input placeholder="Leia ou digite o código" {...field} className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                            <SelectItem value="entregue">Entregue</SelectItem>
                            <SelectItem value="avaria">Avaria</SelectItem>
                            <SelectItem value="extravio">Extravio</SelectItem>
                            <SelectItem value="devolucao">Devolução</SelectItem>
                            <SelectItem value="recusado">Recusado pelo destinatário</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {occurrenceValue === 'entregue' && (
                    <div className="space-y-6 rounded-md border bg-secondary/30 p-4 animate-in fade-in-50">
                      <p className="text-sm font-medium text-foreground">Dados do Recebedor</p>
                      <FormField
                        control={form.control}
                        name="receiverName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome do Recebedor</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input placeholder="Nome de quem recebeu" {...field} className="pl-10" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="receiverDocument"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Documento do Recebedor (RG/CPF)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input placeholder="Documento de quem recebeu" {...field} className="pl-10"/>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                  
                  <FormField
                    control={form.control}
                    name="photo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Foto da Ocorrência</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Button asChild variant="outline" className="w-full">
                              <label htmlFor="photo-upload" className="cursor-pointer">
                                <Camera className="mr-2 h-5 w-5" />
                                Tirar Foto
                              </label>
                            </Button>
                            <Input 
                              id="photo-upload"
                              type="file" 
                              className="sr-only" 
                              accept="image/*" 
                              capture="environment"
                              onChange={handleFileChange}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Anexe uma foto clara do comprovante ou da avaria.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {imagePreview && (
                    <div className="relative w-full max-w-sm mx-auto aspect-video overflow-hidden rounded-lg border">
                      <Image src={imagePreview} alt="Pré-visualização da foto" layout="fill" objectFit="contain" />
                    </div>
                  )}

                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={isPending} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar Ocorrência
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </Card>
        </div>
      </div>
    </>
  );
}
