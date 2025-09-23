
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
  occurrence: z.string({ required_error: "Selecione uma ocorrência." }).min(1, "Selecione uma ocorrência."),
  photo: z.union([
    z.string().min(1, "Foto é obrigatória.").optional(),
    z.instanceof(File).optional(),
  ]),
  receiverName: z.string().optional(),
  receiverDocument: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.occurrence === 'entregue') {
      if (!data.receiverName || data.receiverName.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Nome do recebedor é obrigatório para entrega.",
          path: ["receiverName"],
        });
      }
      if (!data.receiverDocument || data.receiverDocument.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Documento do recebedor é obrigatório para entrega.",
          path: ["receiverDocument"],
        });
      }
      if (!data.photo) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Foto é obrigatória para entrega.",
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
  const [step, setStep] = useState<'scan' | 'form'>('scan');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const router = useRouter();
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      occurrence: '',
      receiverName: '',
      receiverDocument: '',
    },
    mode: "onChange",
  });

  const occurrenceValue = form.watch('occurrence');
  const photoValue = form.watch('photo');
  const { isValid } = form.formState;

  const isHoliday = occurrenceValue === 'feriado';
  const isDelivered = occurrenceValue === 'entregue';
  const requiresPhoto = isDelivered || ['avaria', 'extravio', 'devolucao', 'recusado', 'outros'].includes(occurrenceValue);
  
  const isCameraEnabled = requiresPhoto && occurrenceValue !== '';
  const isSendEnabled = (isHoliday && isValid) || (requiresPhoto && photoValue && isValid);


  const dataURItoFile = async (dataURI: string, fileName: string): Promise<File> => {
    const res = await fetch(dataURI);
    const blob = await res.blob();
    return new File([blob], fileName, { type: blob.type });
  };
  
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  
useEffect(() => {
    let controls: IScannerControls | null = null;

    const startScanner = async () => {
        if (step !== 'scan' || hasCameraPermission === false) {
            return;
        }

        try {
            const { BrowserQRCodeReader, NotFoundException } = await import('@zxing/browser');
            const codeReader = new BrowserQRCodeReader();

            if (videoRef.current) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                videoRef.current.srcObject = stream;
                setHasCameraPermission(true);

                codeReader.decodeFromVideoElement(videoRef.current, (result, error, videoControls) => {
                    if (videoControls && !controls) {
                        controls = videoControls;
                        scannerControlsRef.current = videoControls;
                    }
                    if (result) {
                        videoControls.stop();
                        scannerControlsRef.current = null;
                        setScannedCode(result.getText());
                        setStep('form');
                    }
                    if (error && !(error instanceof NotFoundException)) {
                        console.error("Scanner Error:", error);
                        toast({
                            variant: "destructive",
                            title: "Erro de Scanner",
                            description: "Ocorreu um erro ao tentar ler o código.",
                        });
                    }
                });
            }
        } catch (err) {
            console.error("Failed to get camera permission or start scanner:", err);
            setHasCameraPermission(false);
            toast({
                variant: "destructive",
                title: "Câmera não autorizada",
                description: "Você precisa permitir o acesso à câmera para continuar.",
            });
        }
    };

    startScanner();

    return () => {
        if (scannerControlsRef.current) {
            scannerControlsRef.current.stop();
            scannerControlsRef.current = null;
        }
    };
}, [step, hasCameraPermission, toast]);


  
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

  const saveToLocal = async (values: z.infer<typeof formSchema>) => {
    if (typeof window.localStorage === 'undefined' || !scannedCode) return;
    
    const occurrenceData = { 
        ...values, 
        scannedCode, 
        timestamp: new Date().toISOString() 
    };

    // Save for offline sync
    if(isOffline){
        const offlineData = JSON.parse(localStorage.getItem('offlineOccurrences') || '[]');
        let photoDataUrl = values.photo;
        if (values.photo instanceof File) {
            photoDataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(values.photo as File);
            });
        }
        offlineData.push({ ...occurrenceData, photo: photoDataUrl });
        localStorage.setItem('offlineOccurrences', JSON.stringify(offlineData));
    }

    // Save for local display
    const localOccurrences = JSON.parse(localStorage.getItem('occurrences') || '[]');
    localOccurrences.push(occurrenceData);
    localStorage.setItem('occurrences', JSON.stringify(localOccurrences));
    
    toast({
      title: isOffline ? "Salvo para envio posterior" : "Ocorrência registrada!",
      description: isOffline ? "A ocorrência será enviada quando houver conexão." : "Visível na tela inicial.",
    });

    form.reset();
    setImagePreview(null);
    router.push('/');
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    startTransition(async () => {
      if (!scannedCode) {
         toast({ variant: "destructive", title: "Erro", description: "Código não escaneado." });
         return;
      }

      await saveToLocal(values);

      // We are not submitting to a real API, so we just save locally.
      // If we were, the logic would be here, handling online/offline cases.
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
      <main className="flex-1 flex flex-col items-center justify-start gap-4 p-4 md:gap-8 md:p-10 w-full mb-24">
        <div className="w-full max-w-2xl">
          <Card className="w-full shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Registrar Ocorrência</CardTitle>
                {isOffline && <WifiOff className="h-5 w-5 text-destructive" />}
              </div>
              <CardDescription>
                Código: <span className="font-bold text-foreground">{scannedCode}</span>
              </CardDescription>
            </CardHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-6">
                  
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
                             <SelectItem value="feriado">Feriado / Fim de Semana</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isDelivered && (
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
                        {imagePreview && (
                            <div className="relative w-full max-w-sm mx-auto aspect-video overflow-hidden rounded-lg border">
                            <Image src={imagePreview} alt="Pré-visualização da foto" layout="fill" objectFit="contain" />
                            </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Input 
                    id="photo-upload"
                    type="file" 
                    className="sr-only" 
                    accept="image/*" 
                    capture="environment"
                    onChange={handleFileChange}
                    />

                </CardContent>
                {/* Footer is now external */}
              </form>
            </Form>
          </Card>
        </div>
      </main>
      <footer className="fixed bottom-0 z-10 flex w-full justify-center items-center gap-4 bg-background border-t p-4">
        <Button 
            asChild
            variant="outline" 
            className="h-16 w-16 rounded-full shadow-lg"
            disabled={!isCameraEnabled}
            aria-label="Tirar Foto"
        >
            <label htmlFor="photo-upload" className={`cursor-${isCameraEnabled ? 'pointer' : 'not-allowed'}`}>
                <Camera className="h-8 w-8" />
            </label>
        </Button>
       
        <Button
            type="submit"
            variant="default"
            className="h-16 w-16 rounded-full shadow-lg bg-accent hover:bg-accent/90 text-accent-foreground"
            disabled={!isSendEnabled || isPending}
            onClick={form.handleSubmit(onSubmit)}
            aria-label="Enviar Ocorrência"
        >
            {isPending ? (
                <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
                <Send className="h-8 w-8" />
            )}
        </Button>
      </footer>
    </>
  );
}
