"use client";

import { useState, useEffect, useTransition } from 'react';
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
import { Camera, FileText, Loader2, Package, ScanLine, Send, User } from 'lucide-react';

const formSchema = z.object({
  scannedCode: z.string({ required_error: "Código é obrigatório."}).min(1, "Código é obrigatório."),
  occurrence: z.string({ required_error: "Selecione uma ocorrência."}).min(1, "Selecione uma ocorrência."),
  photo: z.instanceof(File, { message: "Foto é obrigatória." }).refine(file => file.size > 0, "Foto é obrigatória."),
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      scannedCode: '',
      occurrence: '',
      receiverName: '',
      receiverDocument: '',
    },
  });

  const occurrenceValue = form.watch('occurrence');
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue('photo', file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    startTransition(async () => {
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
        const result = await submitOccurrence({ ...values, latitude, longitude });

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
      }
    });
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle>Registrar Ocorrência</CardTitle>
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
  );
}
