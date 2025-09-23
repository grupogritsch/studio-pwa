import { z } from 'zod';

export const OccurrenceFormSchema = z.object({
  scannedCode: z.string(),
  occurrence: z.string(),
  photo: z.any(), // Can be File or string (data URI)
  receiverName: z.string().optional(),
  receiverDocument: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
});

export type OccurrenceFormData = z.infer<typeof OccurrenceFormSchema>;

    