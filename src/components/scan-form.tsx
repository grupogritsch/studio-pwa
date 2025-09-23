
"use client";

import { useState, useEffect, useTransition, useRef } from 'react';
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
import { Camera, FileText, Loader2, Package, Scan, ScanLine, Send, User, WifiOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

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
  const [isScannerOpen, setScannerOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [Zxing, setZxing] = useState<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scannedCode: '',
      occurrence: '',
      receiverName: '',
      receiverDocument: '',
    },
  });

  useEffect(() => {
    import('@zxing/browser').then(zxing => {
      setZxing(zxing);
    });
  }, []);

  const openScanner = () => {
    setScannerOpen(true);
  };
  
  useEffect(() => {
    if (isScannerOpen && Zxing && videoRef.current) {
      const codeReader = new Zxing.BrowserQRCodeReader();
      codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result) {
          form.setValue('scannedCode', result.getText());
          setScannerOpen(false);
          toast({
            title: "Código lido!",
            description: "O código foi preenchido.",
          });
        }
        if (err && !(err instanceof Zxing.NotFoundException)) {
          console.error(err);
          toast({
            variant: "destructive",
            title: "Erro no Scanner",
            description: "Não foi possível ler o código.",
          });
        }
      });
      return () => {
        codeReader.reset();
      };
    }
  }, [isScannerOpen, Zxing, form, toast]);


  useEffect(() => {
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

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof window !== 'undefined' && 'onLine' in navigator) {
      setIsOffline(!navigator.onLine);
    }

    // First sync on load
    syncOfflineData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  const syncOfflineData = () => {
    const offlineData = JSON.parse(localStorage.getItem('offlineOccurrences') || '[]');
    if (offlineData.length > 0 && !isOffline) {
      startTransition(async () => {
        let allSucceeded = true;
        for (const data of offlineData) {
          try {
            const photoFile = await dataURItoFile(data.photo, 'offline_photo.jpeg');
            const result = await submitOccurrence({ ...data, photo: photoFile });
            if (!result.success) {
              allSucceeded = false;
            }
          } catch (error) {
            allSucceeded = false;
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
            toast({
                variant: "destructive",
                title: "Falha na Sincronização",
                description: "Alguns dados não puderam ser enviados. Tente novamente mais tarde.",
            });
        }
      });
    }
  };

  const dataURItoFile = async (dataURI: string, fileName: string): Promise<File> => {
    const res = await fetch(dataURI);
    const blob = await res.blob();
    return new File([blob], fileName, { type: blob.type });
  }

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
        } else {
          throw new Error(result.message || "Ocorreu um erro desconhecido.");
        }
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Erro ao registrar ocorrência",
          description: error.message || "Não foi possível obter a localização ou enviar os dados.",
        });
        if(isOffline) {
          await saveForOffline(values);
        }
      }
    });
  };

  return (
    <>
      <Card className="w-full shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
             <CardTitle>Registrar Ocorrência</CardTitle>
             {isOffline && <WifiOff className="h-5 w-5 text-destructive" />}
          </div>
          <CardDescription>Leia o código, escolha a ocorrência e anexe uma foto.</CardDescription>
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
                        <Input placeholder="Leia ou digite o código" {...field} className="pl-10 pr-10" />
                        <Button type="button" size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={openScanner}>
                          <Scan className="h-5 w-5" />
                        </Button>
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
                render={() => (
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

      <Dialog open={isScannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escanear Código</DialogTitle>
            <DialogDescription>
              Aponte a câmera para o código de barras ou QR code.
            </DialogDescription>
          </DialogHeader>
          <video ref={videoRef} className="w-full aspect-video rounded-md" />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

    