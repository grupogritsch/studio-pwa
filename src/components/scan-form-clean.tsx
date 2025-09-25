"use client";

import { useState, useEffect, useTransition } from 'react';
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
import { Camera, Loader2, Package, Send, WifiOff, ArrowLeft } from 'lucide-react';
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
  const searchParams = useSearchParams();
  const isManualMode = searchParams.get('mode') === 'manual';
  const codeFromUrl = searchParams.get('code');
  const router = useRouter();
  const [scannedCode, setScannedCode] = useState<string | null>(codeFromUrl);

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
  const requiresPhoto = occurrenceValue === 'entregue';
  const isHoliday = occurrenceValue === 'feriado';
  const isCameraEnabled = typeof navigator !== 'undefined' && 'mediaDevices' in navigator;
  const isSendEnabled = (isHoliday && isValid) || (requiresPhoto && photoValue && isValid);

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
        form.setValue('photo', result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
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
                            <SelectItem value="entregue">Entregue</SelectItem>
                            <SelectItem value="avaria">Avaria</SelectItem>
                            <SelectItem value="extravio">Extravio</SelectItem>
                            <SelectItem value="devolucao">Devolução</SelectItem>
                            <SelectItem value="recusado">Recusado</SelectItem>
                            <SelectItem value="feriado">Feriado</SelectItem>
                            <SelectItem value="outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {occurrenceValue === 'entregue' && (
                    <>
                      <FormField
                        control={form.control}
                        name="receiverName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome do Recebedor</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Digite o nome do recebedor" />
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
                            <FormLabel>Documento do Recebedor</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="CPF, RG ou outro documento" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {requiresPhoto && (
                    <div className="space-y-4">
                      <FormLabel>Foto Comprobatória</FormLabel>
                      {imagePreview && (
                        <div className="mt-4">
                          <img src={imagePreview} alt="Preview" className="max-w-full h-auto rounded-lg shadow-sm" />
                        </div>
                      )}
                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        capture="environment"
                        onChange={handleFileChange}
                        />
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
            asChild
            variant="outline"
            className="h-16 w-16 rounded-full shadow-lg"
            disabled={!isCameraEnabled}
            aria-label="Tirar Foto"
        >
            <label htmlFor="photo-upload" className={`cursor-${isCameraEnabled ? 'pointer' : 'not-allowed'}`}>
                <Camera className="h-10 w-10" />
            </label>
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
      </footer>
    </div>
    );
}